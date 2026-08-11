'use server';

// Ojo: un archivo con 'use server' SOLO puede exportar funciones async. Los
// esquemas de Zod de abajo se quedan sin 'export' a propósito: exportarlos
// rompe la página entera en tiempo de ejecución, no en compilación.

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, toUserMessage, type ActionResult } from '@/lib/actions';
import {
  cancelarVenta,
  crearVenta,
  registrarAbono,
  registrarDevolucion,
} from './schemas';

/**
 * Todas estas acciones son envoltorios finos sobre funciones de Postgres.
 *
 * Fíjate en lo que NO hacen: no leen stock, no calculan totales, no deciden si
 * una orden queda pagada. Toda esa lógica vive dentro de la transacción de la
 * base de datos, que es el único lugar donde puede ser correcta si dos personas
 * venden a la vez. Aquí solo se valida la forma de los datos y se traduce el
 * error para el mostrador.
 */

function refrescarTodo() {
  revalidatePath('/', 'layout');
}

export async function crearVentaAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = crearVenta.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('create_order', {
    p_type: v.type,
    p_items: v.items,
    p_customer_id: v.customer_id,
    p_price_kind: v.price_kind,
    p_payments: v.payments,
    p_discount_cents: 0,
    p_notes: v.notes ?? null,
  });

  if (error) return fail(toUserMessage(error));

  refrescarTodo();
  return ok(data as string);
}

export async function registrarAbonoAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = registrarAbono.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('add_payment', {
    p_order_id: v.order_id,
    p_amount_cents: v.amount_cents,
    p_method: v.method,
    p_reference: v.reference ?? null,
    p_notes: v.notes ?? null,
  });

  if (error) return fail(toUserMessage(error));

  refrescarTodo();
  return ok(data as string);
}

/**
 * Cancelar es SIEMPRE una decisión manual. El sistema marca en rojo un apartado
 * vencido y ahí se detiene: nunca libera la prenda por su cuenta.
 */
export async function cancelarVentaAction(input: unknown): Promise<ActionResult> {
  const parsed = cancelarVenta.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: v.order_id,
    p_restock: v.restock,
    p_refund_cents: v.refund_cents,
    p_refund_method: v.refund_method,
    p_reason: v.reason,
  });

  if (error) return fail(toUserMessage(error));

  refrescarTodo();
  return ok();
}

export async function registrarDevolucionAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = registrarDevolucion.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('register_return', {
    p_order_id: v.order_id,
    p_items: v.items,
    p_restock: v.restock,
    p_refund_cents: v.refund_cents,
    p_refund_method: v.refund_method,
    p_notes: v.notes ?? null,
  });

  if (error) return fail(toUserMessage(error));

  refrescarTodo();
  return ok(data as string);
}
