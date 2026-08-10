import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { Card, CardHeader } from '@/components/ui/surfaces';
import { FormularioAjustes } from './formulario';
import { GestionUsuarios } from './usuarios';
import type { Profile, Settings } from '@/types/database';

export default async function AjustesPage() {
  const yo = await requireAdmin();
  const supabase = await getSupabaseServerClient();

  const [{ data: ajustes }, { data: usuarios }] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('profiles').select('*').order('created_at'),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-tinta">Ajustes</h1>
        <p className="text-sm text-tinta-suave">
          Las reglas se aplican en la base de datos, no solo en la pantalla: cambiarlas aquí
          cambia lo que el sistema acepta.
        </p>
      </div>

      <FormularioAjustes ajustes={ajustes as Settings} />

      <Card>
        <CardHeader
          title="Equipo"
          subtitle="Las cuentas nuevas entran inactivas hasta que las habilites"
        />
        <GestionUsuarios usuarios={(usuarios ?? []) as Profile[]} miId={yo.id} />
      </Card>
    </div>
  );
}
