'use server';

// Ojo: un archivo con 'use server' SOLO puede exportar funciones async. Los
// esquemas de Zod de abajo se quedan sin 'export' a propósito: exportarlos
// rompe la página entera en tiempo de ejecución, no en compilación.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fail, ok, toUserMessage, type ActionResult } from '@/lib/actions';

const variante = z.object({
  size: z.string().trim().max(30).optional(),
  color: z.string().trim().max(40).optional(),
  sku: z.string().trim().max(40).optional(),
  price_cents: z.number().int().nonnegative('El precio no puede ser negativo.'),
  cost_cents: z.number().int().nonnegative().default(0),
  qty: z.number().int().nonnegative().default(0),
});

const crearProducto = z.object({
  name: z.string().trim().min(1, 'El producto necesita un nombre.').max(160),
  description: z.string().trim().max(2000).optional(),
  brand: z.string().trim().max(80).optional(),
  category_id: z.string().uuid().nullable().default(null),
  variants: z.array(variante).min(1, 'Agrega al menos una talla o color.'),
});

const entradaMercancia = z.object({
  variant_id: z.string().uuid(),
  qty: z.number().int().positive('La cantidad debe ser mayor que cero.'),
  unit_cost_cents: z.number().int().nonnegative().nullable().default(null),
  note: z.string().trim().max(500).optional(),
});

const ajusteInventario = z.object({
  variant_id: z.string().uuid(),
  delta: z.number().int().refine((n) => n !== 0, 'El ajuste debe ser distinto de cero.'),
  note: z.string().trim().min(3, 'Todo ajuste necesita una nota que lo explique.').max(500),
});

const editarVariante = z.object({
  id: z.string().uuid(),
  size: z.string().trim().max(30).optional(),
  color: z.string().trim().max(40).optional(),
  price_cents: z.number().int().nonnegative().nullable().default(null),
  cost_cents: z.number().int().nonnegative().nullable().default(null),
  is_active: z.boolean().nullable().default(null),
});

export async function crearProductoAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = crearProducto.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('create_product', {
    p_name: v.name,
    p_variants: v.variants,
    p_description: v.description ?? null,
    p_brand: v.brand ?? null,
    p_category_id: v.category_id,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario');
  return ok(data as string);
}

/**
 * Entrada de mercancía. Recalcula el costo promedio ponderado en la base: si
 * tenías 2 camisas a $10 y entran 3 a $15, el costo pasa a $13 y no a $15.
 * Usar el último costo distorsionaría el margen del inventario viejo.
 */
export async function entradaMercanciaAction(input: unknown): Promise<ActionResult> {
  const parsed = entradaMercancia.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('receive_stock', {
    p_variant_id: v.variant_id,
    p_qty: v.qty,
    p_unit_cost_cents: v.unit_cost_cents,
    p_note: v.note ?? null,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario');
  return ok();
}

export async function ajustarInventarioAction(input: unknown): Promise<ActionResult> {
  const parsed = ajusteInventario.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('adjust_stock', {
    p_variant_id: v.variant_id,
    p_delta: v.delta,
    p_note: v.note,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario');
  return ok();
}

export async function editarVarianteAction(input: unknown): Promise<ActionResult> {
  const parsed = editarVariante.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('update_variant', {
    p_id: v.id,
    p_size: v.size ?? null,
    p_color: v.color ?? null,
    p_price_cents: v.price_cents,
    p_cost_cents: v.cost_cents,
    p_is_active: v.is_active,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario');
  return ok();
}
