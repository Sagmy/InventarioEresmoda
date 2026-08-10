-- =============================================================================
-- 0008 · Reportes
-- =============================================================================
-- Base CAJA, según lo pedido: el dinero cuenta el día en que efectivamente se
-- recibe. Un apartado pagado en tres abonos aparece repartido en tres días,
-- porque eso es lo que se puede cuadrar contra el efectivo y las transferencias.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- report_cash · serie de caja por día, semana o mes
-- -----------------------------------------------------------------------------
create or replace function public.report_cash(
  p_from        date default null,
  p_to          date default null,
  p_granularity text default 'day'
)
returns table (
  bucket        date,
  in_cents      bigint,
  out_cents     bigint,
  net_cents     bigint,
  movements_in  bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz   text;
  v_from date;
  v_to   date;
begin
  perform public.require_admin();

  if p_granularity not in ('day', 'week', 'month') then
    raise exception 'Granularidad inválida: usa day, week o month.' using errcode = '22023';
  end if;

  select s.timezone into v_tz from public.settings s where s.id;

  v_to   := coalesce(p_to, (now() at time zone v_tz)::date);
  v_from := coalesce(p_from, v_to - 29);

  if v_from > v_to then
    raise exception 'La fecha inicial es posterior a la final.' using errcode = '22023';
  end if;

  return query
  select
    (date_trunc(p_granularity, m.local_date::timestamp))::date,
    coalesce(sum(m.amount_cents) filter (where m.amount_cents > 0), 0)::bigint,
    coalesce(-sum(m.amount_cents) filter (where m.amount_cents < 0), 0)::bigint,
    coalesce(sum(m.amount_cents), 0)::bigint,
    count(*) filter (where m.amount_cents > 0)::bigint
  from public.v_cash_movements m
  where m.local_date between v_from and v_to
  group by 1
  order by 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- report_cash_by_method · desglose para cuadrar la caja al cierre
-- -----------------------------------------------------------------------------
create or replace function public.report_cash_by_method(
  p_from date default null,
  p_to   date default null
)
returns table (
  method     public.payment_method,
  in_cents   bigint,
  out_cents  bigint,
  net_cents  bigint,
  movements  bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz   text;
  v_from date;
  v_to   date;
begin
  perform public.require_admin();

  select s.timezone into v_tz from public.settings s where s.id;

  v_to   := coalesce(p_to, (now() at time zone v_tz)::date);
  v_from := coalesce(p_from, v_to);

  return query
  select
    m.method,
    coalesce(sum(m.amount_cents) filter (where m.amount_cents > 0), 0)::bigint,
    coalesce(-sum(m.amount_cents) filter (where m.amount_cents < 0), 0)::bigint,
    coalesce(sum(m.amount_cents), 0)::bigint,
    count(*)::bigint
  from public.v_cash_movements m
  where m.local_date between v_from and v_to
  group by m.method
  order by 3 desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- report_profit · ventas y ganancia por período
-- -----------------------------------------------------------------------------
-- A diferencia de la caja, aquí la venta cuenta el día en que la MERCANCÍA salió
-- de la tienda. Son dos preguntas distintas: cuánto cuadro en caja hoy, y cuánto
-- vendí de verdad hoy.
create or replace function public.report_profit(
  p_from        date default null,
  p_to          date default null,
  p_granularity text default 'day'
)
returns table (
  bucket                date,
  revenue_cents         bigint,
  cogs_cents            bigint,
  profit_cents          bigint,
  discount_given_cents  bigint,
  units_sold            bigint,
  orders_count          bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz   text;
  v_from date;
  v_to   date;
begin
  perform public.require_admin();

  if p_granularity not in ('day', 'week', 'month') then
    raise exception 'Granularidad inválida: usa day, week o month.' using errcode = '22023';
  end if;

  select s.timezone into v_tz from public.settings s where s.id;

  v_to   := coalesce(p_to, (now() at time zone v_tz)::date);
  v_from := coalesce(p_from, v_to - 29);

  return query
  select
    (date_trunc(p_granularity, d.local_date::timestamp))::date,
    sum(d.revenue_cents)::bigint,
    sum(d.cogs_cents)::bigint,
    sum(d.profit_cents)::bigint,
    sum(d.discount_given_cents)::bigint,
    sum(d.units_sold)::bigint,
    sum(d.orders_count)::bigint
  from public.v_profit_daily d
  where d.local_date between v_from and v_to
  group by 1
  order by 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- report_top_products · qué se está vendiendo
-- -----------------------------------------------------------------------------
create or replace function public.report_top_products(
  p_from  date default null,
  p_to    date default null,
  p_limit integer default 10
)
returns table (
  variant_id     uuid,
  label          text,
  sku            text,
  units_sold     bigint,
  revenue_cents  bigint,
  profit_cents   bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz   text;
  v_from date;
  v_to   date;
begin
  perform public.require_admin();

  select s.timezone into v_tz from public.settings s where s.id;

  v_to   := coalesce(p_to, (now() at time zone v_tz)::date);
  v_from := coalesce(p_from, v_to - 29);

  return query
  select
    i.variant_id,
    max(i.variant_label),
    max(v.sku),
    sum(i.qty - coalesce(ret.returned_qty, 0))::bigint,
    sum((i.qty - coalesce(ret.returned_qty, 0)) * i.unit_price_cents)::bigint,
    sum((i.qty - coalesce(ret.returned_qty, 0))
        * (i.unit_price_cents - coalesce(ic.unit_cost_cents, 0)))::bigint
  from public.order_items i
  join public.orders o                 on o.id = i.order_id
  join public.product_variants v       on v.id = i.variant_id
  left join public.order_item_costs ic on ic.order_item_id = i.id
  cross join public.settings s
  left join lateral (
    select sum(ri.qty) as returned_qty
    from public.return_items ri
    where ri.order_item_id = i.id
  ) ret on true
  where o.status <> 'cancelled'
    and (o.type <> 'apartado' or o.status = 'completed')
    and (
      (case when o.type = 'apartado' then o.completed_at else o.created_at end)
      at time zone s.timezone
    )::date between v_from and v_to
  group by i.variant_id
  having sum(i.qty - coalesce(ret.returned_qty, 0)) > 0
  order by 4 desc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
end;
$$;

-- -----------------------------------------------------------------------------
-- dashboard_summary · todo lo del tablero en una sola llamada
-- -----------------------------------------------------------------------------
-- Una sola ida al servidor en vez de seis. Las cifras de dinero solo se incluyen
-- si quien pregunta es admin; a un vendedor sencillamente no le llegan.
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
      where st.is_low_stock
        and st.is_active
        and st.product_is_active
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
