import { requireProfile } from '@/lib/auth';
import { DetalleOrden } from '@/features/orders/components/detalle-orden';

export default async function ApartadoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;

  return <DetalleOrden orderId={id} />;
}
