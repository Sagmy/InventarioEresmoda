-- =============================================================================
-- 0007 · Abonos, anulaciones, devoluciones y cambios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- add_payment · registrar un abono
-- -----------------------------------------------------------------------------
-- Es la función que hace avanzar la barra de progreso de apartados y créditos.
-- Cuando el abono cierra el saldo, dispara la liquidación: en un apartado, ese
-- es el momento en que la prenda por fin se descuenta del inventario.
create or replace function public.add_payment(
  p_order_id      uuid,
  p_amount_cents  bigint,
  p_method        public.payment_method,
  p_reference     text        default null,
  p_notes         text        default null,
  p_paid_at       timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor      uuid := public.require_staff();
  v_order      public.orders;
  v_paid       bigint;
  v_balance    bigint;
  v_payment_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'El abono debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_method = 'credito_cambio' then
    raise exception 'Ese método de pago es de uso interno del sistema.' using errcode = '22023';
  end if;

  -- Bloquear la orden serializa los abonos: dos cobros simultáneos no pueden
  -- pasarse ambos la validación de saldo y terminar sobrepagando.
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'La transacción no existe.' using errcode = '23503';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Esta transacción está cancelada; no admite abonos.' using errcode = '22023';
  end if;

  if v_order.status = 'completed' then
    raise exception 'Esta transacción ya está pagada por completo.' using errcode = '22023';
  end if;

  select coalesce(sum(p.amount_cents), 0) into v_paid
  from public.payments p
  where p.order_id = p_order_id
    and p.voided_at is null;

  v_balance := v_order.total_cents - v_paid;

  if p_amount_cents > v_balance then
    raise exception
      'El abono (%) supera el saldo pendiente (%).',
      public.format_cents(p_amount_cents), public.format_cents(v_balance)
      using errcode = '22023';
  end if;

  insert into public.payments (
    order_id, amount_cents, method, reference, notes, paid_at, created_by
  )
  values (
    p_order_id, p_amount_cents, p_method,
    nullif(btrim(p_reference), ''), nullif(btrim(p_notes), ''),
    coalesce(p_paid_at, now()), v_actor
  )
  returning id into v_payment_id;

  perform app_private.settle_order_if_paid(p_order_id, v_actor);

  return v_payment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- void_payment · anular un abono mal registrado
-- -----------------------------------------------------------------------------
-- Solo sobre transacciones ABIERTAS. Anular un abono de una venta ya liquidada
-- dejaría mercancía fuera de la tienda con un saldo abierto y el inventario
-- descuadrado; para ese caso el instrumento correcto es una devolución.
create or replace function public.void_payment(
  p_payment_id uuid,
  p_reason     text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := public.require_admin();
  v_payment public.payments;
  v_order   public.orders;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Toda anulación necesita un motivo.' using errcode = '22023';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'El pago no existe.' using errcode = '23503';
  end if;

  if v_payment.voided_at is not null then
    raise exception 'Ese pago ya estaba anulado.' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if v_order.status <> 'open' then
    raise exception
      'Solo se pueden anular abonos de transacciones abiertas. Esta ya está %; registra una devolución.',
      case v_order.status when 'completed' then 'pagada' else 'cancelada' end
      using errcode = '22023';
  end if;

  update public.payments
  set voided_at   = now(),
      voided_by   = v_actor,
      void_reason = btrim(p_reason)
  where id = p_payment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- register_return · devolución de una venta ya liquidada
-- -----------------------------------------------------------------------------
-- p_items : [{ "order_item_id": uuid, "qty": int }]
--
-- Para apartados y créditos todavía abiertos no se usa esto, sino cancel_order.
create or replace function public.register_return(
  p_order_id       uuid,
  p_items          jsonb,
  p_restock        boolean               default true,
  p_refund_cents   bigint                default 0,
  p_refund_method  public.payment_method default null,
  p_notes          text                  default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor     uuid := public.require_staff();
  v_order     public.orders;
  v_paid      bigint;
  v_return_id uuid;
  v_expected  integer;
  v_inserted  integer;
  v_item      record;
begin
  -- Devolver mercancía es una cosa; sacar dinero de la caja es otra.
  if coalesce(p_refund_cents, 0) > 0 then
    perform public.require_admin();
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No se indicó qué prendas se devuelven.' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_items);

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'La transacción no existe.' using errcode = '23503';
  end if;

  if v_order.status <> 'completed' then
    raise exception
      'Solo se pueden devolver ventas ya liquidadas. Para un apartado o crédito abierto, usa cancelar.'
      using errcode = '22023';
  end if;

  if coalesce(p_refund_cents, 0) > 0 and p_refund_method is null then
    raise exception 'Indica por qué medio se devuelve el dinero.' using errcode = '22023';
  end if;

  select coalesce(sum(p.amount_cents), 0) into v_paid
  from public.payments p
  where p.order_id = p_order_id
    and p.voided_at is null;

  if coalesce(p_refund_cents, 0) > v_paid then
    raise exception
      'El reembolso (%) supera lo que el cliente pagó (%).',
      public.format_cents(p_refund_cents), public.format_cents(v_paid)
      using errcode = '22023';
  end if;

  insert into public.returns (
    order_id, type, refund_cents, refund_method, restocked, notes, created_by
  )
  values (
    p_order_id, 'devolucion', coalesce(p_refund_cents, 0), p_refund_method,
    coalesce(p_restock, true), nullif(btrim(p_notes), ''), v_actor
  )
  returning id into v_return_id;

  -- Solo se aceptan líneas de ESTA orden, y nunca más unidades de las que
  -- quedan sin devolver.
  insert into public.return_items (return_id, order_item_id, qty)
  select
    v_return_id,
    i.id,
    req.qty
  from (
    select
      (e ->> 'order_item_id')::uuid as order_item_id,
      (e ->> 'qty')::integer        as qty
    from jsonb_array_elements(p_items) e
  ) req
  join public.order_items i on i.id = req.order_item_id and i.order_id = p_order_id
  where req.qty > 0
    and req.qty <= i.qty - coalesce(
      (select sum(ri.qty) from public.return_items ri where ri.order_item_id = i.id), 0
    );

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected then
    raise exception
      'Alguna prenda no pertenece a esta venta o ya fue devuelta. Revisa las cantidades.'
      using errcode = '22023';
  end if;

  if coalesce(p_restock, true) then
    for v_item in
      select i.variant_id, ri.qty
      from public.return_items ri
      join public.order_items i on i.id = ri.order_item_id
      where ri.return_id = v_return_id
      order by i.variant_id
    loop
      perform app_private.apply_stock_movement(
        p_variant_id     => v_item.variant_id,
        p_delta_on_hand  => v_item.qty,
        p_delta_reserved => 0,
        p_reason         => 'return_in',
        p_actor          => v_actor,
        p_order_id       => p_order_id,
        p_return_id      => v_return_id,
        p_note           => p_notes
      );
    end loop;
  end if;

  return v_return_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- register_exchange · cambio de talla o de prenda
-- -----------------------------------------------------------------------------
-- El caso más común en ropa: "me quedó grande, cámbiamela por la M".
--
-- Contabilidad del cambio, para que la caja no mienta:
--   1. La prenda devuelta reingresa al stock y su valor se registra como
--      reembolso (salida de dinero).
--   2. Ese mismo valor se abona de inmediato a la prenda nueva con el método
--      interno 'credito_cambio' (entrada de dinero).
--   3. Ambos asientos se anulan entre sí, así que el efecto neto sobre la caja
--      del día es EXACTAMENTE la diferencia que el cliente pagó en efectivo.
--
-- Limitación deliberada de la v1: la prenda nueva debe valer igual o más que la
-- devuelta. Si vale menos hay que devolver dinero, y para eso está la devolución
-- normal seguida de una venta nueva.
create or replace function public.register_exchange(
  p_order_id          uuid,
  p_returned_items    jsonb,
  p_new_items         jsonb,
  p_payments          jsonb             default '[]'::jsonb,
  p_price_kind        public.price_kind default 'normal',
  p_notes             text              default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor           uuid := public.require_staff();
  v_order           public.orders;
  v_return_id       uuid;
  v_new_order_id    uuid;
  v_returned_value  bigint;
  v_new_total       bigint;
  v_difference      bigint;
  v_cash            bigint;
  v_expected        integer;
  v_inserted        integer;
  v_item            record;
begin
  if p_returned_items is null or jsonb_typeof(p_returned_items) <> 'array'
     or jsonb_array_length(p_returned_items) = 0 then
    raise exception 'No se indicó qué prenda se devuelve.' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_returned_items);

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'El formato de los pagos no es válido.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_payments) e
    where (e ->> 'method') = 'credito_cambio'
  ) then
    raise exception 'Ese método de pago es de uso interno del sistema.' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'La transacción no existe.' using errcode = '23503';
  end if;

  if v_order.status <> 'completed' then
    raise exception
      'Solo se pueden cambiar prendas de ventas ya liquidadas. Para un apartado o crédito abierto, usa cancelar.'
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- Orden de reemplazo (siempre de contado) y su total
  -- ---------------------------------------------------------------------------
  v_new_order_id := app_private.create_order_internal(
    p_type        => 'contado',
    p_items       => p_new_items,
    p_actor       => v_actor,
    p_customer_id => v_order.customer_id,
    p_price_kind  => p_price_kind,
    p_notes       => coalesce(nullif(btrim(p_notes), ''), 'Cambio de la venta #' || v_order.order_number)
  );

  select o.total_cents into v_new_total
  from public.orders o
  where o.id = v_new_order_id;

  -- ---------------------------------------------------------------------------
  -- Devolución ligada a la orden nueva
  -- ---------------------------------------------------------------------------
  insert into public.returns (
    order_id, type, refund_cents, refund_method, restocked,
    replacement_order_id, notes, created_by
  )
  values (
    p_order_id, 'cambio', 0, null, true,
    v_new_order_id, nullif(btrim(p_notes), ''), v_actor
  )
  returning id into v_return_id;

  insert into public.return_items (return_id, order_item_id, qty)
  select
    v_return_id,
    i.id,
    req.qty
  from (
    select
      (e ->> 'order_item_id')::uuid as order_item_id,
      (e ->> 'qty')::integer        as qty
    from jsonb_array_elements(p_returned_items) e
  ) req
  join public.order_items i on i.id = req.order_item_id and i.order_id = p_order_id
  where req.qty > 0
    and req.qty <= i.qty - coalesce(
      (select sum(ri.qty) from public.return_items ri where ri.order_item_id = i.id), 0
    );

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected then
    raise exception
      'Alguna prenda no pertenece a esta venta o ya fue devuelta. Revisa las cantidades.'
      using errcode = '22023';
  end if;

  -- Valor de lo devuelto, al precio que realmente se cobró en su momento.
  select coalesce(sum(ri.qty * i.unit_price_cents), 0) into v_returned_value
  from public.return_items ri
  join public.order_items i on i.id = ri.order_item_id
  where ri.return_id = v_return_id;

  v_difference := v_new_total - v_returned_value;

  if v_difference < 0 then
    raise exception
      'La prenda nueva (%) vale menos que la devuelta (%). Registra una devolución con reembolso y luego una venta nueva.',
      public.format_cents(v_new_total), public.format_cents(v_returned_value)
      using errcode = '22023';
  end if;

  select coalesce(sum((e ->> 'amount_cents')::bigint), 0) into v_cash
  from jsonb_array_elements(p_payments) e;

  if v_cash <> v_difference then
    raise exception
      'La diferencia a pagar es % y se registraron %.',
      public.format_cents(v_difference), public.format_cents(v_cash)
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- Asientos de dinero
  -- ---------------------------------------------------------------------------
  update public.returns
  set refund_cents  = v_returned_value,
      refund_method = 'credito_cambio'
  where id = v_return_id;

  insert into public.payments (order_id, amount_cents, method, notes, created_by)
  select
    v_new_order_id, v_returned_value, 'credito_cambio',
    'Valor de la prenda devuelta en el cambio #' || r.return_number,
    v_actor
  from public.returns r
  where r.id = v_return_id
    and v_returned_value > 0;

  insert into public.payments (
    order_id, amount_cents, method, reference, notes, paid_at, created_by
  )
  select
    v_new_order_id,
    (e ->> 'amount_cents')::bigint,
    (e ->> 'method')::public.payment_method,
    nullif(btrim(e ->> 'reference'), ''),
    nullif(btrim(e ->> 'notes'), ''),
    coalesce((e ->> 'paid_at')::timestamptz, now()),
    v_actor
  from jsonb_array_elements(p_payments) e;

  -- ---------------------------------------------------------------------------
  -- Reingreso de la prenda devuelta y cierre de la orden nueva
  -- ---------------------------------------------------------------------------
  for v_item in
    select i.variant_id, ri.qty
    from public.return_items ri
    join public.order_items i on i.id = ri.order_item_id
    where ri.return_id = v_return_id
    order by i.variant_id
  loop
    perform app_private.apply_stock_movement(
      p_variant_id     => v_item.variant_id,
      p_delta_on_hand  => v_item.qty,
      p_delta_reserved => 0,
      p_reason         => 'return_in',
      p_actor          => v_actor,
      p_order_id       => p_order_id,
      p_return_id      => v_return_id,
      p_note           => 'Cambio por venta #' || (select o.order_number from public.orders o where o.id = v_new_order_id)
    );
  end loop;

  perform app_private.settle_order_if_paid(v_new_order_id, v_actor);

  return v_return_id;
end;
$$;
