-- =============================================================================
-- 0015 · Categorías iniciales en la base de la tienda
-- =============================================================================
-- La tabla `categories` nacía vacía en producción y no había forma de llenarla:
-- las cuatro categorías de ejemplo viven en `seed.sql`, que solo se aplica con
-- `supabase db reset` en local (y que además inserta prendas inventadas, así que
-- no se puede cargar tal cual en la tienda). Resultado: el desplegable de
-- categorías al dar de alta una prenda solo ofrecía "Sin categoría", y así iba a
-- seguir para siempre.
--
-- Se siembran las cuatro como punto de partida. No son sagradas: desde Ajustes
-- se renombran y se añaden las que hagan falta.
--
-- `on conflict do nothing` para que la migración pueda repetirse sin romper, y
-- para no pisar las que ya existan si alguien las creó a mano.
-- =============================================================================

insert into public.categories (name) values
  ('Camisas'),
  ('Pantalones'),
  ('Vestidos'),
  ('Accesorios')
on conflict (name) do nothing;
