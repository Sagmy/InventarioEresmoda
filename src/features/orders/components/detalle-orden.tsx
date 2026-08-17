import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/surfaces';
import { PaymentBadge, PaymentProgress } from '@/components/ui/status';
import { AbonoForm } from './abono-form';
import { CancelarOrden } from './cancelar-orden';
import { AnularPago } from './anular-pago';
import { DevolucionForm } from './devolucion-form';
import { ETIQUETA_METODO } from '@/features/orders/schemas';
import type { OrderItemRow, OrderRow, Payment } from '@/types/database';

export async function DetalleOrden({ orderId }: { orderId: string }) {
  const profile = await getCurrentProfile();
  const supabase = await getSupabaseServerClient();

  const { data: orden } = await supabase
    .from('v_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!orden) notFound();

  const o = orden as OrderRow;

  const [{ data: lineas }, { data: pagos }] = await Promise.all([
    supabase.from('v_order_items').select('*').eq('order_id', orderId),
    supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('paid_at', { ascending: true }),
  ]);

  const items = (lineas ?? []) as OrderItemRow[];
  const abonos = (pagos ?? []) as Payment[];
  const esAdmin = profile?.role === 'admin';
  const abierta = o.status === 'open';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-tinta">
            {o.type === 'apartado' ? 'Apartado' : o.type === 'credito' ? 'Crédito' : 'Venta'} #
            {o.order_number}
          </h1>
          <p className="text-sm text-tinta-suave">
            {o.customer_name ?? 'Sin cliente'}
            {o.customer_phone ? ` · ${o.customer_phone}` : ''}
          </p>
        </div>

        <PaymentBadge status={o.status === 'cancelled' ? 'cancelado' : o.payment_status} />
      </div>

      {/* Progreso del pago ------------------------------------------------- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-tinta-suave">Total</span>
          <span className="tabular text-xl font-bold text-tinta">
            {formatMoney(o.total_cents)}
          </span>
        </div>

        <PaymentProgress paidCents={o.paid_cents} totalCents={o.total_cents} />

        <dl className="grid grid-cols-2 gap-2 pt-1 text-sm">
          <Dato termino="Registrada" valor={formatDate(o.created_at)} />
          {o.type === 'apartado' ? (
            <Dato termino="Vence" valor={o.due_date ? formatDate(o.due_date) : '—'} />
          ) : o.type === 'credito' ? (
            <Dato termino="Vencimiento" valor="Sin fecha límite" />
          ) : null}
          <Dato termino="Registró" valor={o.created_by_name ?? '—'} />
          {o.price_kind === 'promo' ? <Dato termino="Precio" valor="Promoción" /> : null}
        </dl>

        {o.notes ? (
          <p className="rounded-lg bg-lienzo px-3 py-2 text-sm text-tinta-suave">{o.notes}</p>
        ) : null}

        {o.status === 'cancelled' ? (
          <p className="rounded-lg bg-rojo-suave px-3 py-2 text-sm text-rojo">
            Cancelada el {formatDate(o.cancelled_at)}
            {o.cancel_reason ? `: ${o.cancel_reason}` : ''}
          </p>
        ) : null}
      </Card>

      {/* Registrar abono ---------------------------------------------------- */}
      {abierta ? (
        <Card>
          <CardHeader
            title="Registrar abono"
            subtitle={`Faltan ${formatMoney(o.balance_cents)}`}
          />
          <div className="p-4">
            <AbonoForm orderId={o.id} balanceCents={o.balance_cents} />
          </div>
        </Card>
      ) : null}

      {/* Prendas ------------------------------------------------------------ */}
      <Card>
        <CardHeader title="Prendas" />
        <ul className="divide-y divide-borde">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-tinta">{i.variant_label}</p>
                <p className="tabular text-xs text-tinta-suave">
                  {i.qty} × {formatMoney(i.unit_price_cents)}
                  {i.line_discount_cents > 0 ? (
                    <span className="ml-2 text-marca">
                      ahorro {formatMoney(i.line_discount_cents)}
                    </span>
                  ) : null}
                  {i.returned_qty > 0 ? (
                    <span className="ml-2 text-rojo">{i.returned_qty} devuelta(s)</span>
                  ) : null}
                </p>
              </div>

              <span className="tabular shrink-0 text-sm font-semibold text-tinta">
                {formatMoney(i.line_total_cents)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Historial de pagos -------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Pagos"
          subtitle={`${abonos.filter((p) => !p.voided_at).length} registrados`}
        />

        {abonos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-tinta-suave">Todavía sin pagos.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {abonos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className={`text-sm ${p.voided_at ? 'text-tinta-tenue line-through' : 'text-tinta'}`}>
                    {ETIQUETA_METODO[p.method] ?? p.method}
                    {p.reference ? (
                      <span className="ml-2 text-xs text-tinta-tenue">{p.reference}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-tinta-suave">{formatDateTime(p.paid_at)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`tabular text-sm font-semibold ${
                      p.voided_at ? 'text-tinta-tenue line-through' : 'text-tinta'
                    }`}
                  >
                    {formatMoney(p.amount_cents)}
                  </span>

                  {/* Anular solo tiene sentido mientras la transacción siga
                      abierta; si ya se liquidó, la mercancía salió y lo que
                      corresponde es una devolución. */}
                  {esAdmin && abierta && !p.voided_at ? (
                    <AnularPago
                      paymentId={p.id}
                      amountCents={p.amount_cents}
                      method={p.method}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Devolución: solo cuando la venta ya se liquidó y la prenda salió ----- */}
      {o.status === 'completed' ? (
        <Card>
          <CardHeader
            title="Devolución"
            subtitle="El cliente trae de vuelta una prenda de esta venta"
          />
          <div className="p-4">
            <DevolucionForm
              orderId={o.id}
              items={items}
              paidCents={o.paid_cents}
              esAdmin={esAdmin}
            />
          </div>
        </Card>
      ) : null}

      {/* Cancelación: solo admin y solo si sigue abierta --------------------- */}
      {abierta && esAdmin ? (
        <Card className="p-4">
          <CancelarOrden orderId={o.id} tipo={o.type} paidCents={o.paid_cents} />
        </Card>
      ) : null}
    </div>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-tinta-tenue">{termino}</dt>
      <dd className="text-tinta">{valor}</dd>
    </div>
  );
}
