'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surfaces';
import { cambiarActivoAction, cambiarRolAction } from '@/features/settings/actions';
import type { Profile } from '@/types/database';

export function GestionUsuarios({ usuarios, miId }: { usuarios: Profile[]; miId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);

    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? 'No se pudo completar la operación.');
    });
  }

  return (
    <div>
      {error ? (
        <div className="px-4 pt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <ul className="divide-y divide-borde">
        {usuarios.map((u) => {
          const soyYo = u.id === miId;

          return (
            <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-tinta">
                  {u.full_name}
                  {soyYo ? <span className="ml-2 text-xs text-tinta-tenue">(tú)</span> : null}
                </p>
                <p className="text-xs text-tinta-suave">
                  {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
                  {u.is_active ? '' : ' · inactivo'}
                </p>
              </div>

              {soyYo ? (
                <span className="text-xs text-tinta-tenue">—</span>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pendiente}
                    onClick={() =>
                      ejecutar(() =>
                        cambiarRolAction(u.id, u.role === 'admin' ? 'seller' : 'admin'),
                      )
                    }
                  >
                    {u.role === 'admin' ? 'Hacer vendedor' : 'Hacer admin'}
                  </Button>

                  <Button
                    variant={u.is_active ? 'ghost' : 'primary'}
                    size="sm"
                    disabled={pendiente}
                    onClick={() => ejecutar(() => cambiarActivoAction(u.id, !u.is_active))}
                  >
                    {u.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
