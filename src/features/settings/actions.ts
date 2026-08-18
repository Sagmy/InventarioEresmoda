'use server';

// Ojo: un archivo con 'use server' SOLO puede exportar funciones async. Los
// esquemas de Zod de abajo se quedan sin 'export' a propósito: exportarlos
// rompe la página entera en tiempo de ejecución, no en compilación.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { fail, ok, toUserMessage, type ActionResult } from '@/lib/actions';

const nuevoUsuario = z.object({
  full_name: z.string().trim().min(2, 'Escribe el nombre de la persona.').max(120),
  email: z.string().trim().toLowerCase().email('El correo no es válido.'),
  password: z.string().min(8, 'La contraseña temporal debe tener al menos 8 caracteres.'),
  role: z.enum(['admin', 'seller']),
});

/**
 * Crea una cuenta para alguien del equipo.
 *
 * El registro público está cerrado, así que este es el único camino: nadie entra
 * a la tienda si el administrador no lo dio de alta.
 *
 * Sobre la llave de administración: se comprueba PRIMERO que quien llama es
 * admin, usando su sesión normal y las reglas de la propia base de datos. Solo
 * después se toca el cliente privilegiado, y únicamente para dar de alta el
 * usuario en Supabase Auth. El rol y la activación se aplican con la sesión
 * corriente, a través de las funciones que ya validan permisos.
 */
export async function crearUsuarioAction(input: unknown): Promise<ActionResult> {
  const parsed = nuevoUsuario.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  // Puerta de entrada: si quien pide esto no es admin, la base lo rechaza y no
  // se llega a instanciar el cliente privilegiado.
  const { data: esAdmin, error: errorRol } = await supabase.rpc('is_admin');

  if (errorRol || esAdmin !== true) {
    return fail('Esta operación requiere rol de administrador.');
  }

  let admin: ReturnType<typeof getSupabaseAdminClient>;

  try {
    admin = getSupabaseAdminClient();
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Falta configurar la llave de servicio.');
  }

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    // Sin esto la persona no podría entrar hasta confirmar el correo, y aquí la
    // cuenta la está creando alguien de confianza en persona.
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  });

  if (error) {
    return fail(
      error.message.toLowerCase().includes('already')
        ? 'Ya existe una cuenta con ese correo.'
        : 'No se pudo crear la cuenta. Revisa el correo y vuelve a intentar.',
    );
  }

  const nuevoId = creado.user?.id;

  if (!nuevoId) return fail('La cuenta se creó pero no se pudo configurar. Revísala en Ajustes.');

  // El trigger de la base ya creó el perfil como vendedor inactivo. Aquí se le
  // aplica el rol elegido y se activa, con la sesión del admin.
  const { error: errorRolNuevo } = await supabase.rpc('set_user_role', {
    p_user_id: nuevoId,
    p_role: v.role,
  });

  if (errorRolNuevo) return fail(toUserMessage(errorRolNuevo));

  const { error: errorActivo } = await supabase.rpc('set_user_active', {
    p_user_id: nuevoId,
    p_active: true,
  });

  if (errorActivo) return fail(toUserMessage(errorActivo));

  revalidatePath('/ajustes');
  return ok();
}

const guardarAjustes = z.object({
  // La zona la elige un desplegable cerrado (ver features/settings/zonas.ts),
  // pero quien manda es el trigger de la base, que la contrasta con
  // pg_timezone_names. Aquí solo se comprueba la forma.
  timezone: z.string().trim().min(3).max(60).optional(),
  layaway_min_deposit_pct: z.number().min(0).max(100).nullable().default(null),
  layaway_term_days: z.number().int().positive().max(365).nullable().default(null),
  layaway_reminder_days: z.number().int().positive().max(365).nullable().default(null),
  credit_min_deposit_pct: z.number().min(0).max(100).nullable().default(null),
  credit_reminder_days: z.number().int().positive().max(365).nullable().default(null),
  low_stock_threshold: z.number().int().min(0).max(999).nullable().default(null),
});

export async function guardarAjustesAction(input: unknown): Promise<ActionResult> {
  const parsed = guardarAjustes.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;

  // El aviso tiene que llegar ANTES del vencimiento; si no, no sirve de nada.
  if (
    v.layaway_reminder_days !== null &&
    v.layaway_term_days !== null &&
    v.layaway_reminder_days > v.layaway_term_days
  ) {
    return fail('El aviso del apartado no puede ser después de su vencimiento.');
  }

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('update_settings', {
    p_timezone: v.timezone ?? null,
    p_layaway_min_deposit_pct: v.layaway_min_deposit_pct,
    p_layaway_term_days: v.layaway_term_days,
    p_layaway_reminder_days: v.layaway_reminder_days,
    p_credit_min_deposit_pct: v.credit_min_deposit_pct,
    p_credit_reminder_days: v.credit_reminder_days,
    p_low_stock_threshold: v.low_stock_threshold,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/', 'layout');
  return ok();
}

export async function cambiarRolAction(
  userId: string,
  rol: 'admin' | 'seller',
): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: rol });
  if (error) return fail(toUserMessage(error));

  revalidatePath('/ajustes');
  return ok();
}

export async function cambiarActivoAction(
  userId: string,
  activo: boolean,
): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('set_user_active', {
    p_user_id: userId,
    p_active: activo,
  });
  if (error) return fail(toUserMessage(error));

  revalidatePath('/ajustes');
  return ok();
}
