-- =============================================================================
-- 0017 · Fotos de las prendas y catálogo público
-- =============================================================================
-- El inventario va a alimentar una landing page, así que cada prenda necesita
-- foto. Se modela en tabla aparte y no como columna en `products` por dos
-- razones que vienen del propio negocio:
--
--   · Varias fotos por prenda. Una sola no basta: hace falta el derecho y el
--     revés, la etiqueta, el detalle del bordado.
--   · La foto cambia con el COLOR, no con la talla. Un vestido rojo y uno azul
--     son la misma prenda pero no la misma imagen; en cambio la talla S y la M
--     del rojo comparten foto. Colgar la imagen de `product_variants` (que es
--     color × talla) obligaría a subir la misma foto una vez por talla.
--
-- De ahí `color` nullable: con color puesto, la foto es de ese color; en null,
-- vale para la prenda entera y sirve de respaldo cuando un color no tiene foto
-- propia.
-- =============================================================================

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,

  -- Null = foto genérica de la prenda, vale para cualquier color.
  color        text check (color is null or length(btrim(color)) between 1 and 40),

  -- Ruta dentro del bucket `prendas`. Única: dos filas no pueden apuntar al
  -- mismo archivo, así borrar una fila nunca deja a otra sin imagen.
  storage_path text not null unique check (length(btrim(storage_path)) between 1 and 400),

  -- 0 es la principal: la que enseña la landing en la portada del producto.
  sort_order   integer not null default 0 check (sort_order >= 0),

  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id)
);

create index product_images_product_idx on public.product_images (product_id, color, sort_order);

alter table public.product_images enable row level security;

-- Lectura directa solo para el personal. La landing NO lee esta tabla: lee la
-- vista de abajo, que ya trae las rutas agregadas y filtradas.
create policy product_images_select on public.product_images
  for select to authenticated
  using (public.is_staff());

grant select on public.product_images to authenticated;

-- -----------------------------------------------------------------------------
-- Bucket de imágenes
-- -----------------------------------------------------------------------------
-- Público a propósito: son fotos de catálogo pensadas para enseñarse en una web
-- abierta. Un bucket privado obligaría a firmar cada URL, y esas firmas caducan,
-- lo que rompería el cacheado de la landing y del CDN.
--
-- Público es solo la LECTURA. Subir y borrar sigue siendo cosa de admins, por
-- las políticas de más abajo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prendas',
  'prendas',
  true,
  5242880,  -- 5 MB: una foto de celular ya comprimida entra de sobra
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Ojo: si `db:push` fallara aquí con "must be owner of table objects", estas
-- tres políticas se crean igual desde el panel de Supabase (Storage → prendas →
-- Policies). El bucket de arriba sí se crea sin problema.
create policy prendas_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prendas' and public.is_admin());

create policy prendas_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'prendas' and public.is_admin());

create policy prendas_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'prendas' and public.is_admin());

-- -----------------------------------------------------------------------------
-- create_product · ahora también guarda las fotos
-- -----------------------------------------------------------------------------
-- Las fotos entran en la MISMA transacción que la prenda. Si algo falla a mitad,
-- no queda una prenda sin fotos ni fotos apuntando a una prenda que no existe.
--
-- Añadir un parámetro cambia la firma, y `create or replace` no puede: dejaría
-- dos funciones homónimas y una llamada sin p_images encajaría en ambas, que es
-- justo el error que PostgREST no sabe resolver. Hay que soltarla y recrearla,
-- lo que además borra sus permisos: se vuelven a conceder al final.
--
-- p_images: [{ "path": text, "color": text? }]  · el orden del array manda
-- -----------------------------------------------------------------------------

drop function if exists public.create_product(text, jsonb, text, text, uuid);

create or replace function public.create_product(
  p_name        text,
  p_variants    jsonb,
  p_description text  default null,
  p_brand       text  default null,
  p_category_id uuid  default null,
  p_images      jsonb default null
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
  v_imagen     record;
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

  if p_images is not null and jsonb_typeof(p_images) = 'array' then
    for v_imagen in
      select
        nullif(btrim(e.value ->> 'path'), '')  as path,
        nullif(btrim(e.value ->> 'color'), '') as color,
        (e.ordinality - 1)::integer            as sort_order
      from jsonb_array_elements(p_images) with ordinality as e(value, ordinality)
    loop
      if v_imagen.path is null then
        raise exception 'Hay una foto sin archivo.' using errcode = '22023';
      end if;

      insert into public.product_images (product_id, color, storage_path, sort_order, created_by)
      values (v_product_id, v_imagen.color, v_imagen.path, v_imagen.sort_order, v_actor);
    end loop;
  end if;

  return v_product_id;
end;
$$;

revoke all on function
  public.create_product(text, jsonb, text, text, uuid, jsonb)
  from public, anon;

grant execute on function
  public.create_product(text, jsonb, text, text, uuid, jsonb)
  to authenticated;

-- -----------------------------------------------------------------------------
-- v_catalogo_publico · lo único que la landing page puede ver
-- -----------------------------------------------------------------------------
-- Esta es la ÚNICA puerta abierta al rol anónimo en todo el esquema. Todo lo que
-- no esté en esta vista sigue siendo invisible sin sesión.
--
-- Lo que deliberadamente NO sale de aquí:
--
--   · Los costos y los márgenes. Viven en variant_costs y order_item_costs, que
--     son solo-admin. Ni siquiera se consultan.
--   · Las cantidades exactas de stock. "Quedan 2" le dice a cualquiera cuánto
--     vendes; se publica solo si se puede comprar o no, y qué tallas quedan.
--   · Las prendas y variantes retiradas, que no deben aparecer en la web.
--
-- Una fila por prenda y color, que es como se enseña la ropa: el vestido rojo y
-- el azul son dos tarjetas distintas aunque compartan nombre.
-- -----------------------------------------------------------------------------

create or replace view public.v_catalogo_publico
with (security_invoker = false) as
select
  p.id                          as product_id,
  p.name                        as product_name,
  p.brand                       as brand,
  c.name                        as category_name,
  v.color                       as color,

  -- El precio más bajo del color: si la talla XXL cuesta más, la landing anuncia
  -- "desde" y no una cifra que luego sube en el mostrador.
  min(v.price_cents)            as price_from_cents,

  bool_or(v.qty_available > 0)  as is_available,

  -- Solo las tallas que se pueden comprar hoy.
  coalesce(
    array_agg(distinct v.size) filter (where v.qty_available > 0),
    array[]::text[]
  )                             as sizes_available,

  -- Las de este color primero; las genéricas (color null) quedan de respaldo
  -- para los colores que todavía no tienen foto propia.
  coalesce(
    (
      select jsonb_agg(i.storage_path order by (i.color is null), i.sort_order, i.created_at)
      from public.product_images i
      where i.product_id = p.id
        and (i.color is null or i.color = v.color)
    ),
    '[]'::jsonb
  )                             as images
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.categories c on c.id = p.category_id
where p.is_active
  and v.is_active
group by p.id, p.name, p.brand, c.name, v.color;

-- La llave anónima solo abre esta puerta. Nada de INSERT, UPDATE ni DELETE.
grant select on public.v_catalogo_publico to anon, authenticated;
