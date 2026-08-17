'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { formatMoney } from '@/lib/money';
import { anularPagoAction } from '@/features/orders/actions';
import { ETIQUETA_METODO } from '@/features/orders/schemas';

export function AnularPago({
  paymentId,
  amountCents,
  method,
}: {
  paymentId: string;
  amountCents: number;
  method: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function enviar() {
    setError(null);

    startTransition(async () => {
      const res = await anularPagoAction(paymentId, motivo.trim());

      if (res.ok) {
        setAbierto(false);
        setMotivo('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-tinta-tenue underline-offset-2 hover:text-rojo hover:underline"
      >
        Anular
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm space-y-3 rounded-caja border border-borde bg-superficie p-5">
        <h3 className="font-semibold text-tinta">Anular pago</h3>

        <p className="text-sm text-tinta-suave">
          {formatMoney(amountCents)} · {ETIQUETA_METODO[method] ?? method}
        </p>

        <Alert tone="warn">
          El pago no se borra: queda marcado como anulado con tu nombre y el motivo, y deja de
          contar en la caja. El saldo de la transacción vuelve a subir.
        </Alert>

        <div>
          <Label htmlFor={`motivo-${paymentId}`}>Motivo</Label>
          <Input
            id={`motivo-${paymentId}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            minLength={3}
            maxLength={500}
            placeholder="Monto equivocado, pago duplicado…"
            autoFocus
          />
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={() => setAbierto(false)}>
            Volver
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={enviar}
            disabled={pendiente || motivo.trim().length < 3}
          >
            {pendiente ? 'Anulando…' : 'Anular pago'}
          </Button>
        </div>
      </div>
    </div>
  );
}
