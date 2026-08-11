import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { NuevoCliente } from './nuevo-cliente';
import { AccionesCliente } from './acciones-cliente';
import type { Customer, CollectionRow } from '@/types/database';

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const profile = await requireProfile();
  const { ver } = await searchParams;
  const verInactivos = ver === 'inactivos';

  const supabase = await getSupabaseServerClient();

  const [{ data: clientes }, { data: deudas }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('is_active', !verInactivos)
      .order('full_name')
      .limit(500),
    supabase.from('v_collections_due').select('customer_id, balance_cents, type'),
  ]);

  const lista = (clientes ?? []) as Customer[];
  const pendientes = (deudas ?? []) as Pick<
    CollectionRow,
    'customer_id' | 'balance_cents' | 'type'
  >[];

  // Cuánto debe cada cliente, sumando apartados y créditos abiertos.
  const saldoPorCliente = new Map<string, number>();
  for (const d of pendientes) {
    if (!d.customer_id) continue;
    saldoPorCliente.set(d.customer_id, (saldoPorCliente.get(d.customer_id) ?? 0) + d.balance_cents);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-tinta">Clientes</h1>
          <p className="text-sm text-tinta-suave">
            {lista.length} {verInactivos ? 'inactivo' : 'activo'}
            {lista.length === 1 ? '' : 's'}
          </p>
        </div>

        <NuevoCliente />
      </div>

      <div className="flex gap-2">
        <Filtro href="/clientes" activo={!verInactivos}>
          Activos
        </Filtro>
        <Filtro href="/clientes?ver=inactivos" activo={verInactivos}>
          Inactivos
        </Filtro>
      </div>

      {lista.length === 0 ? (
        <Card>
          <EmptyState
            title={verInactivos ? 'Ningún cliente inactivo' : 'Todavía sin clientes'}
            description={
              verInactivos
                ? 'Aquí aparecen los que desactives. Su historial de compras se conserva.'
                : 'Los clientes hacen falta para apartados y créditos: sin ellos no se sabe a quién cobrarle.'
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-borde">
          {lista.map((c) => {
            const saldo = saldoPorCliente.get(c.id) ?? 0;

            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-tinta">
                    {c.full_name}
                    {!c.is_active ? (
                      <span className="ml-2 text-xs font-normal text-tinta-tenue">inactivo</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-tinta-suave">
                    {c.phone ?? 'Sin teléfono'}
                    {c.document_id ? ` · ${c.document_id}` : ''}
                  </p>
                </div>

                {saldo > 0 ? (
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold text-ambar">
                      {formatMoney(saldo)}
                    </p>
                    <p className="text-[11px] text-tinta-tenue">debe</p>
                  </div>
                ) : (
                  <span className="shrink-0 text-xs text-tinta-tenue">al día</span>
                )}

                <AccionesCliente
                  cliente={c}
                  esAdmin={profile.role === 'admin'}
                  tieneDeuda={saldo > 0}
                />
              </div>
            );
          })}
        </Card>
      )}

      <p className="text-center text-xs text-tinta-tenue">
        Para ver el detalle de lo que debe un cliente, revisa{' '}
        <Link href="/cobros" className="text-marca hover:underline">
          Cobros
        </Link>
        .
      </p>
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
