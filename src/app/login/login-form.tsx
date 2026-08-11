'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, type AuthResult } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';

/**
 * Solo inicio de sesión. No hay opción de crear cuenta: las da de alta el
 * administrador desde Ajustes → Equipo.
 */
export function LoginForm({ next }: { next: string }) {
  const [estado, formAction] = useActionState<AuthResult | null, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
        />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </div>

      {estado && !estado.ok ? <Alert>{estado.error}</Alert> : null}

      <SubmitButton />

      <p className="pt-1 text-center text-xs text-tinta-tenue">
        ¿No tienes cuenta? Pídesela al administrador de la tienda.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Un momento…' : 'Entrar'}
    </Button>
  );
}
