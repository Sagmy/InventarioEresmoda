'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, toUserMessage, type ActionResult } from '@/lib/actions';

export const guardarCliente = z.object({
  id: z.string().uuid().nullable().default(null),
  full_name: z.string().trim().min(2, 'El cliente necesita un nombre.').max(120),
  phone: z.string().trim().max(30).optional(),
  document_id: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
});

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
