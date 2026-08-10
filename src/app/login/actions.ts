'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions';

/** Resultado de las acciones de acceso: error, o un aviso informativo. */
export type AuthResult = ActionResult<{ notice: string } | null>;

const credenciales = z.object({
  email: z.string().trim().toLowerCase().email('Escribe un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

const registro = credenciales.extend({
  fullName: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
});

/**
 * El destino de vuelta se valida antes de usarlo: aceptar cualquier URL en un
 * parámetro sería una redirección abierta, útil para llevar a alguien a un sitio
 * falso desde un enlace que parece de la aplicación.
 */
function destinoSeguro(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export async function signIn(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = credenciales.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Para credenciales equivocadas el mensaje es deliberadamente vago:
    // distinguir "ese correo no existe" de "la contraseña es incorrecta" le
    // confirma a un atacante qué correos están registrados.
    //
    // Pero hay estados que NO son un fallo de credenciales, y esconderlos deja
    // al usuario encerrado sin saber qué hacer. Esos sí se explican.
    if (error.code === 'email_not_confirmed') {
      return fail(
        'Tu cuenta existe, pero falta confirmar el correo. Busca el mensaje de ' +
          'Supabase en tu bandeja (revisa también la carpeta de spam) y abre el enlace.',
      );
    }

    if (error.code === 'over_request_rate_limit' || error.status === 429) {
      return fail('Demasiados intentos seguidos. Espera un minuto y vuelve a probar.');
    }

    return fail('Correo o contraseña incorrectos.');
  }

  revalidatePath('/', 'layout');
  redirect(destinoSeguro(formData.get('next') as string | null));
}

export async function signUp(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = registro.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) {
    return fail(
      error.message.includes('already registered')
        ? 'Ya existe una cuenta con ese correo.'
        : 'No se pudo crear la cuenta. Intenta de nuevo.',
    );
  }

  // Si el proyecto exige confirmar el correo, Supabase crea el usuario pero no
  // devuelve sesión. Redirigir aquí mandaría al usuario al inicio, el middleware
  // lo devolvería al login, y se quedaría dando vueltas sin entender por qué.
  if (!data.session) {
    return ok({
      notice:
        'Cuenta creada. Te enviamos un correo de confirmación: ábrelo y luego ' +
        'vuelve aquí a iniciar sesión. Si no llega, revisa la carpeta de spam.',
    });
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut(): Promise<never> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}
