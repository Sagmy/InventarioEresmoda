import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';
import { Sidebar, BottomNav } from '@/components/nav';
import { RealtimeRefresher } from '@/components/realtime';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surfaces';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) redirect('/login');

  // Un usuario recién registrado existe pero no está habilitado. No ve nada de
  // la tienda hasta que un administrador lo active: la base de datos le
  // devolvería cero filas de todas formas, así que se lo decimos claro.
  if (!profile.is_active) {
    return <CuentaPendiente name={profile.full_name} />;
  }

  const isAdmin = profile.role === 'admin';

  const supabase = await getSupabaseServerClient();
  const { count } = await supabase
    .from('v_collections_due')
    .select('order_id', { count: 'exact', head: true })
    .neq('alert_level', 'verde');

  return (
    <div className="flex min-h-dvh flex-col">
      <RealtimeRefresher />

      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-borde bg-superficie px-4 py-3">
        <span className="font-bold tracking-tight text-tinta">Eresmoda</span>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-tinta-suave sm:inline">
            {profile.full_name}
            <span className="ml-2 rounded bg-lienzo px-1.5 py-0.5 text-xs text-tinta-tenue">
              {isAdmin ? 'admin' : 'vendedor'}
            </span>
          </span>

          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar isAdmin={isAdmin} pendingCount={count ?? 0} />

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8">{children}</main>
      </div>

      <BottomNav pendingCount={count ?? 0} />
    </div>
  );
}

function CuentaPendiente({ name }: { name: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="max-w-md p-6 text-center">
        <h1 className="font-semibold text-tinta">Hola, {name}</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          Tu cuenta se creó correctamente, pero todavía no está habilitada. Un administrador
          tiene que activarla desde Ajustes para que puedas entrar.
        </p>

        <form action={signOut} className="mt-5">
          <Button type="submit" variant="secondary" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </Card>
    </main>
  );
}
