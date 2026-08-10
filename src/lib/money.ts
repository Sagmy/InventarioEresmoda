/**
 * Todo el dinero de la aplicación se maneja en CENTAVOS enteros.
 *
 * Nunca en decimales flotantes: 0.1 + 0.2 no da 0.3 en JavaScript, y ese error
 * de centésimas se acumula. Con cien ventas al día, la caja deja de cuadrar en
 * cuestión de semanas y nadie encuentra de dónde salió la diferencia.
 *
 * La conversión a decimal ocurre en un único punto: al mostrar y al leer lo que
 * el usuario escribe.
 */

const formatter = new Intl.NumberFormat('es-VE', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 12345 → "$123,45" */
export function formatMoney(cents: number): string {
  return formatter.format((cents ?? 0) / 100);
}

/** 12345 → "123.45". Para rellenar un campo de formulario. */
export function centsToInput(cents: number): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

/**
 * Convierte lo que el usuario escribió a centavos.
 *
 * Acepta las dos convenciones que se usan a diario ("12,50" y "12.50") y
 * devuelve null si el texto no es un monto válido, para que quien llama decida
 * qué mensaje mostrar.
 */
export function parseMoneyToCents(input: string): number | null {
  const limpio = input.trim().replace(/[$\s]/g, '');
  if (limpio === '') return null;

  // Si hay coma y punto, el último separador es el decimal.
  let normalizado = limpio;
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');

  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    normalizado =
      ultimaComa > ultimoPunto
        ? limpio.replace(/\./g, '').replace(',', '.')
        : limpio.replace(/,/g, '');
  } else if (ultimaComa !== -1) {
    normalizado = limpio.replace(',', '.');
  }

  if (!/^\d*\.?\d*$/.test(normalizado)) return null;

  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;

  // Redondear ANTES de truncar: 19.99 * 100 da 1998.9999... en coma flotante.
  return Math.round(valor * 100);
}

/** Porcentaje pagado, acotado a 100 para que la barra no se desborde. */
export function paidPercent(paidCents: number, totalCents: number): number {
  if (totalCents <= 0) return 100;
  return Math.min(100, Math.round((paidCents / totalCents) * 100));
}
