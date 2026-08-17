-- =============================================================================
-- 0013 · Distinguir "agotado" de "poco stock"
-- =============================================================================
-- `is_low_stock` era `qty_available <= umbral`, así que una prenda con CERO
-- disponibles entraba en la misma bolsa que una con dos. El tablero avisaba
-- "poco stock" cuando en realidad no quedaba ninguna, que es una situación
-- distinta y más urgente: con poco stock puedes seguir vendiendo, con cero no.
--
-- Ahora son dos estados separados:
--   is_out_of_stock  → no queda nada disponible para vender
--   is_low_stock     → queda poco, pero todavía se puede vender
--
-- Ojo con `qty_available`: descuenta lo apartado. Una prenda con 2 físicas y 2
-- apartadas aparece como AGOTADA, y es correcto: no hay nada que vender aunque
-- estén en la tienda.
-- =============================================================================

create or replace view public.v_stock
with (security_invoker = false) as
select
  v.id            as variant_id,
  v.product_id,
  p.name          as product_name,
  p.brand,
  p.category_id,
  c.name          as category_name,
  v.size,
  v.color,
  p.name || ' · ' || v.color || ' · ' || v.size as label,
  v.sku,
  v.price_cents,

  v.qty_on_hand,
  v.qty_reserved,
  v.qty_available,

  -- Poco stock ya NO incluye el cero.
  (v.qty_available > 0 and v.qty_available <= s.low_stock_threshold) as is_low_stock,

  v.is_active,
  p.is_active     as product_is_active,
  v.created_at,
  v.updated_at,

  -- Columna nueva: va al final porque `create or replace view` no permite
  -- insertarla en medio.
  (v.qty_available <= 0) as is_out_of_stock
from public.product_variants v
join public.products p       on p.id = v.product_id
left join public.categories c on c.id = p.category_id
cross join public.settings s
where public.is_staff();

-- -----------------------------------------------------------------------------
-- El tablero ahora informa las dos cifras por separado
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz          text;
  v_today       date;
  v_week_start  date;
  v_month_start date;
  v_result      jsonb;
begin
  perform public.require_staff();

  select s.timezone into v_tz from public.settings s where s.id;

  v_today       := (now() at time zone v_tz)::date;
  v_week_start  := date_trunc('week',  v_today::timestamp)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;

  v_result := jsonb_build_object(
    'today',        v_today,
    'week_start',   v_week_start,
    'month_start',  v_month_start,
    'is_admin',     public.is_admin(),

    'collections', (
      select jsonb_build_object(
        'red',            count(*) filter (where c.alert_level = 'rojo'),
        'yellow',         count(*) filter (where c.alert_level = 'amarillo'),
        'green',          count(*) filter (where c.alert_level = 'verde'),
        'layaway_count',  count(*) filter (where c.type = 'apartado'),
        'credit_count',   count(*) filter (where c.type = 'credito'),
        'pending_cents',  coalesce(sum(c.balance_cents), 0)
      )
      from public.v_collections_due c
    ),

    'low_stock', (
      select count(*)
      from public.v_stock st
      where st.is_low_stock and st.is_active and st.product_is_active
    ),

    'out_of_stock', (
      select count(*)
      from public.v_stock st
      where st.is_out_of_stock and st.is_active and st.product_is_active
    )
  );

  if public.is_admin() then
    v_result := v_result || jsonb_build_object(
      'cash', jsonb_build_object(
        'today', (select coalesce(sum(m.amount_cents), 0)
                  from public.v_cash_movements m where m.local_date = v_today),
        'week',  (select coalesce(sum(m.amount_cents), 0)
                  from public.v_cash_movements m
                  where m.local_date between v_week_start and v_today),
        'month', (select coalesce(sum(m.amount_cents), 0)
                  from public.v_cash_movements m
                  where m.local_date between v_month_start and v_today)
      ),
      'profit', jsonb_build_object(
        'today', (select coalesce(sum(d.profit_cents), 0)
                  from public.v_profit_daily d where d.local_date = v_today),
        'week',  (select coalesce(sum(d.profit_cents), 0)
                  from public.v_profit_daily d
                  where d.local_date between v_week_start and v_today),
        'month', (select coalesce(sum(d.profit_cents), 0)
                  from public.v_profit_daily d
                  where d.local_date between v_month_start and v_today)
      )
    );
  end if;

  return v_result;
end;
$$;
