import { z } from 'zod';

/**
 * Validación de las variables de entorno.
 *
 * Se comprueban al arrancar, no la primera vez que alguien intenta vender. Un
 * fallo aquí es un mensaje claro en el arranque; sin esto sería un
 * "Failed to fetch" críptico en el mostrador un sábado por la tarde.
 */
const schema = z.object({
  url: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida (ej. https://xxxx.supabase.co)'),
  key: z
    .string()
    .min(
      20,
      'Falta la clave pública de Supabase. Define NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
        '(o NEXT_PUBLIC_SUPABASE_ANON_KEY, el nombre antiguo).',
    ),
});

// Next.js sustituye estas referencias en tiempo de compilación, así que hay que
// nombrarlas literalmente: `process.env[variable]` no funcionaría.
//
// Se aceptan los dos nombres a propósito. Supabase renombró la clave anónima a
// "publishable key", y el panel Connect entrega el nombre nuevo; los proyectos
// más viejos y buena parte de la documentación siguen usando el anterior. Es la
// misma clave, así que no tiene sentido que la aplicación se rompa por cuál de
// los dos nombres se copió.
const parsed = schema.safeParse({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  · ${i.message}`).join('\n');
  throw new Error(
    `Faltan variables de entorno o son inválidas:\n${detalle}\n\n` +
      'Copia .env.example como .env.local y rellena los valores de tu proyecto de Supabase.',
  );
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: parsed.data.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.data.key,
};
