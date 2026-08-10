import { requireProfile } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { PuntoDeVenta } from './pos';
import type { Customer, Settings, StockRow } from '@/types/database';

export default async function VentasPage() {
  await requireProfile();

  const supabase = await getSupabaseServerClient();

  const [{ data: stock }, { data: clientes }, { data: ajustes }] = await Promise.all([
    supabase
      .from('v_stock')
      .select('*')
      .eq('is_active', true)
      .eq('product_is_active', true)
      .gt('qty_available', 0)
      .order('product_name')
      .limit(500),
    supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .order('full_name')
      .limit(500),
    supabase.from('settings').select('*').maybeSingle(),
  ]);

  return (
    <PuntoDeVenta
      stock={(stock ?? []) as StockRow[]}
      clientes={(clientes ?? []) as Customer[]}
      ajustes={ajustes as Settings}
    />
  );
}
