'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, toUserMessage, type ActionResult } from '@/lib/actions';

export const guardarAjustes = z.object({
  store_name: z.string().trim().min(1).max(80).optional(),
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
    p_store_name: v.store_name ?? null,
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
