-- =============================================================================
-- Tests pgTAP · las reglas que romperían el negocio si fallaran
-- =============================================================================
-- Ejecutar con Supabase local:   supabase test db
--
-- Se prueba la CAPA DE DATOS, que es donde vive la lógica. Da igual lo que haga
-- la interfaz: si estas pruebas pasan, el inventario no se puede descuadrar.
-- =============================================================================

begin;

select plan(28);

-- -----------------------------------------------------------------------------
-- Montaje: un admin, un vendedor, un cliente y una camisa con 5 unidades
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local',
   '{"full_name":"Admin de prueba"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'vendedor@test.local',
   '{"full_name":"Vendedor de prueba"}'::jsonb);

-- El trigger reparte roles: el primero es admin y activo; los siguientes entran
-- como vendedores INACTIVOS, a la espera de que un admin los habilite. Eso es lo
-- que impide que cualquiera con la dirección se registre y empiece a ver datos.
select results_eq(
  $$select role::text, is_active from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'$$,
  $$values ('admin', true)$$,
  'El primer usuario registrado queda como administrador activo'
);

select results_eq(
  $$select role::text, is_active from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'$$,
  $$values ('seller', false)$$,
  'Los registros posteriores entran como vendedor INACTIVO'
);

-- Se habilita al vendedor para las pruebas de permisos del final.
update public.profiles set is_active = true
where id = '22222222-2222-2222-2222-222222222222';

-- Actuar como el admin.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  public.auth_role()::text, 'admin',
  'auth_role() reconoce al administrador desde el token'
);

-- Producto con 5 camisas
select public.create_product(
  'Camisa Lino',
  '[{"size":"M","color":"Blanco","price_cents":10000,"cost_cents":4000,"qty":5}]'::jsonb
) as producto \gset

select id as variante from public.product_variants limit 1 \gset

select public.upsert_customer('Cliente de prueba') as cliente \gset

-- -----------------------------------------------------------------------------
-- Estado inicial
-- -----------------------------------------------------------------------------
select results_eq(
  format('select qty_on_hand, qty_reserved, qty_available from public.product_variants where id = %L', :'variante'),
  $$values (5, 0, 5)$$,
  'Al cargar 5 unidades: físico 5, apartado 0, disponible 5'
);

-- -----------------------------------------------------------------------------
-- 1 · No se puede vender más de lo que hay
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $q$select public.create_order('contado', '[{"variant_id":"%s","qty":6}]'::jsonb, null, 'normal',
      '[{"amount_cents":60000,"method":"efectivo"}]'::jsonb)$q$, :'variante'
  ),
  '23514',
  null,
  'Vender 6 de 5 unidades falla'
);

-- -----------------------------------------------------------------------------
-- 2 · Venta de contado: descuenta de inmediato
-- -----------------------------------------------------------------------------
select public.create_order(
  'contado',
  format('[{"variant_id":"%s","qty":1}]', :'variante')::jsonb,
  null, 'normal',
  '[{"amount_cents":10000,"method":"efectivo"}]'::jsonb
) as venta_contado \gset

select results_eq(
  format('select qty_on_hand, qty_reserved, qty_available from public.product_variants where id = %L', :'variante'),
  $$values (4, 0, 4)$$,
  'Contado: la prenda sale del inventario en el acto'
);

select is(
  (select status::text from public.orders where id = :'venta_contado'),
  'completed',
  'Una venta de contado pagada queda liquidada'
);

-- -----------------------------------------------------------------------------
-- 3 · Contado sin pagar completo es rechazado
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $q$select public.create_order('contado', '[{"variant_id":"%s","qty":1}]'::jsonb, null, 'normal',
      '[{"amount_cents":5000,"method":"efectivo"}]'::jsonb)$q$, :'variante'
  ),
  '22023',
  null,
  'Una venta de contado a medio pagar es rechazada'
);

-- -----------------------------------------------------------------------------
-- 4 · Apartado: exige el 50% y NO descuenta del inventario
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $q$select public.create_order('apartado', '[{"variant_id":"%s","qty":2}]'::jsonb, '%s', 'normal',
      '[{"amount_cents":4000,"method":"efectivo"}]'::jsonb)$q$, :'variante', :'cliente'
  ),
  '22023',
  null,
  'Apartar con menos del 50% es rechazado'
);

select public.create_order(
  'apartado',
  format('[{"variant_id":"%s","qty":2}]', :'variante')::jsonb,
  :'cliente', 'normal',
  '[{"amount_cents":10000,"method":"efectivo"}]'::jsonb
) as apartado \gset

-- ESTA es la respuesta al problema de fondo: 4 físicas, 2 apartadas, 2 vendibles.
select results_eq(
  format('select qty_on_hand, qty_reserved, qty_available from public.product_variants where id = %L', :'variante'),
  $$values (4, 2, 2)$$,
  'Apartado: no descuenta del físico pero sí reduce lo disponible'
);

select is(
  (select status::text from public.orders where id = :'apartado'),
  'open',
  'El apartado queda abierto con saldo pendiente'
);

select is(
  (select payment_status from public.v_order_balances where order_id = :'apartado'),
  'parcial',
  'El apartado abonado a medias se marca como PARCIAL'
);

select isnt(
  (select due_date from public.orders where id = :'apartado'),
  null,
  'El apartado sí tiene fecha de vencimiento'
);

-- -----------------------------------------------------------------------------
-- 5 · Con 2 disponibles no se pueden vender 3
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $q$select public.create_order('contado', '[{"variant_id":"%s","qty":3}]'::jsonb, null, 'normal',
      '[{"amount_cents":30000,"method":"efectivo"}]'::jsonb)$q$, :'variante'
  ),
  '23514',
  null,
  'Lo apartado no se puede vender: hay 4 físicas pero solo 2 disponibles'
);

-- -----------------------------------------------------------------------------
-- 6 · Sobrepago rechazado
-- -----------------------------------------------------------------------------
select throws_ok(
  format($q$select public.add_payment('%s', 99999, 'efectivo')$q$, :'apartado'),
  '22023',
  null,
  'Un abono mayor al saldo pendiente es rechazado'
);

-- -----------------------------------------------------------------------------
-- 7 · Al terminar de pagar, el apartado SÍ descuenta del inventario
-- -----------------------------------------------------------------------------
select lives_ok(
  format($q$select public.add_payment('%s', 10000, 'zelle')$q$, :'apartado'),
  'Se puede abonar el saldo restante del apartado'
);

select is(
  (select status::text from public.orders where id = :'apartado'),
  'completed',
  'El apartado se liquida solo al llegar el saldo a cero'
);

select results_eq(
  format('select qty_on_hand, qty_reserved, qty_available from public.product_variants where id = %L', :'variante'),
  $$values (2, 0, 2)$$,
  'Apartado liquidado: baja el físico y se suelta la reserva, sin descontar dos veces'
);

-- -----------------------------------------------------------------------------
-- 8 · Crédito: descuenta ya y NO lleva fecha de vencimiento
-- -----------------------------------------------------------------------------
select public.create_order(
  'credito',
  format('[{"variant_id":"%s","qty":1}]', :'variante')::jsonb,
  :'cliente', 'normal',
  '[]'::jsonb
) as credito \gset

select results_eq(
  format('select qty_on_hand, qty_reserved, qty_available from public.product_variants where id = %L', :'variante'),
  $$values (1, 0, 1)$$,
  'Crédito: la prenda sale del inventario de inmediato'
);

select is(
  (select due_date from public.orders where id = :'credito'),
  null,
  'El crédito no tiene fecha límite: plazo indefinido'
);

select is(
  (select payment_status from public.v_order_balances where order_id = :'credito'),
  'pendiente',
  'Un crédito sin abono inicial queda PENDIENTE'
);

-- -----------------------------------------------------------------------------
-- 9 · Las promociones solo existen al contado
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $q$select public.create_order('apartado', '[{"variant_id":"%s","qty":1,"unit_price_cents":5000}]'::jsonb,
      '%s', 'promo', '[{"amount_cents":5000,"method":"efectivo"}]'::jsonb)$q$, :'variante', :'cliente'
  ),
  '22023',
  null,
  'Marcar un apartado como promoción es rechazado'
);

-- -----------------------------------------------------------------------------
-- 10 · No se puede rebajar el precio sin marcar la venta como promoción
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $q$select public.create_order('contado', '[{"variant_id":"%s","qty":1,"unit_price_cents":5000}]'::jsonb,
      null, 'normal', '[{"amount_cents":5000,"method":"efectivo"}]'::jsonb)$q$, :'variante'
  ),
  '22023',
  null,
  'Cobrar por debajo del precio de lista sin marcar promoción es rechazado'
);

-- -----------------------------------------------------------------------------
-- 11 · Cancelar un apartado devuelve la prenda a disponible
-- -----------------------------------------------------------------------------
select public.create_order(
  'apartado',
  format('[{"variant_id":"%s","qty":1}]', :'variante')::jsonb,
  :'cliente', 'normal',
  '[{"amount_cents":5000,"method":"efectivo"}]'::jsonb
) as apartado2 \gset

select results_eq(
  format('select qty_available from public.product_variants where id = %L', :'variante'),
  $$values (0)$$,
  'La última unidad apartada deja el disponible en cero'
);

select lives_ok(
  format($q$select public.cancel_order('%s', true, 0, null, 'El cliente desistió')$q$, :'apartado2'),
  'El administrador puede cancelar un apartado'
);

select results_eq(
  format('select qty_on_hand, qty_reserved, qty_available from public.product_variants where id = %L', :'variante'),
  $$values (1, 0, 1)$$,
  'Cancelar el apartado devuelve la prenda a disponible'
);

-- -----------------------------------------------------------------------------
-- 12 · Un vendedor no puede ver los costos
-- -----------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.variant_costs),
  0,
  'El vendedor no ve ni una fila de costos'
);

select ok(
  (select count(*) from public.v_stock) > 0,
  'El vendedor sí ve el inventario, pero sin costos'
);

select * from finish();

rollback;
