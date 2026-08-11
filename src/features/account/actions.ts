'use server';

import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions';

const cambioPassword = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual.'),
    nueva: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres.'),
    repetir: z.string(),
  })
  .refine((v) => v.nueva === v.repetir, {
    message: 'Las dos contraseñas nuevas no coinciden.',
    path: ['repetir'],
  })
  .refine((v) => v.nueva !== v.actual, {
    message: 'La contraseña nueva tiene que ser distinta de la actual.',
    path: ['nueva'],
  });

/**
 * Cambia la contraseña de quien está en sesión.
 *
 * Es la contraparte necesaria de las contraseñas temporales: el administrador
 * asigna una al crear la cuenta, y la persona la reemplaza por una suya en
 * cuanto entra. Sin esta pantalla, la contraseña de cada vendedor la conocería
 * el admin para siempre.
 *
 * Se exige la contraseña actual y se comprueba volviendo a iniciar sesión con
 * ella. Supabase no lo pide por defecto, y sin esa comprobación bastaría con
 * encontrar una sesión abierta —el celular del mostrador, por ejemplo— para
 * quedarse con la cuenta.
 */
export async function cambiarPasswordAction(
  _prev: ActionResult<{ notice: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ notice: string }>> {
  const parsed = cambioPassword.safeParse({
    actual: formData.get('actual'),
    nueva: formData.get('nueva'),
    repetir: formData.get('repetir'),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return fail('Tu sesión expiró. Vuelve a entrar e inténtalo de nuevo.');
  }

  const { error: errorReauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.actual,
  });

  if (errorReauth) {
    return fail('La contraseña actual no es correcta.');
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.nueva });

  if (error) {
    return fail(
      error.message.toLowerCase().includes('weak')
        ? 'Esa contraseña es demasiado débil. Prueba con una más larga.'
        : 'No se pudo cambiar la contraseña. Intenta de nuevo.',
    );
  }

  return ok({ notice: 'Contraseña actualizada. Úsala la próxima vez que entres.' });
}
