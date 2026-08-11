'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { crearUsuarioAction } from '@/features/settings/actions';

/** Contraseña temporal legible: fácil de dictar en voz alta y sin caracteres ambiguos. */
function generarPassword() {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
  const valores = crypto.getRandomValues(new Uint32Array(12));

  return Array.from(valores, (n) => alfabeto[n % alfabeto.length]).join('');
}

export function NuevoUsuario() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<{ email: string; password: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  function abrir() {
    setPassword(generarPassword());
    setError(null);
    setCreado(null);
    setAbierto(true);
  }

  function enviar(formData: FormData) {
    setError(null);

    const email = String(formData.get('email') ?? '').trim();

    startTransition(async () => {
      const res = await crearUsuarioAction({
        full_name: String(formData.get('full_name') ?? ''),
        email,
        password,
        role: String(formData.get('role') ?? 'seller'),
      });

      if (res.ok) {
        setCreado({ email, password });
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!abierto) {
    return (
      <Button size="sm" onClick={abrir}>
        <UserPlus className="size-4" />
        Nuevo usuario
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-caja border border-borde bg-superficie p-5">
        {creado ? (
          <div className="space-y-4">
            <h2 className="font-semibold text-tinta">Cuenta creada</h2>

            <p className="text-sm text-tinta-suave">
              Pásale estos datos a la persona. La contraseña no se vuelve a mostrar, así que
              cópiala ahora.
            </p>

            <dl className="space-y-2 rounded-lg bg-lienzo p-3 text-sm">
              <div>
                <dt className="text-xs text-tinta-tenue">Correo</dt>
                <dd className="font-medium text-tinta">{creado.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-tinta-tenue">Contraseña temporal</dt>
                <dd className="font-mono font-medium tracking-wide text-tinta">
                  {creado.password}
                </dd>
              </div>
            </dl>

            <Button className="w-full" onClick={() => setAbierto(false)}>
              Listo
            </Button>
          </div>
        ) : (
          <form action={enviar} className="space-y-3">
            <h2 className="font-semibold text-tinta">Nuevo usuario</h2>

            <div>
              <Label htmlFor="full_name">Nombre</Label>
              <Input id="full_name" name="full_name" required minLength={2} maxLength={120} autoFocus />
            </div>

            <div>
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" inputMode="email" required />
            </div>

            <div>
              <Label htmlFor="role">Rol</Label>
              <Select id="role" name="role" defaultValue="seller">
                <option value="seller">Vendedor — registra ventas, no ve costos</option>
                <option value="admin">Administrador — ve costos y reportes</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="password" hint="se la dictas tú">
                Contraseña temporal
              </Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPassword(generarPassword())}
                >
                  Otra
                </Button>
              </div>
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
                {pendiente ? 'Creando…' : 'Crear cuenta'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
