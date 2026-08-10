'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { guardarClienteAction } from '@/features/customers/actions';

export function NuevoCliente() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function enviar(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const res = await guardarClienteAction({
        full_name: String(formData.get('full_name') ?? ''),
        phone: String(formData.get('phone') ?? '') || undefined,
        document_id: String(formData.get('document_id') ?? '') || undefined,
        notes: String(formData.get('notes') ?? '') || undefined,
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
      <Button size="sm" onClick={() => setAbierto(true)}>
        <UserPlus className="size-4" />
        Nuevo
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        action={enviar}
        className="w-full max-w-sm space-y-3 rounded-caja border border-borde bg-superficie p-5"
      >
        <h2 className="font-semibold text-tinta">Nuevo cliente</h2>

        <div>
          <Label htmlFor="full_name">Nombre</Label>
          <Input id="full_name" name="full_name" required minLength={2} maxLength={120} autoFocus />
        </div>

        <div>
          <Label htmlFor="phone" hint="opcional">
            Teléfono
          </Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" maxLength={30} />
        </div>

        <div>
          <Label htmlFor="document_id" hint="opcional">
            Cédula o documento
          </Label>
          <Input id="document_id" name="document_id" maxLength={30} />
        </div>

        <div>
          <Label htmlFor="notes" hint="opcional">
            Nota
          </Label>
          <Textarea id="notes" name="notes" maxLength={2000} className="min-h-16" />
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={pendiente}>
            {pendiente ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
