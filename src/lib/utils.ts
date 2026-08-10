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

/** "hace 3 días", "hoy", "ayer" — para el panel de cobros. */
export function relativeDays(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}
