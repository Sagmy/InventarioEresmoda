-- =============================================================================
-- 0010 · Row Level Security, permisos y tiempo real
-- =============================================================================
-- La regla que sostiene todo el modelo de seguridad:
--
--   EL NAVEGADOR NUNCA ESCRIBE DIRECTO EN UNA TABLA.
--
-- El rol `authenticated` no tiene INSERT, UPDATE ni DELETE sobre ninguna tabla
-- de negocio. Todo cambio pasa por una función SECURITY DEFINER que corre dentro
-- de una transacción, bloquea las filas de stock y valida las reglas.
--
-- Eso convierte en imposibles cosas como: editar el stock a mano, cobrar de más,
-- crear una venta con un total inventado, apartar sin el 50%, o marcar como
-- pagada una deuda que no lo está. No es que la interfaz no lo permita: es que
-- la base de datos no lo acepta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Borrón y cuenta nueva sobre los permisos por defecto
-- -----------------------------------------------------------------------------
-- Supabase concede permisos amplios a `anon` y `authenticated` por defecto.
-- Se retiran todos y luego se otorga solo lo justo.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2 · RLS activo en todas las tablas
-- -----------------------------------------------------------------------------
-- Sin políticas, RLS activo significa "nadie ve nada". Se abre solo lo necesario.
alter table public.profiles           enable row level security;
alter table public.settings           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.product_variants   enable row level security;
alter table public.variant_costs      enable row level security;
alter table public.customers          enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.order_item_costs   enable row level security;
alter table public.payments           enable row level security;
alter table public.returns            enable row level security;
alter table public.return_items       enable row level security;
alter table public.stock_movements    enable row level security;

-- -----------------------------------------------------------------------------
-- 3 · Políticas de lectura
-- -----------------------------------------------------------------------------
-- Solo SELECT. No hay ni una sola política de INSERT, UPDATE o DELETE en todo el
-- esquema, y esa ausencia es deliberada.

-- Cada quien ve su propio perfil; el admin ve a todo el equipo.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Las reglas del negocio las lee todo el personal: el vendedor necesita saber
-- que el abono mínimo de un apartado es 50% antes de cobrarlo.
create policy settings_select on public.settings
  for select to authenticated
  using (public.is_staff());

create policy categories_select on public.categories
  for select to authenticated
  using (public.is_staff());

create policy products_select on public.products
  for select to authenticated
  using (public.is_staff());

-- Sin costos dentro, esta tabla es segura para todo el personal. Que sea legible
-- es lo que permite que el stock se actualice en vivo en el celular del vendedor.
create policy product_variants_select on public.product_variants
  for select to authenticated
  using (public.is_staff());

create policy customers_select on public.customers
  for select to authenticated
  using (public.is_staff());

create policy orders_select on public.orders
  for select to authenticated
  using (public.is_staff());

create policy order_items_select on public.order_items
  for select to authenticated
  using (public.is_staff());

create policy payments_select on public.payments
  for select to authenticated
  using (public.is_staff());

create policy returns_select on public.returns
  for select to authenticated
  using (public.is_staff());

create policy return_items_select on public.return_items
  for select to authenticated
  using (public.is_staff());

-- ---- Solo administradores ----------------------------------------------------
-- Aquí viven los costos y los márgenes. Un vendedor consultando estas tablas
-- recibe cero filas, sin importar cómo arme la petición.
create policy variant_costs_select on public.variant_costs
  for select to authenticated
  using (public.is_admin());

create policy order_item_costs_select on public.order_item_costs
  for select to authenticated
  using (public.is_admin());

-- El libro de movimientos incluye el costo de cada entrada de mercancía.
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4 · Permisos de tabla: SELECT y nada más
-- -----------------------------------------------------------------------------
-- Segundo candado. Aunque un día alguien agregue una política de escritura por
-- error, sin el GRANT correspondiente la escritura sigue siendo imposible.
grant select on
  public.profiles,
  public.settings,
  public.categories,
  public.products,
  public.product_variants,
  public.variant_costs,
  public.customers,
  public.orders,
  public.order_items,
  public.order_item_costs,
  public.payments,
  public.returns,
  public.return_items,
  public.stock_movements
to authenticated;

-- -----------------------------------------------------------------------------
-- 5 · Vistas
-- -----------------------------------------------------------------------------
-- Las de reporte llevan `is_admin()` adentro: a un vendedor le devuelven cero
-- filas aunque tenga permiso para consultarlas.
grant select on
  public.v_stock,
  public.v_orders,
  public.v_order_items,
  public.v_order_balances,
  public.v_collections_due,
  public.v_cash_movements,
  public.v_cash_daily,
  public.v_order_margin,
  public.v_profit_daily
to authenticated;

-- -----------------------------------------------------------------------------
-- 6 · Funciones: la única puerta de escritura
-- -----------------------------------------------------------------------------
-- Cada una valida la sesión y el rol por dentro con require_staff() o
-- require_admin(), así que el GRANT a `authenticated` no es un cheque en blanco.
grant execute on function
  public.create_order(public.order_type, jsonb, uuid, public.price_kind, jsonb, bigint, text),
  public.add_payment(uuid, bigint, public.payment_method, text, text, timestamptz),
  public.cancel_order(uuid, boolean, bigint, public.payment_method, text),
  public.void_payment(uuid, text),
  public.register_return(uuid, jsonb, boolean, bigint, public.payment_method, text),
  public.register_exchange(uuid, jsonb, jsonb, jsonb, public.price_kind, text),
  public.receive_stock(uuid, integer, bigint, text),
  public.adjust_stock(uuid, integer, text),
  public.create_product(text, jsonb, text, text, uuid),
  public.update_product(uuid, text, text, text, uuid, boolean),
  public.create_variant(uuid, bigint, text, text, bigint, integer, text),
  public.update_variant(uuid, text, text, bigint, bigint, boolean),
  public.upsert_category(text, uuid),
  public.upsert_customer(text, uuid, text, text, text, boolean),
  public.update_settings(text, text, numeric, integer, integer, numeric, integer, integer),
  public.set_user_role(uuid, public.user_role),
  public.set_user_active(uuid, boolean),
  public.report_cash(date, date, text),
  public.report_cash_by_method(date, date),
  public.report_profit(date, date, text),
  public.report_top_products(date, date, integer),
  public.dashboard_summary(),
  public.format_cents(bigint),
  public.is_admin(),
  public.is_staff(),
  public.auth_role()
to authenticated;

-- `anon` no recibe absolutamente nada: sin iniciar sesión no hay nada que ver.

-- El trigger que crea el perfil se dispara al insertar en `auth.users`, y quien
-- hace ese insert es el servicio de autenticación de Supabase. El revoke masivo
-- de arriba le quitó el permiso de ejecutarlo, así que hay que devolvérselo o
-- ningún registro nuevo llegaría a tener perfil.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7 · Tiempo real
-- -----------------------------------------------------------------------------
-- Realtime respeta la RLS: cada suscriptor solo recibe los cambios de las filas
-- que tendría derecho a consultar. Por eso se publican únicamente las tablas
-- legibles por todo el personal, y nunca las de costos.
-- Se comprueba que la publicación exista para que estas migraciones también
-- corran contra un Postgres pelado (por ejemplo, el de los tests).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.product_variants;
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.payments;
  end if;
end;
$$;

-- Para que el payload de UPDATE traiga la fila completa y el cliente pueda
-- refrescar los tres números de stock sin volver a consultar.
alter table public.product_variants replica identity full;
alter table public.orders           replica identity full;
