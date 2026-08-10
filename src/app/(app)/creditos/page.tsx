import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { ListaOrdenes } from '@/features/orders/components/lista-ordenes';
import { Button } from '@/components/ui/button';

export default async function CreditosPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  await requireProfile();
  const { ver } = await searchParams;
  const soloAbiertas = ver !== 'todos';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Créditos</h1>
        <p className="text-sm text-tinta-suave">
          La prenda ya salió del inventario. La deuda queda abierta sin fecha límite; el aviso de
          cobro aparece a las dos semanas.
        </p>
      </div>

      <div className="flex gap-2">
        <Link href="/creditos">
          <Button variant={soloAbiertas ? 'primary' : 'secondary'} size="sm">
            Por cobrar
          </Button>
        </Link>
        <Link href="/creditos?ver=todos">
          <Button variant={soloAbiertas ? 'secondary' : 'primary'} size="sm">
            Todos
          </Button>
        </Link>
      </div>

      <ListaOrdenes tipo="credito" base="/creditos" soloAbiertas={soloAbiertas} />
    </div>
  );
}
