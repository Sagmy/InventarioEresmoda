import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { cn, fechaLocalISO, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { PaymentBadge } from '@/components/ui/status';
import type { OrderRow, Settings } from '@/types/database';

const ETIQUETA_TIPO: Record<string, string> = {
  contado: 'Contado',
  apartado: 'Apartado',
  credito: 'Crédito',
};

/**
 * Historial de ventas.
 *
 * Faltaba por completo: tras cobrar de contado, la venta desaparecía de la
 * interfaz y no había manera de volver a ella. Sin esta pantalla no se puede
 * revisar lo vendido en el día, ni abrir una venta cuando el cliente reclama, ni
 * hacerle una devolución — que es el caso más frecuente de todos.
 */
export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  await requireProfile();
  const { ver } = await searchParams;

  const supabase = await getSupabaseServerClient();

  const { data: ajustes } = await supabase.from('settings').select('*').maybeSingle();
  const zona = (ajustes as Settings | null)?.timezone ?? 'America/Caracas';
  const hoy = fechaLocalISO(new Date(), zona);

  const soloHoy = ver !== 'todas';

  let consulta = supabase.from('v_orders').select('*');

  if (soloHoy) {
    // El día de la tienda, no el de UTC: si no, las ventas de la noche se irían
    // al día siguiente.
    consulta = consulta.gte('created_at', `${hoy}T00:00:00`);
  }

  const { data } = await consulta.order('created_at', { ascending: false }).limit(200);
  const ordenes = (data ?? []) as OrderRow[];

  const totalDia = ordenes
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.total_cents, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-tinta">Historial de ventas</h1>
          <p className="text-sm text-tinta-suave">
            {ordenes.length} {ordenes.length === 1 ? 'transacción' : 'transacciones'} ·{' '}
            {formatMoney(totalDia)} en mercancía
          </p>
        </div>

        <Link href="/ventas">
          <Button size="sm">
            <ShoppingCart className="size-4" />
            Vender
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Filtro href="/ventas/historial" activo={soloHoy}>
          Hoy
        </Filtro>
        <Filtro href="/ventas/historial?ver=todas" activo={!soloHoy}>
          Todas
        </Filtro>
      </div>

      {ordenes.length === 0 ? (
        <Card>
          <EmptyState
            title={soloHoy ? 'Todavía sin ventas hoy' : 'Sin ventas registradas'}
            description="Aquí aparece todo lo vendido, con su detalle y su historial de pagos."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-borde">
          {ordenes.map((o) => (
            <Link
              key={o.id}
              href={`/ventas/${o.id}`}
              className="block px-4 py-3 hover:bg-lienzo"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-tinta">
                    #{o.order_number} · {ETIQUETA_TIPO[o.type] ?? o.type}
                    {o.price_kind === 'promo' ? (
                      <span className="ml-2 rounded bg-marca-suave px-1.5 py-0.5 text-[10px] font-semibold text-marca">
                        PROMO
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-tinta-suave">
                    {formatDateTime(o.created_at)}
                    {o.customer_name ? ` · ${o.customer_name}` : ''}
                    {` · ${o.item_count} ${o.item_count === 1 ? 'prenda' : 'prendas'}`}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <PaymentBadge
                    status={o.status === 'cancelled' ? 'cancelado' : o.payment_status}
                  />
                  <p className="tabular mt-1 text-sm font-semibold text-tinta">
                    {formatMoney(o.total_cents)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

function Filtro({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        activo
          ? 'border-marca bg-marca-suave text-marca'
          : 'border-borde text-tinta-suave hover:border-borde-fuerte',
      )}
    >
      {children}
    </Link>
  );
}
