-- =============================================================================
-- Datos de ejemplo para desarrollo
-- =============================================================================
-- Se aplican con `supabase db reset` en local. NO los cargues en la base de la
-- tienda: son prendas inventadas para poder probar la aplicación.
--
-- Se insertan directo en las tablas (como dueño de la base, saltando RLS) en vez
-- de llamar a create_product, porque esas funciones exigen una sesión de usuario
-- y aquí todavía no hay nadie registrado.
-- =============================================================================

insert into public.categories (name) values
  ('Camisas'), ('Pantalones'), ('Vestidos'), ('Accesorios')
on conflict (name) do nothing;

with nuevos as (
  insert into public.products (name, brand, category_id, description)
  select
    p.nombre,
    p.marca,
    (select id from public.categories where name = p.categoria),
    p.descripcion
  from (values
    ('Camisa de lino',    'Zara',    'Camisas',     'Manga larga, corte regular'),
    ('Jean recto',        'Levis',   'Pantalones',  'Tiro medio'),
    ('Vestido floral',    null,      'Vestidos',    'Verano, tela ligera'),
    ('Correa de cuero',   null,      'Accesorios',  null)
  ) as p(nombre, marca, categoria, descripcion)
  returning id, name
)
insert into public.product_variants (product_id, size, color, price_cents)
select n.id, v.talla, v.color, v.precio
from nuevos n
join (values
  ('Camisa de lino',  'S',      'Blanco',  3500),
  ('Camisa de lino',  'M',      'Blanco',  3500),
  ('Camisa de lino',  'L',      'Blanco',  3500),
  ('Camisa de lino',  'M',      'Azul',    3500),
  ('Jean recto',      '30',     'Índigo',  5900),
  ('Jean recto',      '32',     'Índigo',  5900),
  ('Jean recto',      '34',     'Índigo',  5900),
  ('Vestido floral',  'S',      'Rosa',    4800),
  ('Vestido floral',  'M',      'Rosa',    4800),
  ('Correa de cuero', 'Única',  'Marrón',  1800)
) as v(producto, talla, color, precio) on v.producto = n.name;

-- Costos (tabla aparte, solo visible para administradores).
update public.variant_costs vc
set cost_cents = round(pv.price_cents * 0.45)
from public.product_variants pv
where pv.id = vc.variant_id;

-- Stock inicial, con su renglón en el libro de movimientos para que el
-- inventario sea reconstruible desde el primer día.
update public.product_variants set qty_on_hand = 5;

insert into public.stock_movements (variant_id, delta_on_hand, reason, note)
select id, 5, 'purchase_in', 'Carga de datos de ejemplo'
from public.product_variants;

insert into public.customers (full_name, phone) values
  ('María González', '0414-1234567'),
  ('José Rodríguez', '0412-7654321'),
  ('Ana Pérez',      '0424-9876543')
on conflict do nothing;
