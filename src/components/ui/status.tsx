import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import type { AlertLevel, PaymentStatus } from '@/types/database';

/* -------------------------------------------------------------------------- */
/* Estado de pago                                                              */
/* -------------------------------------------------------------------------- */

const ESTILO_ESTADO: Record<PaymentStatus, { texto: string; clase: string }> = {
  pendiente: { texto: 'PENDIENTE', clase: 'bg-borde text-tinta-suave' },
  parcial: { texto: 'PARCIAL', clase: 'bg-ambar-suave text-ambar' },
  pagado: { texto: 'PAGADO', clase: 'bg-verde-suave text-verde' },
  cancelado: { texto: 'CANCELADO', clase: 'bg-rojo-suave text-rojo' },
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const estilo = ESTILO_ESTADO[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide',
        estilo.clase,
      )}
    >
      {estilo.texto}
    </span>
  );
}

/**
 * Barra de progreso del pago.
 *
 *   [PARCIAL]  ████████░░░░░░░░  $50 de $100 · faltan $50
 *
 * El "faltan" es la cifra que de verdad importa cuando alguien llama a
 * preguntar cuánto debe, así que se muestra siempre y no se calcula de cabeza.
 */
export function PaymentProgress({
  paidCents,
  totalCents,
  showLabel = true,
}: {
  paidCents: number;
  totalCents: number;
  showLabel?: boolean;
}) {
  const pendiente = Math.max(0, totalCents - paidCents);
  const pct = totalCents > 0 ? Math.min(100, Math.round((paidCents / totalCents) * 100)) : 100;
  const completo = pendiente === 0;

  return (
    <div className="w-full">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-borde"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Pagado ${pct}%`}
      >
        <div
          className={cn('h-full rounded-full transition-all', completo ? 'bg-verde' : 'bg-ambar')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {showLabel ? (
        <p className="tabular mt-1 text-xs text-tinta-suave">
          {formatMoney(paidCents)} de {formatMoney(totalCents)}
          {completo ? null : (
            <>
              {' · '}
              <span className="font-medium text-ambar">faltan {formatMoney(pendiente)}</span>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Semáforo de cobros                                                          */
/* -------------------------------------------------------------------------- */

const ESTILO_ALERTA: Record<AlertLevel, { punto: string; texto: string; fondo: string }> = {
  verde: { punto: 'bg-verde', texto: 'text-verde', fondo: 'bg-verde-suave' },
  amarillo: { punto: 'bg-ambar', texto: 'text-ambar', fondo: 'bg-ambar-suave' },
  rojo: { punto: 'bg-rojo', texto: 'text-rojo', fondo: 'bg-rojo-suave' },
};

export function AlertDot({ level }: { level: AlertLevel }) {
  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', ESTILO_ALERTA[level].punto)}
      aria-hidden
    />
  );
}

export function AlertChip({ level, children }: { level: AlertLevel; children: React.ReactNode }) {
  const estilo = ESTILO_ALERTA[level];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        estilo.fondo,
        estilo.texto,
      )}
    >
      <AlertDot level={level} />
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Los tres números de stock                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Disponible · Apartado · Físico
 *
 * Es la respuesta al problema de fondo del negocio: con 5 camisas y 2 apartadas,
 * el stock vendible es 3, no 5. Se muestran los tres números siempre, porque
 * enseñar solo el total es justo lo que hacía imposible saber qué se podía vender.
 */
export function StockNumbers({
  available,
  reserved,
  onHand,
  size = 'md',
}: {
  available: number;
  reserved: number;
  onHand: number;
  size?: 'sm' | 'md';
}) {
  const compacto = size === 'sm';

  return (
    <div className={cn('flex items-center', compacto ? 'gap-3' : 'gap-4')}>
      <Numero
        etiqueta="Disponible"
        valor={available}
        compacto={compacto}
        className={available <= 0 ? 'text-rojo' : 'text-tinta'}
        destacado
      />

      {reserved > 0 ? (
        <Numero etiqueta="Apartado" valor={reserved} compacto={compacto} className="text-ambar" />
      ) : null}

      <Numero
        etiqueta="Físico"
        valor={onHand}
        compacto={compacto}
        className="text-tinta-tenue"
      />
    </div>
  );
}

function Numero({
  etiqueta,
  valor,
  className,
  compacto,
  destacado = false,
}: {
  etiqueta: string;
  valor: number;
  className?: string;
  compacto: boolean;
  destacado?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          'tabular leading-none',
          compacto ? 'text-base' : 'text-lg',
          destacado ? 'font-bold' : 'font-semibold',
          className,
        )}
      >
        {valor}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-tinta-tenue">{etiqueta}</div>
    </div>
  );
}
