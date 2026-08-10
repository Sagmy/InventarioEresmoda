-- =============================================================================
-- 0001 · Extensiones y tipos enumerados
-- =============================================================================
-- Todos los tipos del dominio viven en la base de datos, no en el código de la
-- aplicación. Así un valor inválido es imposible de insertar aunque la petición
-- venga manipulada desde el navegador.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Rol del usuario dentro del sistema.
--   admin  : ve costos, márgenes y reportes; configura reglas; ajusta stock.
--   seller : registra ventas, apartados, créditos y abonos. Nunca ve costos.
create type public.user_role as enum ('admin', 'seller');

-- Tipo de transacción.
--   contado  : se paga completo y la prenda sale de una vez.
--   apartado : la prenda se RESERVA (no sale) hasta terminar de pagarse.
--   credito  : la prenda SALE de inmediato y queda la deuda registrada.
create type public.order_type as enum ('contado', 'apartado', 'credito');

-- Estado del ciclo de vida de la transacción.
--   open      : abierta, con saldo pendiente (apartados y créditos).
--   completed : saldada. La mercancía ya salió del inventario.
--   cancelled : anulada manualmente por el usuario.
create type public.order_status as enum ('open', 'completed', 'cancelled');

-- Marca si la venta se hizo a precio de lista o a precio promocional.
-- Las promos solo son válidas en ventas de contado (restricción en `orders`).
create type public.price_kind as enum ('normal', 'promo');

-- Método de cada pago individual. Va por PAGO, no por venta: un apartado puede
-- recibir tres abonos con tres métodos distintos, y así la caja se puede cuadrar
-- por método al cierre del día.
create type public.payment_method as enum (
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto_venta',
  'otro',
  -- Interno: valor de la prenda devuelta que se abona a la prenda nueva en un
  -- cambio. No es dinero real y no se puede elegir a mano; existe para que el
  -- reporte de caja no confunda un cambio de talla con una venta nueva.
  'credito_cambio'
);

-- Motivo de cada movimiento del libro de inventario. El libro es append-only:
-- nunca se actualiza ni se borra, solo se agregan renglones. Eso permite
-- reconstruir en cualquier momento por qué el stock es el que es.
create type public.stock_reason as enum (
  'purchase_in',      -- entrada de mercancía          on_hand +n
  'sale_out',         -- venta de contado o crédito    on_hand -n
  'reserve',          -- se crea un apartado           reserved +n
  'release_reserve',  -- apartado cancelado            reserved -n
  'reserve_to_sale',  -- apartado terminado de pagar   on_hand -n, reserved -n
  'return_in',        -- devolución con reingreso      on_hand +n
  'adjustment'        -- ajuste por conteo físico      on_hand ±n
);

-- Devolución simple o cambio por otra prenda.
create type public.return_type as enum ('devolucion', 'cambio');
