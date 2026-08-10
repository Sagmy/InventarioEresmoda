import Link from 'next/link';
import { AlertTriangle, PackageX } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { Card, CardHeader, EmptyState } from '@/components/ui/surfaces';
import { AlertChip, PaymentProgress } from '@/components/ui/status';
import type { CollectionRow, DashboardSummary } from '@/types/database';

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await getSupabaseServerClient();

  const [{ data: resumen }, { data: cobros }] = await Promise.all([
    supabase.rpc('dashboard_summary'),
    supabase
      .from('v_collections_due')
      .select('*')
      .neq('alert_level', 'verde')
      .order('urgency_rank', { ascending: true })
      .order('days_elapsed', { ascending: false })
      .limit(6),
  ]);

  const datos = resumen as DashboardSummary | null;
  const porCobrar = (cobros ?? []) as CollectionRow[];
  const esAdmin = profile.role === 'admin';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Tablero</h1>
        <p className="text-sm text-tinta-suave">
          {new Intl.DateTimeFormat('es-VE', { dateStyle: 'full' }).format(new Date())}
        </p>
      </div>

      {/* Caja en base efectivo: lo que realmente entró, no lo facturado. */}
      {esAdmin && datos?.cash ? (
        <section className="grid grid-cols-3 gap-3">
          <Cifra titulo="Hoy" valor={datos.cash.today} destacado />
          <Cifra titulo="Esta semana" valor={datos.cash.week} />
          <Cifra titulo="Este mes" valor={datos.cash.month} />
        </section>
      ) : null}

      {esAdmin && datos?.profit ? (
        <section className="grid grid-cols-3 gap-3">
          <Cifra titulo="Ganancia hoy" valor={datos.profit.today} tenue />
          <Cifra titulo="Ganancia semana" valor={datos.profit.week} tenue />
          <Cifra titulo="Ganancia mes" valor={datos.profit.month} tenue />
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Aviso
          href="/cobros"
          icono={<AlertTriangle className="size-4" />}
          cantidad={(datos?.collections.red ?? 0) + (datos?.collections.yellow ?? 0)}
          titulo="Cobros por atender"
          detalle={
            datos
              ? `${datos.collections.red} vencidos · ${datos.collections.yellow} por vencer · ${formatMoney(datos.collections.pending_cents)} pendiente`
              : undefined
          }
        />
        <Aviso
          href="/inventario?filtro=bajo"
          icono={<PackageX className="size-4" />}
          cantidad={datos?.low_stock ?? 0}
          titulo="Prendas con poco stock"
          detalle="Revisa qué hay que reponer"
        />
      </section>

      <Card>
        <CardHeader
          title="Toca cobrar"
          subtitle="Apartados y créditos que ya pasaron su fecha de aviso"
          action={
            <Link href="/cobros" className="text-sm font-medium text-marca hover:underline">
              Ver todos
            </Link>
          }
        />

        {porCobrar.length === 0 ? (
          <EmptyState
            title="Todo al día"
            description="No hay apartados ni créditos que requieran cobranza en este momento."
          />
        ) : (
          <ul className="divide-y divide-borde">
            {porCobrar.map((cobro) => (
              <li key={cobro.order_id} className="px-4 py-3">
                <Link href={`/${cobro.type === 'apartado' ? 'apartados' : 'creditos'}/${cobro.order_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-tinta">
                        {cobro.customer_name ?? 'Sin cliente'}
                      </p>
                      <p className="text-xs text-tinta-suave">
                        {cobro.type === 'apartado' ? 'Apartado' : 'Crédito'} #{cobro.order_number}
                      </p>
                    </div>

                    <AlertChip level={cobro.alert_level}>
                      {cobro.type === 'apartado' && cobro.days_left !== null
                        ? cobro.days_left < 0
                          ? `vencido hace ${Math.abs(cobro.days_left)} d`
                          : `faltan ${cobro.days_left} d`
                        : `${cobro.days_elapsed} días`}
                    </AlertChip>
                  </div>

                  <div className="mt-2 max-w-sm">
                    <PaymentProgress paidCents={cobro.paid_cents} totalCents={cobro.total_cents} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Cifra({
  titulo,
  valor,
  destacado = false,
  tenue = false,
}: {
  titulo: string;
  valor: number;
  destacado?: boolean;
  tenue?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-tinta-tenue">{titulo}</p>
      <p
        className={`tabular mt-1 font-bold ${destacado ? 'text-2xl' : 'text-xl'} ${
          tenue ? 'text-tinta-suave' : 'text-tinta'
        }`}
      >
        {formatMoney(valor)}
      </p>
    </Card>
  );
}

function Aviso({
  href,
  icono,
  cantidad,
  titulo,
  detalle,
}: {
  href: string;
  icono: React.ReactNode;
  cantidad: number;
  titulo: string;
  detalle?: string | undefined;
}) {
  const hayAlgo = cantidad > 0;

  return (
    <Link href={href}>
      <Card
        className={`flex items-center gap-3 p-4 transition-colors hover:border-borde-fuerte ${
          hayAlgo ? 'border-ambar/40 bg-ambar-suave' : ''
        }`}
      >
        <span className={hayAlgo ? 'text-ambar' : 'text-tinta-tenue'}>{icono}</span>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-tinta">
            {cantidad} {titulo}
          </p>
          {detalle ? <p className="truncate text-xs text-tinta-suave">{detalle}</p> : null}
        </div>
      </Card>
    </Link>
  );
}
