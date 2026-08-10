'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, signUp, type AuthResult } from './actions';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';

type Modo = 'entrar' | 'registrar';

export function LoginForm({ next }: { next: string }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const accion = modo === 'entrar' ? signIn : signUp;

  const [estado, formAction] = useActionState<AuthResult | null, FormData>(accion, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {modo === 'registrar' ? (
        <div>
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required maxLength={120} />
        </div>
      ) : null}

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
        <Label htmlFor="password" hint={modo === 'registrar' ? 'mínimo 8 caracteres' : undefined}>
          Contraseña
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          required
          minLength={8}
        />
      </div>

      {estado && !estado.ok ? <Alert>{estado.error}</Alert> : null}
      {estado?.ok && estado.data ? <Alert tone="info">{estado.data.notice}</Alert> : null}

      <SubmitButton modo={modo} />

      <p className="pt-1 text-center text-sm text-tinta-suave">
        {modo === 'entrar' ? '¿Primera vez? ' : '¿Ya tienes cuenta? '}
        <button
          type="button"
          onClick={() => setModo(modo === 'entrar' ? 'registrar' : 'entrar')}
          className="font-medium text-marca hover:underline"
        >
          {modo === 'entrar' ? 'Crear cuenta' : 'Iniciar sesión'}
        </button>
      </p>

      {modo === 'registrar' ? (
        <p className="text-center text-xs text-tinta-tenue">
          La primera cuenta que se cree será la de administrador. Las siguientes quedan
          inactivas hasta que un administrador las habilite.
        </p>
      ) : null}
    </form>
  );
}

function SubmitButton({ modo }: { modo: Modo }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
    </Button>
  );
}
