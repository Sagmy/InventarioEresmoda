import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente con la llave de administración de Supabase.
 *
 * ⚠️  Esta llave se salta TODA la seguridad de la base de datos: ignora Row
 * Level Security y puede leer y escribir cualquier fila. Existe por una única
 * razón: crear y borrar usuarios en Supabase Auth es imposible sin ella.
 *
 * Tres barreras impiden que se escape al navegador:
 *
 *   1. `import 'server-only'` en la primera línea. Si algún día un componente
 *      de cliente importa este archivo, la compilación FALLA. No es una
 *      convención que haya que recordar: es un error de build.
 *
 *   2. La variable NO lleva el prefijo `NEXT_PUBLIC_`. Next.js solo incrusta en
 *      el JavaScript del navegador las que lo llevan; esta se queda en el
 *      servidor.
 *
 *   3. Se lee aquí dentro y nunca se exporta el valor, solo el cliente ya
 *      construido.
 *
 * Y una regla de uso: quien la invoque tiene que haber comprobado ANTES que el
 * usuario es administrador. Este cliente no verifica nada por su cuenta.
 */
export function getSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. Es necesaria para crear ' +
        'usuarios desde la aplicación. La encuentras en Supabase → Project ' +
        'Settings → API Keys → service_role (o "secret key").',
    );
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      // Este cliente no representa a nadie: no debe guardar ni refrescar sesión,
      // o acabaría pisando la sesión real del usuario.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
