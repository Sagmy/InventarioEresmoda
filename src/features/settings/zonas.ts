/**
 * Zonas horarias que se ofrecen en Ajustes.
 *
 * La zona decide a qué hora corta el día de la tienda: de ella dependen los
 * reportes de caja, el filtro "solo hoy" del historial y el vencimiento de los
 * apartados. Escribirla a mano era pedir una errata, y la base la valida contra
 * `pg_timezone_names` con un error seco, así que aquí solo se puede elegir.
 *
 * Todos los identificadores son IANA y existen en `pg_timezone_names`. Si algún
 * día hace falta una zona que no esté, se añade a esta lista.
 */
export const ZONAS_HORARIAS = [
  { valor: 'America/Caracas', etiqueta: 'Venezuela · Caracas' },
  { valor: 'America/Bogota', etiqueta: 'Colombia · Bogotá' },
  { valor: 'America/Lima', etiqueta: 'Perú · Lima' },
  { valor: 'America/Guayaquil', etiqueta: 'Ecuador · Guayaquil' },
  { valor: 'America/La_Paz', etiqueta: 'Bolivia · La Paz' },
  { valor: 'America/Santiago', etiqueta: 'Chile · Santiago' },
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: 'Argentina · Buenos Aires' },
  { valor: 'America/Montevideo', etiqueta: 'Uruguay · Montevideo' },
  { valor: 'America/Asuncion', etiqueta: 'Paraguay · Asunción' },
  { valor: 'America/Sao_Paulo', etiqueta: 'Brasil · São Paulo' },
  { valor: 'America/Panama', etiqueta: 'Panamá' },
  { valor: 'America/Costa_Rica', etiqueta: 'Costa Rica' },
  { valor: 'America/Managua', etiqueta: 'Nicaragua · Managua' },
  { valor: 'America/Tegucigalpa', etiqueta: 'Honduras · Tegucigalpa' },
  { valor: 'America/El_Salvador', etiqueta: 'El Salvador' },
  { valor: 'America/Guatemala', etiqueta: 'Guatemala' },
  { valor: 'America/Mexico_City', etiqueta: 'México · Ciudad de México' },
  { valor: 'America/Tijuana', etiqueta: 'México · Tijuana' },
  { valor: 'America/Santo_Domingo', etiqueta: 'República Dominicana' },
  { valor: 'America/Havana', etiqueta: 'Cuba · La Habana' },
  { valor: 'America/Puerto_Rico', etiqueta: 'Puerto Rico' },
  { valor: 'America/New_York', etiqueta: 'EE. UU. · Este (Nueva York)' },
  { valor: 'America/Chicago', etiqueta: 'EE. UU. · Centro (Chicago)' },
  { valor: 'America/Denver', etiqueta: 'EE. UU. · Montaña (Denver)' },
  { valor: 'America/Los_Angeles', etiqueta: 'EE. UU. · Pacífico (Los Ángeles)' },
  { valor: 'Europe/Madrid', etiqueta: 'España · Madrid' },
  { valor: 'UTC', etiqueta: 'UTC' },
] as const;

export const VALORES_ZONA_HORARIA: readonly string[] = ZONAS_HORARIAS.map((z) => z.valor);
