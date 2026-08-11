import { requireProfile } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardHeader } from '@/components/ui/surfaces';
import { CambiarPassword } from './cambiar-password';

/**
 * Cuenta propia. Accesible para TODO el personal, no solo administradores:
 * quien recibe una contraseña temporal tiene que poder reemplazarla sin
 * pedirle permiso a nadie.
 */
export default async function CuentaPage() {
  const profile = await requireProfile();

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Mi cuenta</h1>
        <p className="text-sm text-tinta-suave">
          {profile.full_name} · {profile.role === 'admin' ? 'Administrador' : 'Vendedor'}
        </p>
      </div>

      <Card>
        <CardHeader title="Datos de acceso" />
        <dl className="px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-tinta-suave">Correo</dt>
            <dd className="text-tinta">{user?.email ?? '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Cambiar contraseña"
          subtitle="Se pide la actual para confirmar que eres tú"
        />
        <CambiarPassword />
      </Card>
    </div>
  );
}
