-- =============================================================================
-- 0018 · Cambiar las fotos de una prenda ya cargada
-- =============================================================================
-- Las fotos solo se podían poner al crear la prenda. Una vez guardada no había
-- forma de añadir otra, quitar la que salió movida ni corregir a qué color
-- pertenece. Para un catálogo que alimenta una web pública eso no se sostiene:
-- las fotos se rehacen mucho más a menudo que los precios.
--
-- Se reemplaza el JUEGO ENTERO en una sola llamada en vez de ofrecer añadir y
-- borrar por separado. Así una única transacción cubre añadir, quitar, reordenar
-- y recolorear, y lo que queda en la base es exactamente lo que el admin tiene
-- en pantalla, sin estados intermedios raros si algo falla a mitad.
--
-- El orden del array manda: la posición 0 es la portada en la landing.
-- =============================================================================

create or replace function public.set_product_images(
  p_product_id uuid,
  p_images     jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor  uuid := public.require_admin();
  v_imagen record;
begin
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'La prenda no existe.' using errcode = '23503';
  end if;

  if p_images is null or jsonb_typeof(p_images) <> 'array' then
    raise exception 'Formato de fotos inválido.' using errcode = '22023';
  end if;

  -- Misma exigencia que al crearla: una tarjeta sin foto no se vende.
  if jsonb_array_length(p_images) = 0 then
    raise exception 'La prenda necesita al menos una foto.' using errcode = '22023';
  end if;

  delete from public.product_images where product_id = p_product_id;

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
    values (p_product_id, v_imagen.color, v_imagen.path, v_imagen.sort_order, v_actor);
  end loop;
end;
$$;

-- Postgres regala EXECUTE a PUBLIC en cada función nueva y el revoke masivo de
-- la migración 0010 no alcanza a las que nacen después.
revoke all on function public.set_product_images(uuid, jsonb) from public, anon;

grant execute on function public.set_product_images(uuid, jsonb) to authenticated;
