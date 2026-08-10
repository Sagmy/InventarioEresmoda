import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/money';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { NuevoCliente } from './nuevo-cliente';
import type { Customer, CollectionRow } from '@/types/database';

export default async function ClientesPage() {
  await requireProfile();
  const supabase = await getSupabaseServerClient();

  const [{ data: clientes }, { data: deudas }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
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
            {lista.length} {lista.length === 1 ? 'registrado' : 'registrados'}
          </p>
        </div>

        <NuevoCliente />
      </div>

      {lista.length === 0 ? (
        <Card>
          <EmptyState
            title="Todavía sin clientes"
            description="Los clientes hacen falta para apartados y créditos: sin ellos no se sabe a quién cobrarle."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-borde">
          {lista.map((c) => {
            const saldo = saldoPorCliente.get(c.id) ?? 0;

            return (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-tinta">{c.full_name}</p>
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
