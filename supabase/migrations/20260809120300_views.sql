-- =============================================================================
-- 0004 · Vistas de lectura
-- =============================================================================
-- Nota sobre seguridad: estas vistas se crean con `security_invoker = false`
-- (el comportamiento por defecto de Postgres), o sea que corren con los
-- privilegios de su dueño y NO aplican la RLS de las tablas base. Se hace así
-- para poder cruzar varias tablas sin evaluar sus políticas fila por fila.
--
-- Como la RLS queda puenteada, CADA vista lleva su propio guardián
-- (`public.is_staff()` o `public.is_admin()`) en el WHERE. Sin sesión válida,
-- devuelven cero filas.
--
-- El aislamiento de los costos NO depende de estas vistas: vive en las tablas
-- `variant_costs` y `order_item_costs`, cuya RLS solo admite administradores.
-- Las vistas de reporte que los cruzan exigen `is_admin()` de forma explícita.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_stock · inventario para todo el personal (SIN costos)
-- -----------------------------------------------------------------------------
create view public.v_stock
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

  -- Los tres números. `qty_available` es la que manda para poder vender.
  v.qty_on_hand,
  v.qty_reserved,
  v.qty_available,

  (v.qty_available <= s.low_stock_threshold) as is_low_stock,

  v.is_active,
  p.is_active     as product_is_active,
  v.created_at,
  v.updated_at
from public.product_variants v
join public.products p       on p.id = v.product_id
left join public.categories c on c.id = p.category_id
cross join public.settings s
where public.is_staff();

comment on view public.v_stock is
  'Inventario visible para admin y vendedor: producto, variante y los tres '
  'números de stock. El costo vive en variant_costs, fuera del alcance de esta vista.';

-- -----------------------------------------------------------------------------
-- v_order_balances · cuánto se ha pagado y cuánto falta
-- -----------------------------------------------------------------------------
create view public.v_order_balances
with (security_invoker = false) as
select
  o.id                                            as order_id,
  o.total_cents,
  coalesce(pay.paid_cents, 0)                     as paid_cents,
  o.total_cents - coalesce(pay.paid_cents, 0)     as balance_cents,

  case
    when o.status = 'cancelled'                     then 'cancelado'
    when coalesce(pay.paid_cents, 0) >= o.total_cents then 'pagado'
    when coalesce(pay.paid_cents, 0) > 0            then 'parcial'
    else                                                 'pendiente'
  end                                             as payment_status,

  -- Para la barra de progreso: "$50 de $100 · faltan $50"
  case
    when o.total_cents > 0
      then least(100, round(coalesce(pay.paid_cents, 0)::numeric * 100 / o.total_cents, 1))
    else 100
  end                                             as paid_pct,

  coalesce(pay.payment_count, 0)                  as payment_count,
  pay.first_payment_at,
  pay.last_payment_at
from public.orders o
left join lateral (
  select
    sum(p.amount_cents) as paid_cents,
    count(*)            as payment_count,
    min(p.paid_at)      as first_payment_at,
    max(p.paid_at)      as last_payment_at
  from public.payments p
  where p.order_id = o.id
    and p.voided_at is null
) pay on true
where public.is_staff();

-- -----------------------------------------------------------------------------
-- v_orders · listado de transacciones para la interfaz (SIN costos)
-- -----------------------------------------------------------------------------
create view public.v_orders
with (security_invoker = false) as
select
  o.id,
  o.order_number,
  o.type,
  o.status,
  o.price_kind,
  o.customer_id,
  cu.full_name        as customer_name,
  cu.phone            as customer_phone,
  o.subtotal_cents,
  o.discount_cents,
  o.total_cents,
  b.paid_cents,
  b.balance_cents,
  b.payment_status,
  b.paid_pct,
  b.last_payment_at,
  o.due_date,
  o.notes,
  o.created_by,
  pr.full_name        as created_by_name,
  o.created_at,
  o.completed_at,
  o.cancelled_at,
  o.cancel_reason,
  (select count(*) from public.order_items i where i.order_id = o.id) as item_count
from public.orders o
join public.v_order_balances b on b.order_id = o.id
left join public.customers cu  on cu.id = o.customer_id
left join public.profiles pr   on pr.id = o.created_by
where public.is_staff();

-- -----------------------------------------------------------------------------
-- v_order_items · líneas de venta para la interfaz (SIN costos)
-- -----------------------------------------------------------------------------
create view public.v_order_items
with (security_invoker = false) as
select
  i.id,
  i.order_id,
  i.variant_id,
  i.product_name,
  i.variant_label,
  i.qty,
  i.unit_list_price_cents,
  i.unit_price_cents,
  i.line_total_cents,
  (i.unit_list_price_cents - i.unit_price_cents) * i.qty as line_discount_cents,
  coalesce(ret.returned_qty, 0)                          as returned_qty
from public.order_items i
left join lateral (
  select sum(ri.qty) as returned_qty
  from public.return_items ri
  where ri.order_item_id = i.id
) ret on true
where public.is_staff();

-- -----------------------------------------------------------------------------
-- v_collections_due · panel de cobros con semáforo
-- -----------------------------------------------------------------------------
-- Apartados y créditos abiertos, juntos y ordenables por urgencia.
--
--   APARTADO (plazo 20 días, alerta al 15)
--     verde    días 0–14
--     amarillo día 15+   → toca cobrar
--     rojo     pasado el vencimiento
--
--   CRÉDITO (plazo INDEFINIDO, alerta al 14)
--     verde    días 0–13
--     amarillo día 14 en adelante → toca cobrar
--     rojo     nunca: sin vencimiento no hay nada que vencer.
--              Se ordenan por antigüedad para que las deudas más viejas
--              queden siempre arriba.
create view public.v_collections_due
with (security_invoker = false) as
select
  o.id                as order_id,
  o.order_number,
  o.type,
  o.customer_id,
  cu.full_name        as customer_name,
  cu.phone            as customer_phone,
  o.total_cents,
  b.paid_cents,
  b.balance_cents,
  b.paid_pct,
  b.payment_status,
  b.last_payment_at,
  o.created_at,
  o.due_date,

  (current_date - (o.created_at at time zone s.timezone)::date) as days_elapsed,

  case
    when o.type = 'apartado' then (o.due_date - current_date)
    else null
  end                 as days_left,

  case
    when o.type = 'apartado' and current_date > o.due_date
      then 'rojo'
    when o.type = 'apartado'
         and (current_date - (o.created_at at time zone s.timezone)::date) >= s.layaway_reminder_days
      then 'amarillo'
    when o.type = 'credito'
         and (current_date - (o.created_at at time zone s.timezone)::date) >= s.credit_reminder_days
      then 'amarillo'
    else 'verde'
  end                 as alert_level,

  -- Para ordenar de una sola pasada: rojo primero, luego amarillo, luego verde.
  case
    when o.type = 'apartado' and current_date > o.due_date then 0
    when o.type = 'apartado'
         and (current_date - (o.created_at at time zone s.timezone)::date) >= s.layaway_reminder_days then 1
    when o.type = 'credito'
         and (current_date - (o.created_at at time zone s.timezone)::date) >= s.credit_reminder_days then 1
    else 2
  end                 as urgency_rank
from public.orders o
join public.v_order_balances b on b.order_id = o.id
left join public.customers cu  on cu.id = o.customer_id
cross join public.settings s
where o.status = 'open'
  and o.type in ('apartado', 'credito')
  and public.is_staff();

-- =============================================================================
-- Reportes · SOLO ADMIN
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_cash_movements · todo el dinero que entra y sale, en base CAJA
-- -----------------------------------------------------------------------------
-- Base caja según lo pedido: cuenta el dinero el día en que efectivamente se
-- recibe. Un apartado pagado en tres abonos aparece repartido en tres días.
-- Las devoluciones con reembolso entran como monto NEGATIVO.
create view public.v_cash_movements
with (security_invoker = false) as
select
  p.id                                        as source_id,
  'payment'                                   as source,
  p.order_id,
  o.type                                      as order_type,
  p.amount_cents,
  p.method,
  p.paid_at                                   as occurred_at,
  (p.paid_at at time zone s.timezone)::date   as local_date,
  p.created_by
from public.payments p
join public.orders o   on o.id = p.order_id
cross join public.settings s
where p.voided_at is null
  and public.is_admin()

union all

select
  r.id,
  'refund',
  r.order_id,
  o.type,
  -r.refund_cents,
  r.refund_method,
  r.created_at,
  (r.created_at at time zone s.timezone)::date,
  r.created_by
from public.returns r
join public.orders o   on o.id = r.order_id
cross join public.settings s
where r.refund_cents > 0
  and public.is_admin();

-- -----------------------------------------------------------------------------
-- v_cash_daily · caja por día y por método de pago
-- -----------------------------------------------------------------------------
create view public.v_cash_daily
with (security_invoker = false) as
select
  m.local_date,
  m.method,
  sum(m.amount_cents)                                   as net_cents,
  sum(m.amount_cents) filter (where m.amount_cents > 0) as in_cents,
  -coalesce(sum(m.amount_cents) filter (where m.amount_cents < 0), 0) as out_cents,
  count(*) filter (where m.amount_cents > 0)            as movements_in,
  count(*) filter (where m.amount_cents < 0)            as movements_out
from public.v_cash_movements m
group by m.local_date, m.method;

-- -----------------------------------------------------------------------------
-- v_order_margin · ganancia por transacción, neta de devoluciones
-- -----------------------------------------------------------------------------
-- La mercancía "sale" en momentos distintos según el tipo:
--   contado y crédito → al crearse la orden
--   apartado          → al terminar de pagarse
-- Un apartado abierto todavía no cuenta como venta: la prenda sigue en tienda.
create view public.v_order_margin
with (security_invoker = false) as
select
  o.id                as order_id,
  o.order_number,
  o.type,
  o.price_kind,
  case when o.type = 'apartado' then o.completed_at else o.created_at end as goods_out_at,
  (
    (case when o.type = 'apartado' then o.completed_at else o.created_at end)
    at time zone s.timezone
  )::date             as local_date,

  sum((i.qty - coalesce(ret.returned_qty, 0)) * i.unit_price_cents)
    - o.discount_cents                                        as revenue_cents,
  sum((i.qty - coalesce(ret.returned_qty, 0)) * coalesce(ic.unit_cost_cents, 0)) as cogs_cents,
  sum((i.qty - coalesce(ret.returned_qty, 0)) * i.unit_price_cents)
    - o.discount_cents
    - sum((i.qty - coalesce(ret.returned_qty, 0)) * coalesce(ic.unit_cost_cents, 0)) as profit_cents,

  -- Cuánto se dejó de cobrar respecto al precio de lista (promos y rebajas).
  sum((i.qty - coalesce(ret.returned_qty, 0)) * (i.unit_list_price_cents - i.unit_price_cents))
                                                              as discount_given_cents,
  sum(i.qty - coalesce(ret.returned_qty, 0))                  as units_sold
from public.orders o
join public.order_items i            on i.order_id = o.id
left join public.order_item_costs ic on ic.order_item_id = i.id
cross join public.settings s
left join lateral (
  select sum(ri.qty) as returned_qty
  from public.return_items ri
  where ri.order_item_id = i.id
) ret on true
where o.status <> 'cancelled'
  and (o.type <> 'apartado' or o.status = 'completed')
  and public.is_admin()
group by o.id, s.timezone;

comment on view public.v_order_margin is
  'Margen por orden, neto de devoluciones. El descuento global de la orden se '
  'resta completo aunque haya devoluciones parciales; en v1 la app aplica las '
  'promos a nivel de línea (discount_cents = 0), así que el caso no se presenta.';

-- -----------------------------------------------------------------------------
-- v_profit_daily · ganancia por día
-- -----------------------------------------------------------------------------
create view public.v_profit_daily
with (security_invoker = false) as
select
  m.local_date,
  sum(m.revenue_cents)          as revenue_cents,
  sum(m.cogs_cents)             as cogs_cents,
  sum(m.profit_cents)           as profit_cents,
  sum(m.discount_given_cents)   as discount_given_cents,
  sum(m.units_sold)             as units_sold,
  count(*)                      as orders_count
from public.v_order_margin m
where m.local_date is not null
group by m.local_date;
