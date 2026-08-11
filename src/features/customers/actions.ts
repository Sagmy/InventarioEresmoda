'use server';

// Ojo: un archivo con 'use server' SOLO puede exportar funciones async. Los
// esquemas de Zod de abajo se quedan sin 'export' a propósito: exportarlos
// rompe la página entera en tiempo de ejecución, no en compilación.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, toUserMessage, type ActionResult } from '@/lib/actions';

const guardarCliente = z.object({
  id: z.string().uuid().nullable().default(null),
  full_name: z.string().trim().min(2, 'El cliente necesita un nombre.').max(120),
  phone: z.string().trim().max(30).optional(),
  document_id: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Desactivar esconde al cliente sin tocar su historial. La base rechaza la
 * operación si todavía tiene apartados o créditos abiertos: desaparecería del
 * panel de cobros con la deuda viva.
 */
export async function desactivarClienteAction(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return fail('Cliente no válido.');

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('set_customer_active', {
    p_id: parsed.data,
    p_active: activo,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/clientes');
  return ok();
}

/**
 * Borrado definitivo. Solo funciona con clientes que nunca tuvieron una
 * transacción: sirve para limpiar duplicados y errores de tecleo, no para
 * deshacerse de un historial de ventas.
 */
export async function eliminarClienteAction(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return fail('Cliente no válido.');

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('delete_customer', { p_id: parsed.data });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/clientes');
  return ok();
}

export async function guardarClienteAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = guardarCliente.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('upsert_customer', {
    p_full_name: v.full_name,
    p_id: v.id,
    p_phone: v.phone ?? null,
    p_document_id: v.document_id ?? null,
    p_notes: v.notes ?? null,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/clientes');
  return ok(data as string);
}
