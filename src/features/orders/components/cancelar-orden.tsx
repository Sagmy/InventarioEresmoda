'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { formatMoney, parseMoneyToCents } from '@/lib/money';
import { cancelarVentaAction } from '@/features/orders/actions';
import { ETIQUETA_METODO, type MetodoPago } from '@/features/orders/schemas';
import type { OrderType } from '@/types/database';

const METODOS: MetodoPago[] = [
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto_venta',
  'otro',
];

/**
 * Cancelar y devolver la prenda al stock. SIEMPRE manual, nunca automático.
 *
 * En un apartado la prenda nunca salió: basta con soltar la reserva y vuelve a
 * estar disponible. En un crédito la prenda sí salió, así que solo reingresa si
 * el cliente la trajo de vuelta — de ahí la casilla.
 */
export function CancelarOrden({
  orderId,
  tipo,
  paidCents,
}: {
  orderId: string;
  tipo: OrderType;
  paidCents: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [reingresar, setReingresar] = useState(true);
  const [reembolso, setReembolso] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const centavos = reembolso.trim() === '' ? 0 : (parseMoneyToCents(reembolso) ?? -1);

  function enviar() {
    setError(null);

    if (centavos < 0) {
      setError('El monto del reembolso no es válido.');
      return;
    }

    if (motivo.trim().length < 3) {
      setError('Explica por qué se cancela.');
      return;
    }

    startTransition(async () => {
      const res = await cancelarVentaAction({
        order_id: orderId,
        restock: tipo === 'apartado' ? true : reingresar,
        refund_cents: centavos,
        refund_method: centavos > 0 ? metodo : null,
        reason: motivo.trim(),
      });

      if (res.ok) {
        setAbierto(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!abierto) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
        {tipo === 'apartado' ? 'Liberar y devolver a stock' : 'Cancelar crédito'}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-rojo/30 bg-rojo-suave/40 p-3">
      <p className="text-sm font-medium text-tinta">
        {tipo === 'apartado'
          ? 'La prenda volverá a estar disponible para vender.'
          : 'El crédito quedará anulado.'}
      </p>

      {tipo === 'credito' ? (
        <label className="flex items-center gap-2 text-sm text-tinta">
          <input
            type="checkbox"
            checked={reingresar}
            onChange={(e) => setReingresar(e.target.checked)}
            className="size-4 rounded border-borde-fuerte"
          />
          El cliente devolvió la prenda (reingresar al stock)
        </label>
      ) : null}

      {paidCents > 0 ? (
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <Label htmlFor="reembolso" hint="opcional">
              Reembolso
            </Label>
            <Input
              id="reembolso"
              value={reembolso}
              onChange={(e) => setReembolso(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>

          <div className="min-w-0 flex-1">
            <Label htmlFor="metodo-reembolso">Se devuelve por</Label>
            <Select
              id="metodo-reembolso"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPago)}
              disabled={centavos <= 0}
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_METODO[m]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {paidCents > 0 ? (
        <p className="text-xs text-tinta-suave">
          El cliente ha abonado {formatMoney(paidCents)}. Si no devuelves nada, ese dinero se
          queda registrado como recibido.
        </p>
      ) : null}

      <div>
        <Label htmlFor="motivo">Motivo</Label>
        <Input
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          minLength={3}
          maxLength={500}
          placeholder="El cliente desistió, se venció el plazo…"
        />
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setAbierto(false)}>
          Volver
        </Button>
        <Button variant="danger" className="flex-1" onClick={enviar} disabled={pendiente}>
          {pendiente ? 'Cancelando…' : 'Confirmar cancelación'}
        </Button>
      </div>
    </div>
  );
}
