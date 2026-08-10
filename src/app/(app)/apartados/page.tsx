import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { ListaOrdenes } from '@/features/orders/components/lista-ordenes';
import { Button } from '@/components/ui/button';

export default async function ApartadosPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  await requireProfile();
  const { ver } = await searchParams;
  const soloAbiertas = ver !== 'todos';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-tinta">Apartados</h1>
          <p className="text-sm text-tinta-suave">
            La prenda queda separada del stock disponible, pero no se descuenta del inventario
            hasta terminar de pagarse.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/apartados">
          <Button variant={soloAbiertas ? 'primary' : 'secondary'} size="sm">
            Pendientes
          </Button>
        </Link>
        <Link href="/apartados?ver=todos">
          <Button variant={soloAbiertas ? 'secondary' : 'primary'} size="sm">
            Todos
          </Button>
        </Link>
      </div>

      <ListaOrdenes tipo="apartado" base="/apartados" soloAbiertas={soloAbiertas} />
    </div>
  );
}
