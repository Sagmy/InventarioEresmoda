'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para el navegador.
 *
 * Solo se usa para LEER (listados, suscripciones en tiempo real). Toda escritura
 * pasa por una Server Action, porque el navegador no tiene permisos de escritura
 * sobre ninguna tabla.
 *
 * Se cachea la instancia: cada `createBrowserClient` abre su propio canal de
 * realtime, y varios clientes sueltos significan varias conexiones y eventos
 * duplicados.
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  cached ??= createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return cached;
}
