import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para el servidor (Server Components y Server Actions).
 *
 * Usa la MISMA clave anónima que el navegador, a propósito: la sesión del
 * usuario viaja en la cookie y Row Level Security decide qué puede ver y hacer.
 * En ningún punto de la aplicación se usa la `service_role`, que se saltaría
 * toda esa protección.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. No es un problema:
            // el middleware ya refrescó la sesión antes de llegar aquí.
          }
        },
      },
    },
  );
}
