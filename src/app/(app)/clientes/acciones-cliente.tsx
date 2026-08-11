'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import {
  desactivarClienteAction,
  eliminarClienteAction,
  guardarClienteAction,
} from '@/features/customers/actions';
import type { Customer } from '@/types/database';

type Panel = null | 'menu' | 'editar' | 'borrar';

export function AccionesCliente({
  cliente,
  esAdmin,
  tieneDeuda,
}: {
  cliente: Customer;
  esAdmin: boolean;
  tieneDeuda: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    setPanel(null);
    setError(null);
  }

  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);

    startTransition(async () => {
      const res = await fn();

      if (res.ok) {
        cerrar();
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo completar la operación.');
      }
    });
  }

  function editar(formData: FormData) {
    ejecutar(() =>
      guardarClienteAction({
        id: cliente.id,
        full_name: String(formData.get('full_name') ?? ''),
        phone: String(formData.get('phone') ?? '') || undefined,
        document_id: String(formData.get('document_id') ?? '') || undefined,
        notes: String(formData.get('notes') ?? '') || undefined,
      }),
    );
  }

  if (!panel) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Acciones de ${cliente.full_name}`}
        onClick={() => setPanel('menu')}
      >
        <MoreVertical className="size-4" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-caja border border-borde bg-superficie p-5">
        <h3 className="font-semibold text-tinta">{cliente.full_name}</h3>

        {/* ---- Menú ------------------------------------------------------- */}
        {panel === 'menu' ? (
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => setPanel('editar')}>
              Editar datos
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              disabled={pendiente}
              onClick={() => ejecutar(() => desactivarClienteAction(cliente.id, !cliente.is_active))}
            >
              {cliente.is_active ? 'Desactivar' : 'Reactivar'}
            </Button>

            {esAdmin ? (
              <Button variant="danger" className="w-full" onClick={() => setPanel('borrar')}>
                Borrar definitivamente
              </Button>
            ) : null}

            {cliente.is_active ? (
              <p className="pt-1 text-xs text-tinta-tenue">
                Desactivar lo esconde de las listas y del punto de venta, pero conserva sus
                compras y su historial.
                {tieneDeuda ? ' Su deuda seguirá apareciendo en Cobros.' : ''}
              </p>
            ) : null}

            {error ? <Alert>{error}</Alert> : null}

            <Button variant="ghost" className="w-full" onClick={cerrar}>
              Cerrar
            </Button>
          </div>
        ) : null}

        {/* ---- Editar ----------------------------------------------------- */}
        {panel === 'editar' ? (
          <form action={editar} className="mt-4 space-y-3">
            <div>
              <Label htmlFor={`nombre-${cliente.id}`}>Nombre</Label>
              <Input
                id={`nombre-${cliente.id}`}
                name="full_name"
                defaultValue={cliente.full_name}
                required
                minLength={2}
                maxLength={120}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor={`tel-${cliente.id}`}>Teléfono</Label>
              <Input
                id={`tel-${cliente.id}`}
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={cliente.phone ?? ''}
                maxLength={30}
              />
            </div>

            <div>
              <Label htmlFor={`doc-${cliente.id}`}>Cédula o documento</Label>
              <Input
                id={`doc-${cliente.id}`}
                name="document_id"
                defaultValue={cliente.document_id ?? ''}
                maxLength={30}
              />
            </div>

            <div>
              <Label htmlFor={`nota-${cliente.id}`}>Nota</Label>
              <Textarea
                id={`nota-${cliente.id}`}
                name="notes"
                defaultValue={cliente.notes ?? ''}
                maxLength={2000}
                className="min-h-16"
              />
            </div>

            {error ? <Alert>{error}</Alert> : null}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setPanel('menu')}
              >
                Volver
              </Button>
              <Button type="submit" className="flex-1" disabled={pendiente}>
                {pendiente ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        ) : null}

        {/* ---- Borrar ----------------------------------------------------- */}
        {panel === 'borrar' ? (
          <div className="mt-4 space-y-3">
            <Alert tone="warn">
              Esto borra al cliente para siempre. Solo funciona si nunca tuvo una venta,
              apartado ni crédito; si tiene historial, la base lo va a impedir.
            </Alert>

            {tieneDeuda ? (
              <p className="text-sm text-rojo">
                Este cliente tiene deuda pendiente. Ciérrala antes de intentarlo.
              </p>
            ) : null}

            {error ? <Alert>{error}</Alert> : null}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setPanel('menu')}
              >
                Volver
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={pendiente}
                onClick={() => ejecutar(() => eliminarClienteAction(cliente.id))}
              >
                {pendiente ? 'Borrando…' : 'Sí, borrar'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
