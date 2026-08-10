-- =============================================================================
-- 0003 · Transacciones: ventas, pagos, devoluciones y libro de inventario
-- =============================================================================
-- Todo el dinero se guarda en CENTAVOS enteros (bigint), nunca en decimales
-- flotantes. Sumar cien ventas con floats descuadra la caja por centavos.
-- =============================================================================

create sequence public.order_number_seq  start 1000;
create sequence public.return_number_seq start 1;

-- -----------------------------------------------------------------------------
-- orders · una transacción, de cualquiera de los tres tipos
-- -----------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    bigint not null unique default nextval('public.order_number_seq'),

  type            public.order_type not null,
  status          public.order_status not null default 'open',
  price_kind      public.price_kind not null default 'normal',

  customer_id     uuid references public.customers (id) on delete restrict,

  subtotal_cents  bigint not null check (subtotal_cents >= 0),
  discount_cents  bigint not null default 0 check (discount_cents >= 0),
  total_cents     bigint not null check (total_cents >= 0),

  -- Solo los apartados tienen fecha límite (20 días). Los créditos son de plazo
  -- INDEFINIDO por decisión del negocio, así que su due_date queda siempre nulo.
  due_date        date,

  notes           text check (notes is null or length(notes) <= 2000),

  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,

  -- Las promociones solo existen en ventas de contado.
  constraint order_promo_only_contado
    check (price_kind <> 'promo' or type = 'contado'),

  -- Apartados y créditos exigen cliente identificado: hay que saber a quién cobrar.
  constraint order_customer_required
    check (type = 'contado' or customer_id is not null),

  -- El apartado vence; el contado y el crédito no tienen fecha límite.
  constraint order_due_date_rules
    check (
      case when type = 'apartado'
        then due_date is not null
        else due_date is null
      end
    ),

  constraint order_discount_within_subtotal
    check (discount_cents <= subtotal_cents),

  constraint order_total_math
    check (total_cents = subtotal_cents - discount_cents),

  -- Las marcas de tiempo no pueden contradecir al estado.
  constraint order_status_timestamps
    check (
      case status
        when 'open'      then completed_at is null and cancelled_at is null
        when 'completed' then completed_at is not null and cancelled_at is null
        when 'cancelled' then cancelled_at is not null and completed_at is null
      end
    )
);

create index orders_type_status_idx  on public.orders (type, status, created_at desc);
create index orders_customer_idx     on public.orders (customer_id) where customer_id is not null;
create index orders_open_idx         on public.orders (type, due_date) where status = 'open';
create index orders_created_at_idx   on public.orders (created_at desc);

-- -----------------------------------------------------------------------------
-- order_items · líneas de la transacción, con precios y costo CONGELADOS
-- -----------------------------------------------------------------------------
-- Los snapshots no son opcionales: si mañana sube el precio de una camisa, los
-- reportes del mes pasado no pueden cambiar. El precio de lista, el precio
-- realmente cobrado y el costo del momento quedan grabados en la línea.
create table public.order_items (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders (id) on delete cascade,
  variant_id             uuid not null references public.product_variants (id) on delete restrict,

  qty                    integer not null check (qty > 0),

  unit_list_price_cents  bigint not null check (unit_list_price_cents >= 0),
  unit_price_cents       bigint not null check (unit_price_cents >= 0),
  line_total_cents       bigint not null check (line_total_cents >= 0),
  -- El costo congelado de esta línea vive en `order_item_costs` (solo-admin),
  -- por la misma razón que en el catálogo: que el vendedor pueda leer la venta
  -- sin poder deducir el margen.

  -- Descripción congelada, para que el histórico sobreviva a renombres.
  product_name           text not null,
  variant_label          text not null,

  constraint item_line_math
    check (line_total_cents = unit_price_cents * qty),

  -- No se puede vender por encima del precio de lista disfrazándolo de promo.
  constraint item_price_not_above_list
    check (unit_price_cents <= unit_list_price_cents)
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

-- Costo congelado de cada línea, aislado para que solo lo lea un admin.
create table public.order_item_costs (
  order_item_id    uuid primary key references public.order_items (id) on delete cascade,
  unit_cost_cents  bigint not null default 0 check (unit_cost_cents >= 0)
);

-- -----------------------------------------------------------------------------
-- payments · cada abono por separado, con su propio método
-- -----------------------------------------------------------------------------
-- El método va por PAGO y no por venta: un apartado con tres abonos puede tener
-- efectivo, Pago Móvil y Zelle, y así la caja cuadra por método al cierre.
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,

  amount_cents  bigint not null check (amount_cents > 0),
  method        public.payment_method not null,
  reference     text check (reference is null or length(btrim(reference)) <= 80),
  notes         text check (notes is null or length(notes) <= 500),

  paid_at       timestamptz not null default now(),
  created_by    uuid not null references public.profiles (id),
  created_at    timestamptz not null default now(),

  -- Los pagos no se borran: se anulan dejando rastro.
  voided_at     timestamptz,
  voided_by     uuid references public.profiles (id),
  void_reason   text,

  constraint payment_void_consistency
    check (
      (voided_at is null and voided_by is null and void_reason is null)
      or (voided_at is not null and voided_by is not null)
    )
);

create index payments_order_active_idx on public.payments (order_id) where voided_at is null;
create index payments_paid_at_idx      on public.payments (paid_at desc) where voided_at is null;
create index payments_method_idx       on public.payments (method, paid_at) where voided_at is null;

-- -----------------------------------------------------------------------------
-- returns · devoluciones y cambios
-- -----------------------------------------------------------------------------
create table public.returns (
  id                    uuid primary key default gen_random_uuid(),
  return_number         bigint not null unique default nextval('public.return_number_seq'),
  order_id              uuid not null references public.orders (id) on delete restrict,

  type                  public.return_type not null,
  refund_cents          bigint not null default 0 check (refund_cents >= 0),
  refund_method         public.payment_method,
  restocked             boolean not null default true,

  -- En un cambio, la orden nueva que reemplaza a la devuelta.
  replacement_order_id  uuid references public.orders (id) on delete set null,

  notes                 text check (notes is null or length(notes) <= 2000),
  created_by            uuid not null references public.profiles (id),
  created_at            timestamptz not null default now(),

  constraint return_exchange_needs_replacement
    check (type <> 'cambio' or replacement_order_id is not null),

  constraint return_refund_needs_method
    check (refund_cents = 0 or refund_method is not null),

  constraint return_not_self_referencing
    check (replacement_order_id is null or replacement_order_id <> order_id)
);

create index returns_order_idx      on public.returns (order_id);
create index returns_created_at_idx on public.returns (created_at desc);

create table public.return_items (
  id             uuid primary key default gen_random_uuid(),
  return_id      uuid not null references public.returns (id) on delete cascade,
  order_item_id  uuid not null references public.order_items (id) on delete restrict,
  qty            integer not null check (qty > 0),

  constraint return_item_unique unique (return_id, order_item_id)
);

create index return_items_return_idx on public.return_items (return_id);
create index return_items_item_idx   on public.return_items (order_item_id);

-- -----------------------------------------------------------------------------
-- stock_movements · libro append-only de inventario
-- -----------------------------------------------------------------------------
-- Nunca se actualiza ni se borra: solo se agregan renglones. Es la auditoría que
-- permite responder "¿por qué tengo 3 y no 5?" reconstruyendo la historia
-- completa de cada variante.
create table public.stock_movements (
  id               bigint generated always as identity primary key,
  variant_id       uuid not null references public.product_variants (id) on delete restrict,

  delta_on_hand    integer not null default 0,
  delta_reserved   integer not null default 0,
  reason           public.stock_reason not null,

  order_id         uuid references public.orders (id) on delete set null,
  return_id        uuid references public.returns (id) on delete set null,

  unit_cost_cents  bigint check (unit_cost_cents is null or unit_cost_cents >= 0),
  note             text check (note is null or length(note) <= 500),

  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),

  constraint movement_not_empty
    check (delta_on_hand <> 0 or delta_reserved <> 0)
);

create index movements_variant_idx    on public.stock_movements (variant_id, created_at desc);
create index movements_order_idx      on public.stock_movements (order_id) where order_id is not null;
create index movements_created_at_idx on public.stock_movements (created_at desc);
