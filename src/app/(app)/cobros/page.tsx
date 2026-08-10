import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, EmptyState } from '@/components/ui/surfaces';
import { AlertChip, PaymentProgress } from '@/components/ui/status';
import type { CollectionRow, Settings } from '@/types/database';

/**
 * Panel de cobros: apartados y créditos abiertos, ordenados por urgencia.
 *
 * El sistema avisa pero nunca actúa. Un apartado vencido aparece en rojo y ahí
 * se queda: liberar la prenda es siempre una decisión manual del dueño.
 */
export default async function CobrosPage() {
  await requireProfile();
  const supabase = await getSupabaseServerClient();

  const [{ data }, { data: ajustes }] = await Promise.all([
    supabase
      .from('v_collections_due')
      .select('*')
      .order('urgency_rank', { ascending: true })
      .order('days_elapsed', { ascending: false })
      .limit(200),
    supabase.from('settings').select('*').maybeSingle(),
  ]);

  const filas = (data ?? []) as CollectionRow[];
  const cfg = ajustes as Settings | null;

  const rojos = filas.filter((f) => f.alert_level === 'rojo');
  const amarillos = filas.filter((f) => f.alert_level === 'amarillo');
  const verdes = filas.filter((f) => f.alert_level === 'verde');

  const totalPendiente = filas.reduce((s, f) => s + f.balance_cents, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Cobros</h1>
        <p className="text-sm text-tinta-suave">
          {formatMoney(totalPendiente)} por cobrar en {filas.length}{' '}
          {filas.length === 1 ? 'transacción' : 'transacciones'}
        </p>
      </div>

      {cfg ? (
        <p className="rounded-lg border border-borde bg-superficie px-3 py-2 text-xs text-tinta-suave">
          Los <strong>apartados</strong> pasan a amarillo el día {cfg.layaway_reminder_days} y a
          rojo al vencerse ({cfg.layaway_term_days} días). Los <strong>créditos</strong> avisan al
          día {cfg.credit_reminder_days} y no vencen: se ordenan por antigüedad.
        </p>
      ) : null}

      <Grupo titulo="Vencidos" filas={rojos} vacio="Ninguno vencido." />
      <Grupo titulo="Toca cobrar" filas={amarillos} vacio="Nada por cobrar todavía." />
      <Grupo titulo="Al día" filas={verdes} vacio="Sin transacciones abiertas." />
    </div>
  );
}

function Grupo({
  titulo,
  filas,
  vacio,
}: {
  titulo: string;
  filas: CollectionRow[];
  vacio: string;
}) {
  return (
    <Card>
      <CardHeader
        title={titulo}
        subtitle={filas.length > 0 ? `${filas.length}` : undefined}
      />

      {filas.length === 0 ? (
        <EmptyState title={vacio} />
      ) : (
        <ul className="divide-y divide-borde">
          {filas.map((f) => (
            <li key={f.order_id}>
              <Link
                href={`/${f.type === 'apartado' ? 'apartados' : 'creditos'}/${f.order_id}`}
                className="block px-4 py-3 hover:bg-lienzo"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tinta">
                      {f.customer_name ?? 'Sin cliente'}
                    </p>
                    <p className="text-xs text-tinta-suave">
                      {f.type === 'apartado' ? 'Apartado' : 'Crédito'} #{f.order_number}
                      {f.customer_phone ? ` · ${f.customer_phone}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <AlertChip level={f.alert_level}>
                      {f.type === 'apartado' && f.days_left !== null
                        ? f.days_left < 0
                          ? `vencido hace ${Math.abs(f.days_left)} d`
                          : `faltan ${f.days_left} d`
                        : `${f.days_elapsed} días`}
                    </AlertChip>

                    {f.type === 'apartado' && f.due_date ? (
                      <p className="mt-1 text-[11px] text-tinta-tenue">
                        vence {formatDate(f.due_date)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2">
                  <PaymentProgress paidCents={f.paid_cents} totalCents={f.total_cents} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
