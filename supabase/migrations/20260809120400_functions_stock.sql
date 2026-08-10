-- =============================================================================
-- 0005 · Primitivas de inventario
-- =============================================================================
-- El esquema `app_private` NO se expone en la API de PostgREST (solo publica
-- `public`). Todo lo que vive aquí es maquinaria interna, imposible de llamar
-- desde el navegador aunque alguien adivine el nombre.
-- =============================================================================

create schema if not exists app_private;

revoke all on schema app_private from public;
revoke usage on schema app_private from anon, authenticated;

-- -----------------------------------------------------------------------------
-- apply_stock_movement · el ÚNICO camino por el que cambia el inventario
-- -----------------------------------------------------------------------------
-- Bloquea la variante con FOR UPDATE antes de leerla. Ese bloqueo es lo que
-- impide la sobreventa: si dos vendedores registran la última camisa a la vez,
-- el segundo espera al primero, vuelve a leer el stock ya actualizado y falla
-- limpio en vez de dejar el inventario en -1.
--
-- Las restricciones de la tabla ya impedirían el estado imposible, pero aquí se
-- valida antes para poder dar un mensaje que el vendedor entienda, con el nombre
-- de la prenda, en vez de un error críptico de Postgres.
create or replace function app_private.apply_stock_movement(
  p_variant_id       uuid,
  p_delta_on_hand    integer,
  p_delta_reserved   integer,
  p_reason           public.stock_reason,
  p_actor            uuid,
  p_order_id         uuid    default null,
  p_return_id        uuid    default null,
  p_unit_cost_cents  bigint  default null,
  p_note             text    default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_variant public.product_variants;
  v_label   text;
  v_new_on_hand  integer;
  v_new_reserved integer;
begin
  -- El bloqueo de fila: nadie más toca esta variante hasta que la transacción
  -- termine.
  select * into v_variant
  from public.product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'La prenda seleccionada no existe.' using errcode = '23503';
  end if;

  select p.name || ' · ' || v_variant.color || ' · ' || v_variant.size
  into v_label
  from public.products p
  where p.id = v_variant.product_id;

  v_new_on_hand  := v_variant.qty_on_hand  + coalesce(p_delta_on_hand, 0);
  v_new_reserved := v_variant.qty_reserved + coalesce(p_delta_reserved, 0);

  if v_new_on_hand < 0 then
    raise exception
      'Stock insuficiente de "%": hay % en tienda y se intentan sacar %.',
      v_label, v_variant.qty_on_hand, abs(p_delta_on_hand)
      using errcode = '23514';
  end if;

  if v_new_reserved < 0 then
    raise exception
      'No hay tantas unidades apartadas de "%": apartadas %, se intentan liberar %.',
      v_label, v_variant.qty_reserved, abs(p_delta_reserved)
      using errcode = '23514';
  end if;

  -- Esta es la regla que separa el stock vendible del apartado.
  if v_new_reserved > v_new_on_hand then
    raise exception
      'No hay suficiente disponible de "%": disponible %, solicitado %. '
      '(físico %, apartado %)',
      v_label,
      v_variant.qty_on_hand - v_variant.qty_reserved,
      p_delta_reserved,
      v_variant.qty_on_hand,
      v_variant.qty_reserved
      using errcode = '23514';
  end if;

  update public.product_variants
  set qty_on_hand  = v_new_on_hand,
      qty_reserved = v_new_reserved
  where id = p_variant_id;

  -- Renglón en el libro append-only. Nunca se actualiza ni se borra.
  insert into public.stock_movements (
    variant_id, delta_on_hand, delta_reserved, reason,
    order_id, return_id, unit_cost_cents, note, created_by
  )
  values (
    p_variant_id, coalesce(p_delta_on_hand, 0), coalesce(p_delta_reserved, 0), p_reason,
    p_order_id, p_return_id, p_unit_cost_cents, nullif(btrim(p_note), ''), p_actor
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- receive_stock · entrada de mercancía
-- -----------------------------------------------------------------------------
-- Actualiza el costo promedio ponderado, que es lo correcto para calcular
-- margen: si tenías 2 camisas a $10 y entran 3 a $15, el costo pasa a $13,
-- no a $15. Usar el último costo distorsionaría la ganancia del inventario viejo.
create or replace function public.receive_stock(
  p_variant_id      uuid,
  p_qty             integer,
  p_unit_cost_cents bigint default null,
  p_note            text   default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor    uuid := public.require_admin();
  v_variant  public.product_variants;
  v_old_cost bigint;
  v_new_cost bigint;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'La cantidad a ingresar debe ser mayor que cero.' using errcode = '22023';
  end if;

  if p_unit_cost_cents is not null and p_unit_cost_cents < 0 then
    raise exception 'El costo no puede ser negativo.' using errcode = '22023';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'La prenda seleccionada no existe.' using errcode = '23503';
  end if;

  if p_unit_cost_cents is not null then
    select vc.cost_cents into v_old_cost
    from public.variant_costs vc
    where vc.variant_id = p_variant_id
    for update;

    v_old_cost := coalesce(v_old_cost, 0);

    v_new_cost := case
      when v_variant.qty_on_hand <= 0 then p_unit_cost_cents
      else round(
        (v_variant.qty_on_hand::numeric * v_old_cost + p_qty::numeric * p_unit_cost_cents)
        / (v_variant.qty_on_hand + p_qty)
      )::bigint
    end;

    insert into public.variant_costs (variant_id, cost_cents)
    values (p_variant_id, v_new_cost)
    on conflict (variant_id) do update set cost_cents = excluded.cost_cents;
  end if;

  perform app_private.apply_stock_movement(
    p_variant_id      => p_variant_id,
    p_delta_on_hand   => p_qty,
    p_delta_reserved  => 0,
    p_reason          => 'purchase_in',
    p_actor           => v_actor,
    p_unit_cost_cents => p_unit_cost_cents,
    p_note            => p_note
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- adjust_stock · corrección por conteo físico
-- -----------------------------------------------------------------------------
-- Solo admin y siempre con nota obligatoria: un ajuste sin explicación es un
-- descuadre disfrazado, y con el tiempo nadie recuerda por qué se hizo.
create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_delta      integer,
  p_note       text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.require_admin();
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'El ajuste debe ser distinto de cero.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Todo ajuste de inventario necesita una nota que lo explique.'
      using errcode = '22023';
  end if;

  perform app_private.apply_stock_movement(
    p_variant_id     => p_variant_id,
    p_delta_on_hand  => p_delta,
    p_delta_reserved => 0,
    p_reason         => 'adjustment',
    p_actor          => v_actor,
    p_note           => p_note
  );
end;
$$;
