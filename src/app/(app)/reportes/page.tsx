import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { fechaLocalISO, formatDate } from '@/lib/utils';
import { Card, CardHeader, EmptyState } from '@/components/ui/surfaces';
import { ETIQUETA_METODO } from '@/features/orders/schemas';
import type { CashBucket, CashByMethod, ProfitBucket, TopProduct } from '@/types/database';

const RANGOS = {
  dia: { dias: 13, granularidad: 'day', titulo: 'Últimos 14 días' },
  semana: { dias: 83, granularidad: 'week', titulo: 'Últimas 12 semanas' },
  mes: { dias: 364, granularidad: 'month', titulo: 'Últimos 12 meses' },
} as const;

type Rango = keyof typeof RANGOS;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  await requireAdmin();

  const { rango } = await searchParams;
  const clave: Rango = rango === 'semana' || rango === 'mes' ? rango : 'dia';
  const cfg = RANGOS[clave];

  const supabase = await getSupabaseServerClient();

  // La zona horaria de la tienda decide dónde corta el día. Sin esto, el rango
  // se calcularía en UTC y en Venezuela las ventas de la noche caerían en el día
  // siguiente.
  const { data: ajustes } = await supabase.from('settings').select('timezone').maybeSingle();
  const zona = ajustes?.timezone ?? 'America/Caracas';

  const hoy = new Date();
  const desde = new Date(hoy);
  desde.setDate(desde.getDate() - cfg.dias);

  const iso = (d: Date) => fechaLocalISO(d, zona);

  const [{ data: caja }, { data: porMetodo }, { data: ganancia }, { data: top }] =
    await Promise.all([
      supabase.rpc('report_cash', {
        p_from: iso(desde),
        p_to: iso(hoy),
        p_granularity: cfg.granularidad,
      }),
      supabase.rpc('report_cash_by_method', { p_from: iso(desde), p_to: iso(hoy) }),
      supabase.rpc('report_profit', {
        p_from: iso(desde),
        p_to: iso(hoy),
        p_granularity: cfg.granularidad,
      }),
      supabase.rpc('report_top_products', { p_from: iso(desde), p_to: iso(hoy), p_limit: 8 }),
    ]);

  const serieCaja = (caja ?? []) as CashBucket[];
  const metodos = (porMetodo ?? []) as CashByMethod[];
  const serieGanancia = (ganancia ?? []) as ProfitBucket[];
  const productos = (top ?? []) as TopProduct[];

  const totalCaja = serieCaja.reduce((s, b) => s + b.net_cents, 0);
  const totalGanancia = serieGanancia.reduce((s, b) => s + b.profit_cents, 0);
  const maximo = Math.max(1, ...serieCaja.map((b) => Math.abs(b.net_cents)));

  const gananciaPorBucket = new Map(serieGanancia.map((b) => [b.bucket, b]));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Reportes</h1>
        <p className="text-sm text-tinta-suave">
          Base caja: el dinero cuenta el día en que se recibe.
        </p>
      </div>

      <div className="flex gap-2">
        {(Object.keys(RANGOS) as Rango[]).map((r) => (
          <a
            key={r}
            href={`/reportes?rango=${r}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              clave === r
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde text-tinta-suave'
            }`}
          >
            {r === 'dia' ? 'Diario' : r === 'semana' ? 'Semanal' : 'Mensual'}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-tenue">Caja del período</p>
          <p className="tabular mt-1 text-2xl font-bold text-tinta">{formatMoney(totalCaja)}</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-tinta-tenue">Ganancia</p>
          <p className="tabular mt-1 text-2xl font-bold text-verde">
            {formatMoney(totalGanancia)}
          </p>
        </Card>
      </div>

      {/* Serie de caja ------------------------------------------------------ */}
      <Card>
        <CardHeader title={cfg.titulo} subtitle="Dinero recibido y ganancia" />

        {serieCaja.length === 0 ? (
          <EmptyState title="Sin movimientos en el período" />
        ) : (
          <ul className="divide-y divide-borde">
            {serieCaja.map((b) => {
              const g = gananciaPorBucket.get(b.bucket);
              const ancho = Math.round((Math.abs(b.net_cents) / maximo) * 100);

              return (
                <li key={b.bucket} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-tinta-suave">{formatDate(b.bucket)}</span>
                    <span className="tabular font-semibold text-tinta">
                      {formatMoney(b.net_cents)}
                      {g && g.profit_cents !== 0 ? (
                        <span className="ml-2 text-xs font-normal text-verde">
                          +{formatMoney(g.profit_cents)}
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-borde">
                    <div
                      className={`h-full rounded-full ${b.net_cents < 0 ? 'bg-rojo' : 'bg-marca'}`}
                      style={{ width: `${ancho}%` }}
                    />
                  </div>

                  {b.out_cents > 0 ? (
                    <p className="tabular mt-0.5 text-xs text-rojo">
                      salidas {formatMoney(b.out_cents)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Cuadre por método -------------------------------------------------- */}
      <Card>
        <CardHeader title="Por método de pago" subtitle="Para cuadrar la caja al cierre" />

        {metodos.length === 0 ? (
          <EmptyState title="Sin movimientos" />
        ) : (
          <ul className="divide-y divide-borde">
            {metodos.map((m) => (
              <li key={m.method} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-tinta">
                  {ETIQUETA_METODO[m.method] ?? m.method}
                  <span className="ml-2 text-xs text-tinta-tenue">{m.movements} mov.</span>
                </span>
                <span className="tabular text-sm font-semibold text-tinta">
                  {formatMoney(m.net_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Más vendidas -------------------------------------------------------- */}
      <Card>
        <CardHeader title="Más vendidas" subtitle="Por unidades salidas en el período" />

        {productos.length === 0 ? (
          <EmptyState title="Sin ventas en el período" />
        ) : (
          <ul className="divide-y divide-borde">
            {productos.map((p) => (
              <li key={p.variant_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-tinta">{p.label}</p>
                  <p className="text-xs text-tinta-tenue">{p.sku}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-tinta">
                    {p.units_sold} u · {formatMoney(p.revenue_cents)}
                  </p>
                  <p className="tabular text-xs text-verde">
                    ganancia {formatMoney(p.profit_cents)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
