import type { PostgrestError } from '@supabase/supabase-js';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Códigos de error que las funciones de la base de datos usan a propósito para
 * hablarle al usuario. Sus mensajes están escritos para el mostrador ("Stock
 * insuficiente de Camisa Lino · Blanco · M: hay 2 y se intentan sacar 3") y se
 * pueden mostrar tal cual.
 */
const MENSAJES_PARA_EL_USUARIO = new Set([
  '22023', // parámetro inválido: reglas de negocio
  '23514', // violación de restricción: stock imposible
  '23503', // referencia inexistente: prenda o cliente que no existe
  '23505', // duplicado: SKU o categoría repetida
  '42501', // permiso insuficiente
  '28000', // sin sesión
  'P0001', // raise exception sin errcode explícito
]);

/**
 * Convierte un error de Postgres en algo que se le pueda enseñar al usuario.
 *
 * Los errores que nosotros levantamos se muestran íntegros. Cualquier otro
 * (un fallo de conexión, un bug) se registra completo en el servidor pero al
 * navegador solo llega un mensaje genérico: los errores inesperados de una base
 * de datos suelen delatar nombres de tablas, columnas y restricciones.
 */
export function toUserMessage(error: PostgrestError | Error | null): string {
  if (!error) return 'Ocurrió un error inesperado.';

  if ('code' in error && typeof error.code === 'string') {
    if (MENSAJES_PARA_EL_USUARIO.has(error.code)) {
      return error.message;
    }
  }

  console.error('[error no controlado]', error);
  return 'No se pudo completar la operación. Intenta de nuevo.';
}

/** Envuelve una Server Action para que nunca lance y siempre devuelva un resultado. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
    return fail(toUserMessage(error as Error));
  }
}
