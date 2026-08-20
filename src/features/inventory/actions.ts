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

const guardarCategoria = z.object({
  // Sin id se crea; con id se renombra la que ya existe. Es la misma función de
  // base para los dos casos.
  id: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1, 'La categoría necesita un nombre.').max(60),
});

const fotoProducto = z.object({
  // Ruta dentro del bucket, no URL: la URL pública se puede reconstruir siempre
  // a partir de la ruta, y guardarla ataría la base al dominio de Supabase.
  path: z.string().trim().min(1).max(400),
  // Null = la foto vale para todos los colores.
  color: z.string().trim().max(40).nullable().default(null),
});

const guardarFotosProducto = z.object({
  product_id: z.string().uuid(),
  images: z.array(fotoProducto).min(1, 'La prenda necesita al menos una foto.'),
});

const crearProducto = z.object({
  name: z.string().trim().min(1, 'El producto necesita un nombre.').max(160),
  description: z.string().trim().max(2000).optional(),
  brand: z.string().trim().max(80).optional(),
  category_id: z.string().uuid().nullable().default(null),
  variants: z.array(variante).min(1, 'Agrega al menos una talla o color.'),
  // La prenda alimenta la página pública, y una tarjeta sin foto no se vende.
  images: z.array(fotoProducto).min(1, 'La prenda necesita al menos una foto.'),
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

/**
 * Crea o renombra una categoría.
 *
 * La función de base existía desde el principio pero no la llamaba nadie, así
 * que `categories` se quedaba vacía y el desplegable de la ficha de prenda no
 * tenía nada que ofrecer.
 */
export async function guardarCategoriaAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = guardarCategoria.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc('upsert_category', {
    p_name: v.name,
    p_id: v.id,
  });

  if (error) {
    // El nombre es único en la base. Su mensaje crudo delata el nombre de la
    // restricción, y al mostrador eso no le dice nada.
    if (error.code === '23505') return fail('Ya existe una categoría con ese nombre.');
    return fail(toUserMessage(error));
  }

  // La ficha de prenda lee la lista en el servidor, y Ajustes la muestra entera.
  revalidatePath('/inventario/nuevo');
  revalidatePath('/ajustes');
  return ok(data as string);
}

/**
 * Borra una categoría, si la base deja.
 *
 * No lleva confirmación aquí: quien decide si se puede borrar es la función de
 * base, que se niega cuando la categoría tiene prendas dentro y dice cuántas.
 * Un DELETE directo sí colaría, porque la clave foránea es `on delete set null`
 * y dejaría todas esas prendas sin categoría en silencio.
 */
export async function borrarCategoriaAction(id: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return fail('Categoría no válida.');

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('delete_category', { p_id: parsed.data });
  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario/nuevo');
  revalidatePath('/ajustes');
  return ok();
}

/**
 * Reemplaza el juego completo de fotos de una prenda ya cargada.
 *
 * Se manda la lista entera y no "añade esta, borra aquella": el orden del array
 * es el orden de la landing, y mandarlo completo evita que dos ediciones
 * simultáneas dejen las posiciones descolocadas.
 */
export async function guardarFotosProductoAction(input: unknown): Promise<ActionResult> {
  const parsed = guardarFotosProducto.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Revisa los datos.');

  const v = parsed.data;
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('set_product_images', {
    p_product_id: v.product_id,
    p_images: v.images.map((f) => (f.color ? { path: f.path, color: f.color } : { path: f.path })),
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario');
  return ok();
}

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
    // El orden del array manda: la primera es la principal de la landing.
    p_images: v.images.map((f) => (f.color ? { path: f.path, color: f.color } : { path: f.path })),
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

/**
 * Retira o devuelve al mostrador una talla/color concreto.
 *
 * Retirar no borra nada: la variante desaparece del inventario y del punto de
 * venta, pero su historial de ventas y su libro de movimientos siguen enteros.
 * Borrarla de verdad sería imposible de todos modos, porque `order_items` y
 * `stock_movements` la referencian con `on delete restrict`, y ese libro es la
 * auditoría que permite explicar por qué hay 3 y no 5.
 */
export async function cambiarActivoVarianteAction(
  variantId: string,
  activo: boolean,
): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient();

  // Los demás parámetros van vacíos a propósito: la función de base los recoge
  // con coalesce, así que talla, color y precio se quedan como estaban.
  const { error } = await supabase.rpc('update_variant', {
    p_id: variantId,
    p_is_active: activo,
  });

  if (error) return fail(toUserMessage(error));

  revalidatePath('/inventario');
  return ok();
}

/** Lo mismo, pero para la prenda entera y todas sus tallas de una vez. */
export async function cambiarActivoProductoAction(
  productId: string,
  activo: boolean,
): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.rpc('update_product', {
    p_id: productId,
    p_is_active: activo,
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
