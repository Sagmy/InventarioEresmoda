-- =============================================================================
-- 0006 · Creación, liquidación y cancelación de transacciones
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_order_internal · arma la orden y aplica su efecto sobre el stock
-- -----------------------------------------------------------------------------
-- Efecto según el tipo:
--   contado  → sale_out  (on_hand −n)   la prenda sale ya
--   credito  → sale_out  (on_hand −n)   la prenda sale ya, queda la deuda
--   apartado → reserve   (reserved +n)  la prenda NO sale, solo se separa
create or replace function app_private.create_order_internal(
  p_type            public.order_type,
  p_items           jsonb,
  p_actor           uuid,
  p_customer_id     uuid              default null,
  p_price_kind      public.price_kind default 'normal',
  p_discount_cents  bigint            default 0,
  p_notes           text              default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.settings;
  v_order_id uuid;
  v_expected integer;
  v_inserted integer;
  v_subtotal bigint;
  v_item     record;
begin
  select * into v_settings from public.settings where id;

  -- ---------------------------------------------------------------------------
  -- Validaciones de forma
  -- ---------------------------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene prendas.' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_items);

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    group by (e ->> 'variant_id')
    having count(*) > 1
  ) then
    raise exception
      'Hay una prenda repetida en la venta. Únela en una sola línea con la cantidad total.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    where coalesce((e ->> 'qty')::integer, 0) <= 0
  ) then
    raise exception 'La cantidad de cada prenda debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_type <> 'contado' and p_customer_id is null then
    raise exception 'Los apartados y créditos necesitan un cliente identificado.'
      using errcode = '22023';
  end if;

  if p_price_kind = 'promo' and p_type <> 'contado' then
    raise exception 'Las promociones solo aplican a ventas de contado.' using errcode = '22023';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.is_active
  ) then
    raise exception 'El cliente seleccionado no existe o está inactivo.' using errcode = '23503';
  end if;

  -- ---------------------------------------------------------------------------
  -- Cabecera. Los totales entran en cero y se calculan desde las líneas, para
  -- que el cliente no pueda dictar el total de la venta.
  -- ---------------------------------------------------------------------------
  insert into public.orders (
    type, status, price_kind, customer_id,
    subtotal_cents, discount_cents, total_cents,
    due_date, notes, created_by
  )
  values (
    p_type, 'open', p_price_kind, p_customer_id,
    0, 0, 0,
    case
      when p_type = 'apartado'
        then (now() at time zone v_settings.timezone)::date + v_settings.layaway_term_days
      else null
    end,
    nullif(btrim(p_notes), ''),
    p_actor
  )
  returning id into v_order_id;

  -- ---------------------------------------------------------------------------
  -- Líneas. El precio de lista, el precio cobrado y el costo se copian desde la
  -- variante en este instante y quedan congelados para siempre.
  -- ---------------------------------------------------------------------------
  insert into public.order_items (
    order_id, variant_id, qty,
    unit_list_price_cents, unit_price_cents, line_total_cents,
    product_name, variant_label
  )
  select
    v_order_id,
    v.id,
    it.qty,
    v.price_cents,
    coalesce(it.unit_price_cents, v.price_cents),
    coalesce(it.unit_price_cents, v.price_cents) * it.qty,
    p.name,
    p.name || ' · ' || v.color || ' · ' || v.size
  from (
    select
      (e ->> 'variant_id')::uuid                    as variant_id,
      (e ->> 'qty')::integer                        as qty,
      nullif(e ->> 'unit_price_cents', '')::bigint  as unit_price_cents
    from jsonb_array_elements(p_items) e
  ) it
  join public.product_variants v on v.id = it.variant_id and v.is_active
  join public.products p         on p.id = v.product_id  and p.is_active;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected then
    raise exception 'Alguna de las prendas no existe o está desactivada.' using errcode = '23503';
  end if;

  -- Costo congelado de cada línea. Va en su propia tabla para que el vendedor
  -- pueda leer la venta sin poder deducir el margen.
  insert into public.order_item_costs (order_item_id, unit_cost_cents)
  select i.id, coalesce(vc.cost_cents, 0)
  from public.order_items i
  left join public.variant_costs vc on vc.variant_id = i.variant_id
  where i.order_id = v_order_id;

  -- ---------------------------------------------------------------------------
  -- La etiqueta de promoción tiene que significar algo
  -- ---------------------------------------------------------------------------
  -- Sin esto, cualquiera podría cobrar por debajo del precio de lista sin dejar
  -- rastro, y el reporte de descuentos concedidos quedaría en cero para siempre.
  if p_price_kind = 'normal' and exists (
    select 1 from public.order_items i
    where i.order_id = v_order_id
      and i.unit_price_cents <> i.unit_list_price_cents
  ) then
    raise exception
      'Para cobrar por debajo del precio de lista hay que marcar la venta como promoción.'
      using errcode = '22023';
  end if;

  if p_price_kind = 'promo' and not exists (
    select 1 from public.order_items i
    where i.order_id = v_order_id
      and i.unit_price_cents < i.unit_list_price_cents
  ) then
    raise exception
      'La venta está marcada como promoción, pero ningún precio está por debajo del de lista.'
      using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- Totales
  -- ---------------------------------------------------------------------------
  select sum(i.line_total_cents) into v_subtotal
  from public.order_items i
  where i.order_id = v_order_id;

  if coalesce(p_discount_cents, 0) < 0 then
    raise exception 'El descuento no puede ser negativo.' using errcode = '22023';
  end if;

  if coalesce(p_discount_cents, 0) > v_subtotal then
    raise exception 'El descuento no puede superar el subtotal de la venta.' using errcode = '22023';
  end if;

  update public.orders
  set subtotal_cents = v_subtotal,
      discount_cents = coalesce(p_discount_cents, 0),
      total_cents    = v_subtotal - coalesce(p_discount_cents, 0)
  where id = v_order_id;

  -- ---------------------------------------------------------------------------
  -- Efecto sobre el inventario
  -- ---------------------------------------------------------------------------
  -- Se recorre ordenado por variant_id: bloquear siempre en el mismo orden es lo
  -- que evita que dos ventas simultáneas con las mismas prendas se traben entre sí.
  for v_item in
    select i.variant_id, i.qty
    from public.order_items i
    where i.order_id = v_order_id
    order by i.variant_id
  loop
    if p_type = 'apartado' then
      perform app_private.apply_stock_movement(
        p_variant_id     => v_item.variant_id,
        p_delta_on_hand  => 0,
        p_delta_reserved => v_item.qty,
        p_reason         => 'reserve',
        p_actor          => p_actor,
        p_order_id       => v_order_id
      );
    else
      perform app_private.apply_stock_movement(
        p_variant_id     => v_item.variant_id,
        p_delta_on_hand  => -v_item.qty,
        p_delta_reserved => 0,
        p_reason         => 'sale_out',
        p_actor          => p_actor,
        p_order_id       => v_order_id
      );
    end if;
  end loop;

  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- settle_order_if_paid · cierra la orden cuando el saldo llega a cero
-- -----------------------------------------------------------------------------
-- Aquí ocurre el momento clave del apartado: al terminar de pagarse, la prenda
-- por fin SALE del inventario (on_hand −n) y deja de estar apartada (reserved −n).
-- En contado y crédito la prenda ya había salido, así que solo cambia el estado.
create or replace function app_private.settle_order_if_paid(
  p_order_id uuid,
  p_actor    uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_paid  bigint;
  v_item  record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'La transacción no existe.' using errcode = '23503';
  end if;

  if v_order.status <> 'open' then
    return false;
  end if;

  select coalesce(sum(p.amount_cents), 0) into v_paid
  from public.payments p
  where p.order_id = p_order_id
    and p.voided_at is null;

  if v_paid < v_order.total_cents then
    return false;
  end if;

  if v_order.type = 'apartado' then
    for v_item in
      select i.variant_id, i.qty
      from public.order_items i
      where i.order_id = p_order_id
      order by i.variant_id
    loop
      perform app_private.apply_stock_movement(
        p_variant_id     => v_item.variant_id,
        p_delta_on_hand  => -v_item.qty,
        p_delta_reserved => -v_item.qty,
        p_reason         => 'reserve_to_sale',
        p_actor          => p_actor,
        p_order_id       => p_order_id
      );
    end loop;
  end if;

  update public.orders
  set status       = 'completed',
      completed_at = now()
  where id = p_order_id;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_order · punto de entrada público
-- -----------------------------------------------------------------------------
-- p_items    : [{ "variant_id": uuid, "qty": int, "unit_price_cents": bigint? }]
-- p_payments : [{ "amount_cents": bigint, "method": text,
--                 "reference": text?, "notes": text?, "paid_at": timestamptz? }]
--
-- Los pagos van como lista porque una misma venta puede cobrarse con varios
-- métodos a la vez (ej. $30 en efectivo y $70 por Zelle).
create or replace function public.create_order(
  p_type            public.order_type,
  p_items           jsonb,
  p_customer_id     uuid              default null,
  p_price_kind      public.price_kind default 'normal',
  p_payments        jsonb             default '[]'::jsonb,
  p_discount_cents  bigint            default 0,
  p_notes           text              default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor    uuid := public.require_staff();
  v_settings public.settings;
  v_order_id uuid;
  v_total    bigint;
  v_paid     bigint;
  v_min      bigint;
begin
  select * into v_settings from public.settings where id;

  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'El formato de los pagos no es válido.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_payments) e
    where nullif(btrim(coalesce(e ->> 'method', '')), '') is null
  ) then
    raise exception 'Cada pago necesita un método (efectivo, Pago Móvil, Zelle…).'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_payments) e
    where coalesce((e ->> 'amount_cents')::bigint, 0) <= 0
  ) then
    raise exception 'Cada pago debe ser mayor que cero.' using errcode = '22023';
  end if;

  -- 'credito_cambio' es un asiento interno de los cambios de talla, no un medio
  -- de pago que alguien pueda elegir: aceptarlo aquí inflaría la caja con dinero
  -- que nunca entró.
  if exists (
    select 1 from jsonb_array_elements(p_payments) e
    where (e ->> 'method') = 'credito_cambio'
  ) then
    raise exception 'Ese método de pago es de uso interno del sistema.' using errcode = '22023';
  end if;

  v_order_id := app_private.create_order_internal(
    p_type           => p_type,
    p_items          => p_items,
    p_actor          => v_actor,
    p_customer_id    => p_customer_id,
    p_price_kind     => p_price_kind,
    p_discount_cents => p_discount_cents,
    p_notes          => p_notes
  );

  select o.total_cents into v_total from public.orders o where o.id = v_order_id;

  select coalesce(sum((e ->> 'amount_cents')::bigint), 0) into v_paid
  from jsonb_array_elements(p_payments) e;

  -- ---------------------------------------------------------------------------
  -- Reglas de abono por tipo de venta
  -- ---------------------------------------------------------------------------
  if v_paid > v_total then
    raise exception
      'El pago (%) excede el total de la venta (%).',
      public.format_cents(v_paid), public.format_cents(v_total)
      using errcode = '22023';
  end if;

  if p_type = 'contado' and v_paid <> v_total then
    raise exception
      'Una venta de contado debe pagarse completa: el total es % y se registraron %.',
      public.format_cents(v_total), public.format_cents(v_paid)
      using errcode = '22023';
  end if;

  if p_type = 'apartado' then
    v_min := ceil(v_total * v_settings.layaway_min_deposit_pct / 100.0)::bigint;
    if v_paid < v_min then
      raise exception
        'Para apartar hay que abonar al menos el % %% del total, o sea %. Se registraron %.',
        v_settings.layaway_min_deposit_pct,
        public.format_cents(v_min),
        public.format_cents(v_paid)
        using errcode = '22023';
    end if;
  end if;

  if p_type = 'credito' then
    v_min := ceil(v_total * v_settings.credit_min_deposit_pct / 100.0)::bigint;
    if v_paid < v_min then
      raise exception
        'Este crédito exige un abono inicial de al menos %. Se registraron %.',
        public.format_cents(v_min), public.format_cents(v_paid)
        using errcode = '22023';
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- Pagos
  -- ---------------------------------------------------------------------------
  insert into public.payments (
    order_id, amount_cents, method, reference, notes, paid_at, created_by
  )
  select
    v_order_id,
    (e ->> 'amount_cents')::bigint,
    (e ->> 'method')::public.payment_method,
    nullif(btrim(e ->> 'reference'), ''),
    nullif(btrim(e ->> 'notes'), ''),
    coalesce((e ->> 'paid_at')::timestamptz, now()),
    v_actor
  from jsonb_array_elements(p_payments) e;

  perform app_private.settle_order_if_paid(v_order_id, v_actor);

  return v_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- cancel_order · liberar un apartado o anular un crédito. SIEMPRE manual.
-- -----------------------------------------------------------------------------
-- El sistema nunca cancela solo, ni siquiera un apartado vencido: se limita a
-- mostrarlo en rojo en el panel de cobros. La decisión de devolver la prenda al
-- stock es del dueño, tal como se pidió.
create or replace function public.cancel_order(
  p_order_id       uuid,
  p_restock        boolean               default true,
  p_refund_cents   bigint                default 0,
  p_refund_method  public.payment_method default null,
  p_reason         text                  default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.require_admin();
  v_order public.orders;
  v_paid  bigint;
  v_item  record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'La transacción no existe.' using errcode = '23503';
  end if;

  if v_order.status <> 'open' then
    raise exception
      'Solo se pueden cancelar transacciones abiertas. Para una venta ya completada, registra una devolución.'
      using errcode = '22023';
  end if;

  select coalesce(sum(p.amount_cents), 0) into v_paid
  from public.payments p
  where p.order_id = p_order_id
    and p.voided_at is null;

  if coalesce(p_refund_cents, 0) < 0 then
    raise exception 'El reembolso no puede ser negativo.' using errcode = '22023';
  end if;

  if coalesce(p_refund_cents, 0) > v_paid then
    raise exception
      'El reembolso (%) supera lo que el cliente ha abonado (%).',
      public.format_cents(p_refund_cents), public.format_cents(v_paid)
      using errcode = '22023';
  end if;

  if coalesce(p_refund_cents, 0) > 0 and p_refund_method is null then
    raise exception 'Indica por qué medio se devuelve el dinero.' using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------------------
  -- Reversión del inventario
  -- ---------------------------------------------------------------------------
  for v_item in
    select i.variant_id, i.qty
    from public.order_items i
    where i.order_id = p_order_id
    order by i.variant_id
  loop
    if v_order.type = 'apartado' then
      -- La prenda nunca salió: basta con soltar la reserva y vuelve a disponible.
      perform app_private.apply_stock_movement(
        p_variant_id     => v_item.variant_id,
        p_delta_on_hand  => 0,
        p_delta_reserved => -v_item.qty,
        p_reason         => 'release_reserve',
        p_actor          => v_actor,
        p_order_id       => p_order_id,
        p_note           => p_reason
      );

    elsif v_order.type = 'credito' and p_restock then
      -- La prenda sí salió, así que solo reingresa si el cliente la devolvió.
      perform app_private.apply_stock_movement(
        p_variant_id     => v_item.variant_id,
        p_delta_on_hand  => v_item.qty,
        p_delta_reserved => 0,
        p_reason         => 'return_in',
        p_actor          => v_actor,
        p_order_id       => p_order_id,
        p_note           => p_reason
      );
    end if;
  end loop;

  -- El reembolso se registra como devolución sin líneas: el movimiento de stock
  -- ya quedó arriba, y así el reporte de caja descuenta la salida de dinero.
  if coalesce(p_refund_cents, 0) > 0 then
    insert into public.returns (
      order_id, type, refund_cents, refund_method, restocked, notes, created_by
    )
    values (
      p_order_id, 'devolucion', p_refund_cents, p_refund_method,
      coalesce(p_restock, false),
      coalesce(nullif(btrim(p_reason), ''), 'Reembolso por cancelación'),
      v_actor
    );
  end if;

  update public.orders
  set status        = 'cancelled',
      cancelled_at  = now(),
      cancel_reason = nullif(btrim(p_reason), '')
  where id = p_order_id;
end;
$$;
