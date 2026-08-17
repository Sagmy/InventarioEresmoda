import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases de Tailwind resolviendo conflictos (la última gana). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFormatter = new Intl.DateTimeFormat('es-VE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-VE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date | null): string {
  if (!value) return '—';
  return dateTimeFormatter.format(new Date(value));
}

/**
 * Fecha en formato YYYY-MM-DD, calculada en la zona horaria de la tienda.
 *
 * `toISOString()` no sirve para esto: devuelve la fecha en UTC. En Caracas
 * (UTC−4), a las 9 de la noche del día 10 ya es día 11 en UTC, así que los
 * rangos de los reportes se corrían un día y las ventas de la noche caían en la
 * casilla equivocada. El corte del día tiene que ser el de la tienda, el mismo
 * que usa la base de datos.
 */
export function fechaLocalISO(fecha: Date, zonaHoraria: string): string {
  // 'en-CA' produce exactamente YYYY-MM-DD, que es el formato que espera Postgres.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/** "hace 3 días", "hoy", "ayer" — para el panel de cobros. */
export function relativeDays(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}
