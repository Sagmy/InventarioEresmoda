-- =============================================================================
-- 0009 · Catálogo, clientes, ajustes y usuarios
-- =============================================================================
-- Como el navegador no puede escribir directo en ninguna tabla, hasta el alta de
-- un producto pasa por aquí. El precio y el costo solo los toca un admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- upsert_category
-- -----------------------------------------------------------------------------
create or replace function public.upsert_category(
  p_name text,
  p_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.require_admin();

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'La categoría necesita un nombre.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.categories (name) values (btrim(p_name)) returning id into v_id;
  else
    update public.categories set name = btrim(p_name) where id = p_id returning id into v_id;

    if v_id is null then
      raise exception 'La categoría no existe.' using errcode = '23503';
    end if;
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_product · producto con sus variantes y stock inicial
-- -----------------------------------------------------------------------------
-- p_variants : [{ "size": text, "color": text, "price_cents": bigint,
--                 "cost_cents": bigint?, "qty": int?, "sku": text? }]
create or replace function public.create_product(
  p_name        text,
  p_variants    jsonb,
  p_description text default null,
  p_brand       text default null,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor      uuid := public.require_admin();
  v_product_id uuid;
  v_variant    record;
  v_variant_id uuid;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'El producto necesita un nombre.' using errcode = '22023';
  end if;

  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) = 0 then
    raise exception 'Agrega al menos una talla o color.' using errcode = '22023';
  end if;

  insert into public.products (name, description, brand, category_id, created_by)
  values (
    btrim(p_name),
    nullif(btrim(p_description), ''),
    nullif(btrim(p_brand), ''),
    p_category_id,
    v_actor
  )
  returning id into v_product_id;

  for v_variant in
    select
      coalesce(nullif(btrim(e ->> 'size'), ''), 'Única')  as size,
      coalesce(nullif(btrim(e ->> 'color'), ''), 'Único') as color,
      nullif(btrim(e ->> 'sku'), '')                      as sku,
      (e ->> 'price_cents')::bigint                       as price_cents,
      coalesce((e ->> 'cost_cents')::bigint, 0)           as cost_cents,
      coalesce((e ->> 'qty')::integer, 0)                 as qty
    from jsonb_array_elements(p_variants) e
  loop
    if v_variant.price_cents is null or v_variant.price_cents < 0 then
      raise exception 'Cada talla necesita un precio válido.' using errcode = '22023';
    end if;

    if v_variant.qty < 0 then
      raise exception 'La cantidad inicial no puede ser negativa.' using errcode = '22023';
    end if;

    insert into public.product_variants (
      product_id, size, color, sku, price_cents
    )
    values (
      v_product_id, v_variant.size, v_variant.color, v_variant.sku,
      v_variant.price_cents
    )
    returning id into v_variant_id;

    -- La fila de costo ya la creó el trigger; aquí solo se le pone el valor.
    update public.variant_costs
    set cost_cents = v_variant.cost_cents
    where variant_id = v_variant_id;

    -- El stock inicial entra por el mismo camino que cualquier otra mercancía,
    -- para que quede su renglón en el libro de movimientos.
    if v_variant.qty > 0 then
      perform app_private.apply_stock_movement(
        p_variant_id      => v_variant_id,
        p_delta_on_hand   => v_variant.qty,
        p_delta_reserved  => 0,
        p_reason          => 'purchase_in',
        p_actor           => v_actor,
        p_unit_cost_cents => v_variant.cost_cents,
        p_note            => 'Carga inicial'
      );
    end if;
  end loop;

  return v_product_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- update_product
-- -----------------------------------------------------------------------------
create or replace function public.update_product(
  p_id          uuid,
  p_name        text    default null,
  p_description text    default null,
  p_brand       text    default null,
  p_category_id uuid    default null,
  p_is_active   boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();

  update public.products
  set name        = coalesce(nullif(btrim(p_name), ''), name),
      description = coalesce(nullif(btrim(p_description), ''), description),
      brand       = coalesce(nullif(btrim(p_brand), ''), brand),
      category_id = coalesce(p_category_id, category_id),
      is_active   = coalesce(p_is_active, is_active)
  where id = p_id;

  if not found then
    raise exception 'El producto no existe.' using errcode = '23503';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_variant · agregar una talla o color a un producto existente
-- -----------------------------------------------------------------------------
create or replace function public.create_variant(
  p_product_id  uuid,
  p_price_cents bigint,
  p_size        text   default 'Única',
  p_color       text   default 'Único',
  p_cost_cents  bigint default 0,
  p_qty         integer default 0,
  p_sku         text   default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.require_admin();
  v_id    uuid;
begin
  if p_price_cents is null or p_price_cents < 0 then
    raise exception 'La talla necesita un precio válido.' using errcode = '22023';
  end if;

  if coalesce(p_qty, 0) < 0 then
    raise exception 'La cantidad inicial no puede ser negativa.' using errcode = '22023';
  end if;

  insert into public.product_variants (
    product_id, size, color, sku, price_cents
  )
  values (
    p_product_id,
    coalesce(nullif(btrim(p_size), ''), 'Única'),
    coalesce(nullif(btrim(p_color), ''), 'Único'),
    nullif(btrim(p_sku), ''),
    p_price_cents
  )
  returning id into v_id;

  update public.variant_costs
  set cost_cents = coalesce(p_cost_cents, 0)
  where variant_id = v_id;

  if coalesce(p_qty, 0) > 0 then
    perform app_private.apply_stock_movement(
      p_variant_id      => v_id,
      p_delta_on_hand   => p_qty,
      p_delta_reserved  => 0,
      p_reason          => 'purchase_in',
      p_actor           => v_actor,
      p_unit_cost_cents => p_cost_cents,
      p_note            => 'Carga inicial'
    );
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- update_variant
-- -----------------------------------------------------------------------------
-- Nunca toca las cantidades: el stock solo se mueve por venta, entrada, ajuste o
-- devolución, y siempre dejando rastro en el libro. Un "editar" que cambie el
-- stock a mano es justo por donde se corrompen estos sistemas.
create or replace function public.update_variant(
  p_id          uuid,
  p_size        text    default null,
  p_color       text    default null,
  p_price_cents bigint  default null,
  p_cost_cents  bigint  default null,
  p_is_active   boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();

  if p_price_cents is not null and p_price_cents < 0 then
    raise exception 'El precio no puede ser negativo.' using errcode = '22023';
  end if;

  if p_cost_cents is not null and p_cost_cents < 0 then
    raise exception 'El costo no puede ser negativo.' using errcode = '22023';
  end if;

  update public.product_variants
  set size        = coalesce(nullif(btrim(p_size), ''), size),
      color       = coalesce(nullif(btrim(p_color), ''), color),
      price_cents = coalesce(p_price_cents, price_cents),
      is_active   = coalesce(p_is_active, is_active)
  where id = p_id;

  if not found then
    raise exception 'La talla no existe.' using errcode = '23503';
  end if;

  if p_cost_cents is not null then
    insert into public.variant_costs (variant_id, cost_cents)
    values (p_id, p_cost_cents)
    on conflict (variant_id) do update set cost_cents = excluded.cost_cents;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- upsert_customer · lo puede hacer cualquier vendedor desde el mostrador
-- -----------------------------------------------------------------------------
create or replace function public.upsert_customer(
  p_full_name   text,
  p_id          uuid    default null,
  p_phone       text    default null,
  p_document_id text    default null,
  p_notes       text    default null,
  p_is_active   boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.require_staff();
  v_id    uuid;
begin
  if nullif(btrim(coalesce(p_full_name, '')), '') is null then
    raise exception 'El cliente necesita un nombre.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.customers (full_name, phone, document_id, notes, created_by)
    values (
      btrim(p_full_name),
      nullif(btrim(p_phone), ''),
      nullif(btrim(p_document_id), ''),
      nullif(btrim(p_notes), ''),
      v_actor
    )
    returning id into v_id;
  else
    update public.customers
    set full_name   = btrim(p_full_name),
        phone       = coalesce(nullif(btrim(p_phone), ''), phone),
        document_id = coalesce(nullif(btrim(p_document_id), ''), document_id),
        notes       = coalesce(nullif(btrim(p_notes), ''), notes),
        is_active   = coalesce(p_is_active, is_active)
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'El cliente no existe.' using errcode = '23503';
    end if;
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- update_settings · las reglas del negocio, editables sin tocar código
-- -----------------------------------------------------------------------------
create or replace function public.update_settings(
  p_store_name              text    default null,
  p_timezone                text    default null,
  p_layaway_min_deposit_pct numeric default null,
  p_layaway_term_days       integer default null,
  p_layaway_reminder_days   integer default null,
  p_credit_min_deposit_pct  numeric default null,
  p_credit_reminder_days    integer default null,
  p_low_stock_threshold     integer default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.require_admin();
begin
  update public.settings
  set store_name              = coalesce(nullif(btrim(p_store_name), ''), store_name),
      timezone                = coalesce(nullif(btrim(p_timezone), ''), timezone),
      layaway_min_deposit_pct = coalesce(p_layaway_min_deposit_pct, layaway_min_deposit_pct),
      layaway_term_days       = coalesce(p_layaway_term_days, layaway_term_days),
      layaway_reminder_days   = coalesce(p_layaway_reminder_days, layaway_reminder_days),
      credit_min_deposit_pct  = coalesce(p_credit_min_deposit_pct, credit_min_deposit_pct),
      credit_reminder_days    = coalesce(p_credit_reminder_days, credit_reminder_days),
      low_stock_threshold     = coalesce(p_low_stock_threshold, low_stock_threshold),
      updated_by              = v_actor
  where id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gestión de usuarios
-- -----------------------------------------------------------------------------
-- El rol no se puede cambiar escribiendo en `profiles`: la RLS lo impide. Tiene
-- que pasar por aquí, donde se comprueba que nunca quede la tienda sin admin
-- (dejarse fuera del propio sistema es un error del que no se sale solo).
create or replace function public.set_user_role(
  p_user_id uuid,
  p_role    public.user_role
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();

  if p_role <> 'admin' and not exists (
    select 1 from public.profiles p
    where p.role = 'admin' and p.is_active and p.id <> p_user_id
  ) then
    raise exception 'Tiene que quedar al menos un administrador activo.' using errcode = '22023';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  if not found then
    raise exception 'El usuario no existe.' using errcode = '23503';
  end if;
end;
$$;

create or replace function public.set_user_active(
  p_user_id uuid,
  p_active  boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_admin();

  if p_active is false and not exists (
    select 1 from public.profiles p
    where p.role = 'admin' and p.is_active and p.id <> p_user_id
  ) then
    raise exception 'Tiene que quedar al menos un administrador activo.' using errcode = '22023';
  end if;

  update public.profiles set is_active = p_active where id = p_user_id;

  if not found then
    raise exception 'El usuario no existe.' using errcode = '23503';
  end if;
end;
$$;
