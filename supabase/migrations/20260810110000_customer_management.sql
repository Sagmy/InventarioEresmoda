-- =============================================================================
-- 0012 · Desactivar y borrar clientes
-- =============================================================================
-- Son dos operaciones distintas a propósito:
--
--   DESACTIVAR  esconde al cliente de los listados y del punto de venta, pero
--               conserva sus apartados, créditos y compras. Es lo correcto para
--               alguien que ya no viene: el historial de ventas sigue completo.
--
--   BORRAR      lo elimina de verdad, y solo se permite si NUNCA tuvo una
--               transacción. Sirve para limpiar duplicados y errores de tecleo.
--
-- Borrar un cliente con historial dejaría ventas huérfanas y descuadraría los
-- reportes, así que la base lo impide y explica por qué.
-- =============================================================================

create or replace function public.set_customer_active(
  p_id     uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.require_staff();

  if p_active is null then
    raise exception 'Indica si el cliente queda activo o inactivo.' using errcode = '22023';
  end if;

  -- No se bloquea desactivar a alguien que todavía debe: la deuda no se pierde
  -- de vista, porque `v_collections_due` sale de las órdenes abiertas y no mira
  -- si el cliente está activo. Y a veces es justo lo que hace falta, con quien
  -- dejó de venir debiendo. La interfaz avisa; la decisión es del usuario.
  update public.customers set is_active = p_active where id = p_id;

  if not found then
    raise exception 'El cliente no existe.' using errcode = '23503';
  end if;
end;
$$;

create or replace function public.delete_customer(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre   text;
  v_ordenes  integer;
begin
  perform public.require_admin();

  select c.full_name into v_nombre
  from public.customers c
  where c.id = p_id;

  if not found then
    raise exception 'El cliente no existe.' using errcode = '23503';
  end if;

  select count(*) into v_ordenes
  from public.orders o
  where o.customer_id = p_id;

  if v_ordenes > 0 then
    raise exception
      'No se puede borrar a "%": tiene % transacción(es) registradas. Desactívalo para esconderlo sin perder el historial.',
      v_nombre, v_ordenes
      using errcode = '22023';
  end if;

  delete from public.customers where id = p_id;
end;
$$;

grant execute on function
  public.set_customer_active(uuid, boolean),
  public.delete_customer(uuid)
to authenticated;
