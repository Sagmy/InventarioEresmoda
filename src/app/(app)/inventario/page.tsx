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
import type { ProductImage, StockRow } from '@/types/database';

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q, filtro } = await searchParams;
  const profile = await requireProfile();
  const esAdmin = profile.role === 'admin';

  const supabase = await getSupabaseServerClient();

  // Sin esta vista no habría vuelta atrás: una prenda retirada desaparece del
  // listado, y sin poder listarlas nadie podría reactivarla nunca.
  const verRetiradas = filtro === 'retiradas';

  let consulta = supabase.from('v_stock').select('*');

  if (verRetiradas) {
    // Retirada puede serlo la variante sola o la prenda entera: cualquiera de
    // las dos la saca del mostrador.
    consulta = consulta.or('is_active.eq.false,product_is_active.eq.false');
  } else {
    consulta = consulta.eq('is_active', true).eq('product_is_active', true);
  }

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

  // Se consultan aparte y no se sacan de `filas`: el listado viene filtrado y
  // limitado, así que sugeriría solo los colores de lo que hay en pantalla.
  const { data: variantes } = await supabase.from('product_variants').select('color');

  const coloresUsados = [
    ...new Set(
      (variantes ?? [])
        .map((v) => v.color?.trim())
        .filter((c): c is string => Boolean(c) && c !== 'Único'),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'));

  // Las fotos se piden aparte en vez de meterlas en v_stock: esa vista la usa
  // también el punto de venta, y no conviene engordarla para una miniatura.
  const idsProducto = [...new Set(filas.map((f) => f.product_id))];

  const { data: imagenes } = idsProducto.length
    ? await supabase
        .from('product_images')
        .select('*')
        .in('product_id', idsProducto)
        .order('sort_order')
    : { data: [] };

  // Gana la foto del color exacto; la genérica (color null) queda de respaldo.
  const portadas = new Map<string, string>();

  for (const img of (imagenes ?? []) as ProductImage[]) {
    const claveColor = `${img.product_id}·${img.color ?? ''}`;
    if (!portadas.has(claveColor)) portadas.set(claveColor, img.storage_path);
  }

  const portadaDe = (fila: StockRow) =>
    portadas.get(`${fila.product_id}·${fila.color}`) ?? portadas.get(`${fila.product_id}·`);

  const urlPublica = (ruta: string) =>
    supabase.storage.from('prendas').getPublicUrl(ruta).data.publicUrl;

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
            title={
              q ? 'Sin resultados' : verRetiradas ? 'No hay prendas retiradas' : 'Todavía no hay prendas'
            }
            description={
              q
                ? 'Prueba con otro nombre, color o código.'
                : verRetiradas
                  ? 'Aquí aparecen las que saques del mostrador, por si hay que devolverlas.'
                  : esAdmin
                    ? 'Agrega tu primera prenda para empezar a vender.'
                    : 'Pídele a un administrador que cargue el inventario.'
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-borde">
          {filas.map((fila) => (
            /* En celular la fila se apila: el nombre necesita el ancho completo
               o queda cortado en tres letras. A partir de 640 px vuelve a una
               sola línea, que aprovecha mejor la pantalla grande. */
            <div key={fila.variant_id} className="px-4 py-3 sm:flex sm:items-center sm:gap-4">
              <div className="flex items-start gap-3 sm:min-w-0 sm:flex-1">
                {(() => {
                  const ruta = portadaDe(fila);

                  return ruta ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={urlPublica(ruta)}
                      alt=""
                      className="size-12 shrink-0 rounded-lg border border-borde object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-borde text-[10px] text-tinta-tenue"
                    >
                      sin foto
                    </div>
                  );
                })()}

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-tinta">{fila.product_name}</p>
                  <p className="text-sm text-tinta-suave">
                    {fila.color} · {fila.size}
                    <span className="ml-2 text-xs text-tinta-tenue">{fila.sku}</span>
                  </p>
                  <p className="tabular mt-0.5 text-sm font-medium text-tinta">
                    {formatMoney(fila.price_cents)}
                  </p>
                </div>

                {/* El menú acompaña al nombre en celular; en pantalla ancha se
                    va al extremo derecho de la fila. */}
                {esAdmin ? (
                  <div className="shrink-0 sm:hidden">
                    <AccionesStock
                    variantId={fila.variant_id}
                    productId={fila.product_id}
                    etiqueta={fila.label}
                    nombreProducto={fila.product_name}
                    varianteActiva={fila.is_active}
                    productoActivo={fila.product_is_active}
                    precioActual={fila.price_cents}
                    coloresUsados={coloresUsados}
                  />
                  </div>
                ) : null}
              </div>

              <div className="mt-2 flex justify-start sm:mt-0 sm:shrink-0">
                <StockNumbers
                  available={fila.qty_available}
                  reserved={fila.qty_reserved}
                  onHand={fila.qty_on_hand}
                  size="sm"
                />
              </div>

              {esAdmin ? (
                <div className="hidden sm:block">
                  <AccionesStock
                    variantId={fila.variant_id}
                    productId={fila.product_id}
                    etiqueta={fila.label}
                    nombreProducto={fila.product_name}
                    varianteActiva={fila.is_active}
                    productoActivo={fila.product_is_active}
                    precioActual={fila.price_cents}
                    coloresUsados={coloresUsados}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
