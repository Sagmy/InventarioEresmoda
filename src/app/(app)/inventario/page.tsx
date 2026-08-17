import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { StockNumbers } from '@/components/ui/status';
import { BuscadorInventario } from './buscador';
import { AccionesStock } from './acciones-stock';
import type { StockRow } from '@/types/database';

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q, filtro } = await searchParams;
  const profile = await requireProfile();
  const esAdmin = profile.role === 'admin';

  const supabase = await getSupabaseServerClient();

  let consulta = supabase
    .from('v_stock')
    .select('*')
    .eq('is_active', true)
    .eq('product_is_active', true);

  if (q && q.trim() !== '') {
    // El buscador cubre nombre, color, talla y SKU de una sola vez.
    const patron = `%${q.trim()}%`;
    consulta = consulta.or(`label.ilike.${patron},sku.ilike.${patron}`);
  }

  if (filtro === 'bajo') consulta = consulta.eq('is_low_stock', true);
  if (filtro === 'agotado') consulta = consulta.eq('is_out_of_stock', true);
  if (filtro === 'apartado') consulta = consulta.gt('qty_reserved', 0);

  const { data } = await consulta
    .order('product_name', { ascending: true })
    .order('color', { ascending: true })
    .order('size', { ascending: true })
    .limit(300);

  const filas = (data ?? []) as StockRow[];

  const totalApartado = filas.reduce((suma, f) => suma + f.qty_reserved, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-tinta">Inventario</h1>
          <p className="text-sm text-tinta-suave">
            {filas.length} {filas.length === 1 ? 'prenda' : 'prendas'}
            {totalApartado > 0 ? (
              <>
                {' · '}
                <span className="text-ambar">{totalApartado} apartadas</span>
              </>
            ) : null}
          </p>
        </div>

        {esAdmin ? (
          <Link href="/inventario/nuevo">
            <Button size="sm">
              <Plus className="size-4" />
              Nueva prenda
            </Button>
          </Link>
        ) : null}
      </div>

      <BuscadorInventario valorInicial={q ?? ''} filtroActivo={filtro ?? ''} />

      {filas.length === 0 ? (
        <Card>
          <EmptyState
            title={q ? 'Sin resultados' : 'Todavía no hay prendas'}
            description={
              q
                ? 'Prueba con otro nombre, color o código.'
                : esAdmin
                  ? 'Agrega tu primera prenda para empezar a vender.'
                  : 'Pídele a un administrador que cargue el inventario.'
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-borde">
          {filas.map((fila) => (
            <div key={fila.variant_id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-tinta">{fila.product_name}</p>
                <p className="text-sm text-tinta-suave">
                  {fila.color} · {fila.size}
                  <span className="ml-2 text-xs text-tinta-tenue">{fila.sku}</span>
                </p>
                <p className="tabular mt-0.5 text-sm font-medium text-tinta">
                  {formatMoney(fila.price_cents)}
                </p>
              </div>

              <StockNumbers
                available={fila.qty_available}
                reserved={fila.qty_reserved}
                onHand={fila.qty_on_hand}
                size="sm"
              />

              {esAdmin ? (
                <AccionesStock variantId={fila.variant_id} etiqueta={fila.label} />
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
