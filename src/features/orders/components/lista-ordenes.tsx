import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { PaymentBadge, PaymentProgress } from '@/components/ui/status';
import type { OrderRow, OrderType } from '@/types/database';

/**
 * Listado compartido por Apartados y Créditos. Son la misma estructura de datos
 * con reglas distintas, así que la pantalla es una sola.
 */
export async function ListaOrdenes({
  tipo,
  base,
  soloAbiertas,
}: {
  tipo: Extract<OrderType, 'apartado' | 'credito'>;
  base: string;
  soloAbiertas: boolean;
}) {
  const supabase = await getSupabaseServerClient();

  let consulta = supabase.from('v_orders').select('*').eq('type', tipo);

  if (soloAbiertas) consulta = consulta.eq('status', 'open');

  const { data } = await consulta.order('created_at', { ascending: false }).limit(200);
  const ordenes = (data ?? []) as OrderRow[];

  if (ordenes.length === 0) {
    return (
      <Card>
        <EmptyState
          title={soloAbiertas ? 'Nada pendiente' : 'Sin registros'}
          description={
            tipo === 'apartado'
              ? 'Los apartados que registres aparecerán aquí con su progreso de pago.'
              : 'Las ventas a crédito aparecerán aquí con lo que falta por cobrar.'
          }
        />
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-borde">
      {ordenes.map((o) => (
        <Link key={o.id} href={`${base}/${o.id}`} className="block px-4 py-3 hover:bg-lienzo">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-tinta">
                {o.customer_name ?? 'Sin cliente'}
              </p>
              <p className="text-xs text-tinta-suave">
                #{o.order_number} · {formatDate(o.created_at)} · {o.item_count}{' '}
                {o.item_count === 1 ? 'prenda' : 'prendas'}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <PaymentBadge status={o.status === 'cancelled' ? 'cancelado' : o.payment_status} />
              <p className="tabular mt-1 text-sm font-semibold text-tinta">
                {formatMoney(o.total_cents)}
              </p>
            </div>
          </div>

          {o.status === 'open' ? (
            <div className="mt-2">
              <PaymentProgress paidCents={o.paid_cents} totalCents={o.total_cents} />
            </div>
          ) : null}

          {tipo === 'apartado' && o.status === 'open' && o.due_date ? (
            <p className="mt-1 text-xs text-tinta-tenue">Vence {formatDate(o.due_date)}</p>
          ) : null}
        </Link>
      ))}
    </Card>
  );
}
