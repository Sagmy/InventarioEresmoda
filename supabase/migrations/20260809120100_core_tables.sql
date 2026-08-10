-- =============================================================================
-- 0002 · Usuarios, catálogo, clientes y configuración
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidad: mantener updated_at sin depender de que la app lo recuerde
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Utilidad: centavos → texto legible, para los mensajes de error
-- -----------------------------------------------------------------------------
-- Un mensaje que diga "el abono mínimo es 5000" no lo entiende nadie en el
-- mostrador; tiene que decir "$50.00".
create or replace function public.format_cents(p_cents bigint)
returns text
language sql
immutable
as $$
  select '$' || to_char(coalesce(p_cents, 0)::numeric / 100, 'FM999999990.00')
$$;

-- -----------------------------------------------------------------------------
-- profiles · extiende auth.users con rol y estado
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (length(btrim(full_name)) between 1 and 120),
  role        public.user_role not null default 'seller',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where is_active;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers de autorización
-- -----------------------------------------------------------------------------
-- Se usan tanto en las políticas RLS como dentro de las funciones de negocio.
-- Son SECURITY DEFINER para poder leer `profiles` sin quedar atrapadas en la
-- propia RLS de esa tabla (lo que causaría recursión infinita en las políticas).

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

-- Cualquier usuario activo (admin o vendedor).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_role() is not null
$$;

-- Devuelve el id del usuario autenticado o levanta error. Toda función de
-- negocio arranca con esto: sin sesión válida no se escribe nada.
create or replace function public.require_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.is_active) then
    raise exception 'Tu usuario no está activo.' using errcode = '42501';
  end if;

  return v_uid;
end;
$$;

create or replace function public.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.require_staff();
begin
  if not public.is_admin() then
    raise exception 'Esta operación requiere rol de administrador.' using errcode = '42501';
  end if;

  return v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alta automática de perfil al registrarse
-- -----------------------------------------------------------------------------
-- El PRIMER usuario que se registra queda como admin y activo: es el arranque
-- del sistema.
--
-- Cualquier registro posterior entra como vendedor e INACTIVO. Esto importa: la
-- página de registro es alcanzable por quien tenga la dirección, y un usuario
-- inactivo no pasa `is_staff()`, así que no puede leer ni una fila. Un admin
-- tiene que activarlo a mano desde Ajustes para que exista de verdad.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, full_name, role, is_active)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    case when v_is_first then 'admin' else 'seller' end::public.user_role,
    v_is_first
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- settings · fila única con las reglas del negocio
-- -----------------------------------------------------------------------------
-- Las reglas viven aquí, no codificadas duro, para que se puedan cambiar desde
-- la pantalla de Ajustes sin tocar código ni redesplegar.
create table public.settings (
  id                        boolean primary key default true check (id),
  store_name                text not null default 'Eresmoda',
  currency_code             text not null default 'USD' check (length(currency_code) = 3),

  -- Zona horaria de la tienda. El "total del día" tiene que cerrar a medianoche
  -- LOCAL, no UTC; si no, las ventas de la noche caen en el día siguiente.
  -- Editable desde Ajustes. Se valida contra pg_timezone_names en un trigger,
  -- porque un CHECK exige funciones inmutables y esa consulta no lo es.
  timezone                  text not null default 'America/Caracas',

  -- Apartado: mínimo 50% de abono, 20 días de plazo, alerta al día 15.
  layaway_min_deposit_pct   numeric(5,2) not null default 50
                              check (layaway_min_deposit_pct between 0 and 100),
  layaway_term_days         integer not null default 20 check (layaway_term_days > 0),
  layaway_reminder_days     integer not null default 15 check (layaway_reminder_days > 0),

  -- Crédito: sin abono mínimo y SIN plazo (deuda abierta indefinidamente).
  -- Solo se avisa a los 14 días para salir a cobrar.
  credit_min_deposit_pct    numeric(5,2) not null default 0
                              check (credit_min_deposit_pct between 0 and 100),
  credit_reminder_days      integer not null default 14 check (credit_reminder_days > 0),

  low_stock_threshold       integer not null default 2 check (low_stock_threshold >= 0),

  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.profiles (id),

  constraint layaway_reminder_before_term
    check (layaway_reminder_days <= layaway_term_days)
);

insert into public.settings (id) values (true);

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

-- Una zona horaria inválida rompería todos los reportes de caja de forma
-- silenciosa, así que se rechaza en el momento de guardarla.
create or replace function public.validate_settings_timezone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_timezone_names z where z.name = new.timezone) then
    raise exception 'Zona horaria inválida: %', new.timezone using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger settings_validate_timezone
  before insert or update of timezone on public.settings
  for each row execute function public.validate_settings_timezone();

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 160),
  description  text check (description is null or length(description) <= 2000),
  brand        text check (brand is null or length(btrim(brand)) <= 80),
  category_id  uuid references public.categories (id) on delete set null,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_active_name_idx on public.products (is_active, name);
create index products_category_idx    on public.products (category_id);
create index products_name_trgm_idx   on public.products
  using gin (name extensions.gin_trgm_ops);

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- product_variants · la unidad real de inventario (producto + talla + color)
-- -----------------------------------------------------------------------------
create sequence public.sku_seq start 1;

create table public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  size          text not null default 'Única' check (length(btrim(size)) between 1 and 30),
  color         text not null default 'Único' check (length(btrim(color)) between 1 and 40),
  sku           text not null unique,

  price_cents   bigint not null check (price_cents >= 0),
  -- El COSTO no vive aquí: está en `variant_costs`, una tabla aparte con RLS de
  -- solo-admin. Así esta tabla puede ser legible por los vendedores (y por lo
  -- tanto emitir cambios en tiempo real) sin filtrar márgenes.

  -- ---------------------------------------------------------------------------
  -- Los tres números de stock. Este es el corazón del sistema.
  -- ---------------------------------------------------------------------------
  --   qty_on_hand   prendas físicamente en la tienda
  --   qty_reserved  comprometidas en apartados sin terminar de pagar
  --   qty_available lo que realmente se puede vender  (calculado por Postgres)
  --
  -- Con 5 camisas y 2 apartadas:  físico 5 · apartado 2 · DISPONIBLE 3
  qty_on_hand   integer not null default 0 check (qty_on_hand >= 0),
  qty_reserved  integer not null default 0 check (qty_reserved >= 0),
  qty_available integer generated always as (qty_on_hand - qty_reserved) stored,

  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- No se puede apartar más de lo que hay físicamente. Ni un bug de la
  -- aplicación puede dejar el inventario en un estado imposible.
  constraint variant_reserved_within_on_hand check (qty_reserved <= qty_on_hand),
  constraint variant_unique_combo unique (product_id, size, color)
);

create index variants_product_idx on public.product_variants (product_id);
create index variants_sku_idx     on public.product_variants (sku);
create index variants_low_stock_idx
  on public.product_variants (qty_available)
  where is_active;

create trigger variants_touch_updated_at
  before update on public.product_variants
  for each row execute function public.touch_updated_at();

-- SKU legible y automático si no se provee uno: ERM-000001, ERM-000002, …
create or replace function public.assign_sku()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(new.sku, '')), '') is null then
    new.sku := 'ERM-' || lpad(nextval('public.sku_seq')::text, 6, '0');
  else
    new.sku := upper(btrim(new.sku));
  end if;

  return new;
end;
$$;

create trigger variants_assign_sku
  before insert on public.product_variants
  for each row execute function public.assign_sku();

-- -----------------------------------------------------------------------------
-- variant_costs · el costo de compra, aislado del resto
-- -----------------------------------------------------------------------------
-- Tabla separada por una razón de seguridad, no de normalización: su RLS solo
-- admite admins, así que el costo y el margen jamás llegan al navegador de un
-- vendedor. No es que la interfaz los esconda: el dato no sale de la base.
create table public.variant_costs (
  variant_id  uuid primary key references public.product_variants (id) on delete cascade,
  cost_cents  bigint not null default 0 check (cost_cents >= 0),
  updated_at  timestamptz not null default now()
);

create trigger variant_costs_touch_updated_at
  before update on public.variant_costs
  for each row execute function public.touch_updated_at();

-- Toda variante nace con su fila de costo, para que ninguna consulta tenga que
-- preguntarse si existe.
create or replace function public.ensure_variant_cost_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.variant_costs (variant_id, cost_cents)
  values (new.id, 0)
  on conflict (variant_id) do nothing;

  return new;
end;
$$;

create trigger variants_ensure_cost_row
  after insert on public.product_variants
  for each row execute function public.ensure_variant_cost_row();

-- -----------------------------------------------------------------------------
-- customers · indispensable para apartados y créditos
-- -----------------------------------------------------------------------------
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (length(btrim(full_name)) between 1 and 120),
  phone        text check (phone is null or length(btrim(phone)) between 5 and 30),
  document_id  text check (document_id is null or length(btrim(document_id)) <= 30),
  notes        text check (notes is null or length(notes) <= 2000),
  is_active    boolean not null default true,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index customers_name_trgm_idx  on public.customers
  using gin (full_name extensions.gin_trgm_ops);
create index customers_phone_trgm_idx on public.customers
  using gin (coalesce(phone, '') extensions.gin_trgm_ops);

create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();
