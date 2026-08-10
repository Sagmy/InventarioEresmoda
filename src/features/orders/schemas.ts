import { z } from 'zod';

/**
 * Esquemas compartidos entre el formulario y la Server Action.
 *
 * La validación del navegador es cortesía para el usuario; la del servidor es la
 * que cuenta. Y por debajo de ambas está Postgres, que vuelve a comprobar cada
 * regla dentro de la transacción. Que un mismo esquema se use en los dos lados
 * evita que se desincronicen.
 */

/** 'credito_cambio' es un asiento interno del sistema: nadie lo elige a mano. */
export const metodoPago = z.enum([
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto_venta',
  'otro',
]);

export const ETIQUETA_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  transferencia: 'Transferencia',
  punto_venta: 'Punto de venta',
  otro: 'Otro',
  credito_cambio: 'Crédito por cambio',
};

export const lineaVenta = z.object({
  variant_id: z.string().uuid(),
  qty: z.number().int().positive('La cantidad debe ser mayor que cero.'),
  /** Solo en promociones. Si se omite, manda el precio de lista. */
  unit_price_cents: z.number().int().nonnegative().optional(),
});

export const pago = z.object({
  amount_cents: z.number().int().positive('Cada pago debe ser mayor que cero.'),
  method: metodoPago,
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const crearVenta = z
  .object({
    type: z.enum(['contado', 'apartado', 'credito']),
    price_kind: z.enum(['normal', 'promo']).default('normal'),
    customer_id: z.string().uuid().nullable().default(null),
    items: z.array(lineaVenta).min(1, 'Agrega al menos una prenda.'),
    payments: z.array(pago).default([]),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.type === 'contado' || v.customer_id !== null, {
    message: 'Los apartados y créditos necesitan un cliente.',
    path: ['customer_id'],
  })
  .refine((v) => v.price_kind !== 'promo' || v.type === 'contado', {
    message: 'Las promociones solo aplican a ventas de contado.',
    path: ['price_kind'],
  })
  .refine(
    (v) => {
      // Una prenda repetida en dos líneas rompería el cálculo de disponibilidad.
      const ids = v.items.map((i) => i.variant_id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Hay una prenda repetida. Únela en una sola línea.', path: ['items'] },
  );

export const registrarAbono = z.object({
  order_id: z.string().uuid(),
  amount_cents: z.number().int().positive('El abono debe ser mayor que cero.'),
  method: metodoPago,
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const cancelarVenta = z.object({
  order_id: z.string().uuid(),
  restock: z.boolean().default(true),
  refund_cents: z.number().int().nonnegative().default(0),
  refund_method: metodoPago.nullable().default(null),
  reason: z.string().trim().min(3, 'Explica por qué se cancela.').max(500),
});

export const registrarDevolucion = z.object({
  order_id: z.string().uuid(),
  items: z
    .array(z.object({ order_item_id: z.string().uuid(), qty: z.number().int().positive() }))
    .min(1, 'Indica qué prendas se devuelven.'),
  restock: z.boolean().default(true),
  refund_cents: z.number().int().nonnegative().default(0),
  refund_method: metodoPago.nullable().default(null),
  notes: z.string().trim().max(2000).optional(),
});

export type CrearVenta = z.infer<typeof crearVenta>;
export type RegistrarAbono = z.infer<typeof registrarAbono>;
export type CancelarVenta = z.infer<typeof cancelarVenta>;
export type RegistrarDevolucion = z.infer<typeof registrarDevolucion>;
export type MetodoPago = z.infer<typeof metodoPago>;
