import { requireAdmin } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { FormularioProducto } from './formulario';
import type { Category } from '@/types/database';

export default async function NuevaPrendaPage() {
  await requireAdmin();

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from('categories').select('*').order('name');

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Nueva prenda</h1>
        <p className="text-sm text-tinta-suave">
          Cada combinación de color y talla se lleva por separado, para saber
          exactamente qué se agotó.
        </p>
      </div>

      <FormularioProducto categorias={(data ?? []) as Category[]} />
    </div>
  );
}
