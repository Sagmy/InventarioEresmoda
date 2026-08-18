-- =============================================================================
-- BORRAR DATOS DE PRUEBA
-- =============================================================================
-- ⚠️  ESTE ARCHIVO DESTRUYE INFORMACIÓN Y NO SE PUEDE DESHACER.
--
-- No es una migración y NO se aplica con `supabase db push`. Vive aparte a
-- propósito: se ejecuta a mano, pegándolo en el SQL Editor de Supabase.
--
-- Los bloques que borran están COMENTADOS. Si pegas el archivo entero y le das
-- a Run, solo se ejecuta el recuento del PASO 1, que no toca nada. Para borrar
-- de verdad hay que quitar los guiones a mano, que es justo la pausa que evita
-- un accidente.
--
-- NUNCA se tocan:
--   · Las cuentas de usuario (profiles y auth.users)
--   · Los ajustes de la tienda (porcentajes, plazos, zona horaria)
-- =============================================================================


-- =============================================================================
-- PASO 1 · Ver qué hay antes de borrar  (seguro: solo cuenta)
-- =============================================================================
select 'ventas / apartados / créditos' as dato, count(*) as cantidad from public.orders
union all select 'líneas de venta',        count(*) from public.order_items
union all select 'pagos y abonos',         count(*) from public.payments
union all select 'devoluciones',           count(*) from public.returns
union all select 'movimientos de stock',   count(*) from public.stock_movements
union all select 'clientes',               count(*) from public.customers
union all select 'productos',              count(*) from public.products
union all select 'variantes (talla/color)', count(*) from public.product_variants
union all select 'categorías',             count(*) from public.categories
union all select 'usuarios (NO se borran)', count(*) from public.profiles
order by 1;


-- =============================================================================
-- OPCIÓN A · Borrar solo las TRANSACCIONES
-- =============================================================================
-- Elimina ventas, apartados, créditos, pagos y devoluciones, pero CONSERVA el
-- catálogo de prendas y los clientes.
--
-- Úsala cuando el inventario que cargaste ya es el real y lo único inventado
-- son las ventas de prueba.
--
-- El stock se recalcula desde el libro de movimientos que queda (las entradas
-- de mercancía y los ajustes), en vez de ponerlo a mano: así los tres números
-- siguen cuadrando con su historial.
--
-- Para ejecutarlo: selecciona desde 'begin;' hasta 'commit;' y quita los "-- ".

-- begin;
--
--   delete from public.stock_movements where order_id is not null or return_id is not null;
--   delete from public.returns;          -- return_items cae en cascada
--   delete from public.payments;
--   delete from public.orders;           -- order_items y order_item_costs caen en cascada
--
--   -- Recalcular los contadores desde los movimientos que sobrevivieron.
--   update public.product_variants v
--   -- `greatest(0, ...)` por si algún ajuste manual dejó la suma en negativo:
--   -- sin esto la restricción qty_on_hand >= 0 abortaría el borrado a medias.
--   set qty_on_hand  = greatest(0, coalesce(m.on_hand, 0)),
--       qty_reserved = 0
--   from (
--     select variant_id, sum(delta_on_hand) as on_hand
--     from public.stock_movements
--     group by variant_id
--   ) m
--   where m.variant_id = v.id;
--
--   update public.product_variants
--   set qty_on_hand = 0, qty_reserved = 0
--   where id not in (select variant_id from public.stock_movements);
--
--   alter sequence public.order_number_seq  restart with 1000;
--   alter sequence public.return_number_seq restart with 1;
--
-- commit;


-- =============================================================================
-- OPCIÓN B · Dejar el sistema COMPLETAMENTE vacío
-- =============================================================================
-- Borra transacciones, clientes, productos, variantes y categorías. Queda como
-- recién instalado, conservando tus usuarios y tus ajustes.
--
-- Úsala cuando terminas de probar y vas a cargar el inventario de verdad.
--
-- Para ejecutarlo: selecciona desde 'begin;' hasta 'commit;' y quita los "-- ".

-- begin;
--
--   truncate table
--     public.stock_movements,
--     public.return_items,
--     public.returns,
--     public.payments,
--     public.order_item_costs,
--     public.order_items,
--     public.orders,
--     public.customers,
--     public.variant_costs,
--     public.product_variants,
--     public.products,
--     public.categories
--   restart identity cascade;
--
--   -- Los contadores visibles vuelven a empezar: la primera venta será #1000
--   -- y el primer código de prenda, ERM-000001.
--   alter sequence public.order_number_seq  restart with 1000;
--   alter sequence public.return_number_seq restart with 1;
--   alter sequence public.sku_seq           restart with 1;
--
-- commit;


-- =============================================================================
-- PASO 3 · Comprobar que quedó limpio  (seguro: solo cuenta)
-- =============================================================================
-- Vuelve a ejecutar el PASO 1. Todo debería estar en cero salvo los usuarios,
-- y los ajustes de la tienda intactos:

-- select timezone, layaway_min_deposit_pct, layaway_term_days,
--        credit_reminder_days, low_stock_threshold
-- from public.settings;
