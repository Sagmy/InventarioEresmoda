import { requireAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { FormularioProducto } from './formulario';
import type { Category } from '@/types/database';

export default async function NuevaPrendaPage() {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();

  const [{ data }, { data: variantes }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    // Los colores ya usados se ofrecen como sugerencia. No es solo comodidad: el
    // color de una foto se casa con el de la variante por texto EXACTO, así que
    // cargar «azul» cuando el resto del inventario dice «Azul» deja esa prenda
    // sin foto en la página pública.
    supabase.from('product_variants').select('color').order('color'),
  ]);

  const coloresUsados = [
    ...new Set(
      (variantes ?? [])
        .map((v) => v.color?.trim())
        .filter((c): c is string => Boolean(c) && c !== 'Único'),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Nueva prenda</h1>
        <p className="text-sm text-tinta-suave">
          Cada combinación de color y talla se lleva por separado, para saber
          exactamente qué se agotó.
        </p>
      </div>

      <FormularioProducto categorias={(data ?? []) as Category[]} coloresUsados={coloresUsados} />
    </div>
  );
}
