'use client';

import { useState, useTransition } from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { GestorFotos } from '@/features/inventory/components/gestor-fotos';
import { parseMoneyToCents } from '@/lib/money';
import {
  ajustarInventarioAction,
  cambiarActivoProductoAction,
  cambiarActivoVarianteAction,
  entradaMercanciaAction,
} from '@/features/inventory/actions';

type Modo = null | 'entrada' | 'ajuste' | 'fotos' | 'retirar';

export function AccionesStock({
  variantId,
  productId,
  etiqueta,
  nombreProducto,
  varianteActiva,
  productoActivo,
}: {
  variantId: string;
  productId: string;
  etiqueta: string;
  nombreProducto: string;
  varianteActiva: boolean;
  productoActivo: boolean;
}) {
  const [modo, setModo] = useState<Modo>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    setModo(null);
    setError(null);
  }

  function enviarEntrada(formData: FormData) {
    const qty = Number(formData.get('qty'));
    const costoTexto = String(formData.get('cost') ?? '').trim();
    const costo = costoTexto === '' ? null : parseMoneyToCents(costoTexto);

    if (costoTexto !== '' && costo === null) {
      setError('El costo no es un monto válido.');
      return;
    }

    startTransition(async () => {
      const res = await entradaMercanciaAction({
        variant_id: variantId,
        qty,
        unit_cost_cents: costo,
        note: String(formData.get('note') ?? '') || undefined,
      });

      if (res.ok) cerrar();
      else setError(res.error);
    });
  }

  function cambiarVariante(activo: boolean) {
    setError(null);

    startTransition(async () => {
      const res = await cambiarActivoVarianteAction(variantId, activo);
      if (res.ok) cerrar();
      else setError(res.error);
    });
  }

  function cambiarProducto(activo: boolean) {
    setError(null);

    startTransition(async () => {
      const res = await cambiarActivoProductoAction(productId, activo);
      if (res.ok) cerrar();
      else setError(res.error);
    });
  }

  function enviarAjuste(formData: FormData) {
    startTransition(async () => {
      const res = await ajustarInventarioAction({
        variant_id: variantId,
        delta: Number(formData.get('delta')),
        note: String(formData.get('note') ?? ''),
      });

      if (res.ok) cerrar();
      else setError(res.error);
    });
  }

  if (!modo) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Acciones de ${etiqueta}`}
        onClick={() => setModo(varianteActiva && productoActivo ? 'entrada' : 'retirar')}
      >
        <MoreVertical className="size-4" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-caja border border-borde bg-superficie p-5">
        <h3 className="font-semibold text-tinta">{etiqueta}</h3>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setModo('entrada')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
              modo === 'entrada'
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde text-tinta-suave'
            }`}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setModo('ajuste')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
              modo === 'ajuste'
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde text-tinta-suave'
            }`}
          >
            Ajuste
          </button>
          <button
            type="button"
            onClick={() => setModo('fotos')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
              modo === 'fotos'
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde text-tinta-suave'
            }`}
          >
            Fotos
          </button>
          <button
            type="button"
            onClick={() => setModo('retirar')}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
              modo === 'retirar'
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde text-tinta-suave'
            }`}
          >
            Retirar
          </button>
        </div>

        {modo === 'fotos' ? (
          <>
            <p className="mt-3 text-xs text-tinta-tenue">
              Las fotos son de «{nombreProducto}» entera, no solo de esta talla. Asigna cada una a
              su color si la prenda viene en varios.
            </p>
            <GestorFotos productId={productId} onGuardado={cerrar} onCancelar={cerrar} />
          </>
        ) : modo === 'retirar' ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-tinta-suave">
              Retirar no borra nada. La prenda sale del inventario y del punto de venta, pero sus
              ventas y su libro de movimientos siguen enteros. Se puede deshacer cuando quieras.
            </p>

            {!productoActivo ? (
              <>
                <p className="rounded-lg bg-lienzo p-3 text-sm text-tinta-suave">
                  «{nombreProducto}» está retirada entera, con todas sus tallas.
                </p>
                <Button className="w-full" disabled={pendiente} onClick={() => cambiarProducto(true)}>
                  {pendiente ? 'Devolviendo…' : 'Devolver la prenda al mostrador'}
                </Button>
              </>
            ) : (
              <>
                {varianteActiva ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={pendiente}
                    onClick={() => cambiarVariante(false)}
                  >
                    Retirar solo esta talla y color
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={pendiente}
                    onClick={() => cambiarVariante(true)}
                  >
                    Devolver esta talla al mostrador
                  </Button>
                )}

                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={pendiente}
                  onClick={() => cambiarProducto(false)}
                >
                  Retirar «{nombreProducto}» entera
                </Button>
              </>
            )}

            {error ? <Alert>{error}</Alert> : null}

            <Button type="button" variant="ghost" className="w-full" onClick={cerrar}>
              Cerrar
            </Button>
          </div>
        ) : modo === 'entrada' ? (
          <form action={enviarEntrada} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="qty">Cuántas entran</Label>
              <Input id="qty" name="qty" type="number" min={1} required autoFocus />
            </div>

            <div>
              <Label htmlFor="cost" hint="opcional">
                Costo por unidad
              </Label>
              <Input id="cost" name="cost" inputMode="decimal" placeholder="0.00" />
              <p className="mt-1 text-xs text-tinta-tenue">
                Si lo indicas, se recalcula el costo promedio de esta prenda.
              </p>
            </div>

            <div>
              <Label htmlFor="note" hint="opcional">
                Nota
              </Label>
              <Input id="note" name="note" maxLength={200} placeholder="Compra del proveedor…" />
            </div>

            {error ? <Alert>{error}</Alert> : null}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={pendiente}>
                {pendiente ? 'Guardando…' : 'Registrar'}
              </Button>
            </div>
          </form>
        ) : (
          <form action={enviarAjuste} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="delta" hint="negativo para restar">
                Ajuste
              </Label>
              <Input id="delta" name="delta" type="number" required autoFocus placeholder="-1" />
              <p className="mt-1 text-xs text-tinta-tenue">
                Para corregir diferencias tras un conteo físico.
              </p>
            </div>

            <div>
              <Label htmlFor="note-ajuste">Motivo</Label>
              <Input
                id="note-ajuste"
                name="note"
                required
                minLength={3}
                maxLength={200}
                placeholder="Conteo físico, prenda dañada…"
              />
            </div>

            {error ? <Alert>{error}</Alert> : null}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={pendiente}>
                {pendiente ? 'Guardando…' : 'Ajustar'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
