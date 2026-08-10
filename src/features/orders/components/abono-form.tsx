'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { formatMoney, parseMoneyToCents } from '@/lib/money';
import { registrarAbonoAction } from '@/features/orders/actions';
import { ETIQUETA_METODO, type MetodoPago } from '@/features/orders/schemas';

const METODOS: MetodoPago[] = [
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto_venta',
  'otro',
];

/**
 * Registrar un abono. Cuando el abono cierra el saldo, la base de datos
 * completa la orden sola; y si es un apartado, ese es el momento en que la
 * prenda por fin se descuenta del inventario.
 */
export function AbonoForm({
  orderId,
  balanceCents,
  onListo,
}: {
  orderId: string;
  balanceCents: number;
  onListo?: (() => void) | undefined;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const centavos = parseMoneyToCents(monto);
  const liquida = centavos !== null && centavos >= balanceCents;

  function enviar() {
    setError(null);

    if (centavos === null || centavos <= 0) {
      setError('Escribe un monto válido.');
      return;
    }

    if (centavos > balanceCents) {
      setError(`El abono supera el saldo pendiente (${formatMoney(balanceCents)}).`);
      return;
    }

    startTransition(async () => {
      const res = await registrarAbonoAction({
        order_id: orderId,
        amount_cents: centavos,
        method: metodo,
        reference: referencia.trim() || undefined,
      });

      if (res.ok) {
        setMonto('');
        setReferencia('');
        onListo?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="w-32 shrink-0">
          <Label htmlFor={`monto-${orderId}`}>Abono</Label>
          <Input
            id={`monto-${orderId}`}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>

        <div className="min-w-0 flex-1">
          <Label htmlFor={`metodo-${orderId}`}>Método</Label>
          <Select
            id={`metodo-${orderId}`}
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoPago)}
          >
            {METODOS.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_METODO[m]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={`ref-${orderId}`} hint="opcional">
          Referencia
        </Label>
        <Input
          id={`ref-${orderId}`}
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          maxLength={80}
          placeholder="Últimos dígitos, número de confirmación…"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setMonto((balanceCents / 100).toFixed(2))}
        >
          Todo ({formatMoney(balanceCents)})
        </Button>

        <Button type="button" className="flex-1" onClick={enviar} disabled={pendiente}>
          {pendiente ? 'Registrando…' : liquida ? 'Cobrar y liquidar' : 'Registrar abono'}
        </Button>
      </div>

      {liquida ? (
        <p className="text-xs text-verde">
          Con este abono queda saldada. La prenda se descontará del inventario.
        </p>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
