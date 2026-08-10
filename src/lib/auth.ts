import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

/**
 * Sesión y rol del usuario actual.
 *
 * Envuelto en `cache` de React: durante un mismo render, varios componentes
 * pueden preguntar quién es el usuario y solo se consulta una vez.
 *
 * Importante: esto es comodidad para la interfaz, NO el mecanismo de seguridad.
 * Aunque alguien saltara estas comprobaciones, la base de datos volvería a
 * verificar sesión y rol dentro de cada función. Son dos candados independientes.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return data ?? null;
});

/** Exige sesión activa. Redirige al login si no la hay. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile || !profile.is_active) {
    redirect('/login');
  }

  return profile;
}

/** Exige rol de administrador. Un vendedor termina en el tablero. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();

  if (profile.role !== 'admin') {
    redirect('/');
  }

  return profile;
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin' && profile.is_active;
}
