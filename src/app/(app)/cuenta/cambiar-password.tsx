'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { cambiarPasswordAction } from '@/features/account/actions';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import type { ActionResult } from '@/lib/actions';

export function CambiarPassword() {
  const [estado, formAction] = useActionState<ActionResult<{ notice: string }> | null, FormData>(
    cambiarPasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4 p-4">
      <div>
        <Label htmlFor="actual">Contraseña actual</Label>
        <Input id="actual" name="actual" type="password" autoComplete="current-password" required />
      </div>

      <div>
        <Label htmlFor="nueva" hint="mínimo 8 caracteres">
          Contraseña nueva
        </Label>
        <Input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <div>
        <Label htmlFor="repetir">Repite la nueva</Label>
        <Input
          id="repetir"
          name="repetir"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      {estado && !estado.ok ? <Alert>{estado.error}</Alert> : null}
      {estado?.ok ? <Alert tone="info">{estado.data.notice}</Alert> : null}

      <BotonGuardar />
    </form>
  );
}

function BotonGuardar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Guardando…' : 'Cambiar contraseña'}
    </Button>
  );
}
