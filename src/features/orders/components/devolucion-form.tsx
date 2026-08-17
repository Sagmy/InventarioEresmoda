'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { formatMoney, parseMoneyToCents } from '@/lib/money';
import { registrarDevolucionAction } from '@/features/orders/actions';
import { ETIQUETA_METODO, type MetodoPago } from '@/features/orders/schemas';
import type { OrderItemRow } from '@/types/database';

const METODOS: MetodoPago[] = [
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto_venta',
  'otro',
];

/**
 * Devolución de una venta ya liquidada.
 *
 * Se devuelve por línea y por cantidad: un cliente puede traer de vuelta una de
 * las tres camisas que compró. La base impide devolver más unidades de las que
 * quedan sin devolver, así que no hay forma de inflar el inventario repitiendo
 * la operación.
 *
 * El reingreso al stock es opcional a propósito: una prenda que vuelve rota o
 * manchada no se puede volver a vender, y sumarla al inventario sería mentir
 * sobre lo que hay en la tienda.
 */
export function DevolucionForm({
  orderId,
  items,
  paidCents,
  esAdmin,
}: {
  orderId: string;
  items: OrderItemRow[];
  paidCents: number;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [reingresar, setReingresar] = useState(true);
  const [reembolso, setReembolso] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  /** Lo que todavía se puede devolver de cada línea. */
  const devolvibles = useMemo(
    () => items.map((i) => ({ item: i, maximo: i.qty - i.returned_qty })).filter((x) => x.maximo > 0),
    [items],
  );

  const valorDevuelto = useMemo(
    () =>
      devolvibles.reduce(
        (suma, { item }) => suma + (cantidades[item.id] ?? 0) * item.unit_price_cents,
        0,
      ),
    [devolvibles, cantidades],
  );

  const totalUnidades = Object.values(cantidades).reduce((s, n) => s + n, 0);
  const centavosReembolso = reembolso.trim() === '' ? 0 : (parseMoneyToCents(reembolso) ?? -1);

  function cambiar(itemId: string, valor: string, maximo: number) {
    const n = Math.max(0, Math.min(maximo, Number(valor) || 0));
    setCantidades((prev) => ({ ...prev, [itemId]: n }));
  }

  function enviar() {
    setError(null);

    if (totalUnidades === 0) {
      setError('Indica cuántas unidades se devuelven.');
      return;
    }

    if (centavosReembolso < 0) {
      setError('El monto del reembolso no es válido.');
      return;
    }

    if (centavosReembolso > paidCents) {
      setError(`El reembolso supera lo que el cliente pagó (${formatMoney(paidCents)}).`);
      return;
    }

    const seleccion = Object.entries(cantidades)
      .filter(([, qty]) => qty > 0)
      .map(([order_item_id, qty]) => ({ order_item_id, qty }));

    startTransition(async () => {
      const res = await registrarDevolucionAction({
        order_id: orderId,
        items: seleccion,
        restock: reingresar,
        refund_cents: centavosReembolso,
        refund_method: centavosReembolso > 0 ? metodo : null,
        notes: notas.trim() || undefined,
      });

      if (res.ok) {
        setAbierto(false);
        setCantidades({});
        setReembolso('');
        setNotas('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (devolvibles.length === 0) {
    return (
      <p className="text-sm text-tinta-suave">
        Todas las prendas de esta venta ya fueron devueltas.
      </p>
    );
  }

  if (!abierto) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
        <Undo2 className="size-4" />
        Registrar devolución
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {devolvibles.map(({ item, maximo }) => (
          <div key={item.id} className="flex items-center gap-3 rounded-lg bg-lienzo p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-tinta">{item.variant_label}</p>
              <p className="tabular text-xs text-tinta-suave">
                {formatMoney(item.unit_price_cents)} c/u · quedan {maximo} sin devolver
              </p>
            </div>

            <Input
              type="number"
              min={0}
              max={maximo}
              value={cantidades[item.id] ?? 0}
              onChange={(e) => cambiar(item.id, e.target.value, maximo)}
              className="h-9 w-20 shrink-0"
              aria-label={`Unidades a devolver de ${item.variant_label}`}
            />
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-tinta">
        <input
          type="checkbox"
          checked={reingresar}
          onChange={(e) => setReingresar(e.target.checked)}
          className="size-4 rounded border-borde-fuerte"
        />
        Devolver las prendas al inventario
      </label>

      {!reingresar ? (
        <p className="text-xs text-tinta-tenue">
          No se sumarán al stock. Úsalo si vuelven dañadas y no se pueden revender.
        </p>
      ) : null}

      {esAdmin ? (
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
            <Label htmlFor="metodo-dev">Se devuelve por</Label>
            <Select
              id="metodo-dev"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as MetodoPago)}
              disabled={centavosReembolso <= 0}
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_METODO[m]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-lienzo px-3 py-2 text-xs text-tinta-suave">
          Para devolver dinero hace falta un administrador. Puedes registrar el reingreso de la
          prenda y que él haga el reembolso.
        </p>
      )}

      {valorDevuelto > 0 ? (
        <p className="tabular text-sm text-tinta-suave">
          Valor de lo devuelto: <strong className="text-tinta">{formatMoney(valorDevuelto)}</strong>
          {esAdmin ? (
            <button
              type="button"
              onClick={() => setReembolso((valorDevuelto / 100).toFixed(2))}
              className="ml-2 text-marca hover:underline"
            >
              usar como reembolso
            </button>
          ) : null}
        </p>
      ) : null}

      <div>
        <Label htmlFor="notas-dev" hint="opcional">
          Nota
        </Label>
        <Textarea
          id="notas-dev"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={2000}
          className="min-h-16"
          placeholder="Motivo de la devolución…"
        />
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={enviar} disabled={pendiente || totalUnidades === 0}>
          {pendiente ? 'Registrando…' : `Devolver ${totalUnidades || ''}`.trim()}
        </Button>
      </div>
    </div>
  );
}
