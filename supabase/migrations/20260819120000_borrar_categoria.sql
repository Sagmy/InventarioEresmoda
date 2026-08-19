-- =============================================================================
-- 0016 · Borrar categorías, pero solo cuando es seguro
-- =============================================================================
-- Faltaba poder borrar una categoría. El problema de hacerlo a lo bruto es que
-- `products.category_id` está declarado `on delete set null`: un DELETE directo
-- se lleva por delante la categoría y deja TODAS sus prendas en "Sin categoría"
-- sin error y sin aviso. El inventario queda descolocado y nadie se entera hasta
-- que alguien va a buscar algo y no lo encuentra donde estaba.
--
-- Se aplica el mismo criterio que ya rige para los clientes en la migración
-- 0012: borrar solo se permite cuando no hay nada que arrastrar. Si la categoría
-- tiene prendas, la base se niega y dice cuántas son, para que quien la quiera
-- quitar sepa exactamente qué tiene que mover antes.
--
-- Para el caso corriente (la escribí mal) ya está `upsert_category`, que
-- renombra sin tocar ninguna prenda.
-- =============================================================================

create or replace function public.delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre  text;
  v_prendas integer;
begin
  perform public.require_admin();

  select name into v_nombre from public.categories where id = p_id;

  if v_nombre is null then
    raise exception 'La categoría no existe.' using errcode = '23503';
  end if;

  -- Se cuentan también las prendas inactivas: siguen apuntando aquí y volverían
  -- a la vida sin categoría si se reactivaran.
  select count(*) into v_prendas from public.products where category_id = p_id;

  if v_prendas > 0 then
    raise exception 'No se puede borrar «%»: tiene % % dentro. Cámbialas de categoría o renombra esta.',
      v_nombre,
      v_prendas,
      case when v_prendas = 1 then 'prenda' else 'prendas' end
      using errcode = '23503';
  end if;

  delete from public.categories where id = p_id;
end;
$$;

-- Postgres regala EXECUTE a PUBLIC en cada función nueva y el revoke masivo de
-- la migración 0010 no alcanza a las que nacen después.
revoke all on function public.delete_category(uuid) from public, anon;

grant execute on function public.delete_category(uuid) to authenticated;
