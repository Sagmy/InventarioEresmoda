'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Alert, EmptyState } from '@/components/ui/surfaces';
import { borrarCategoriaAction, guardarCategoriaAction } from '@/features/inventory/actions';
import type { Category } from '@/types/database';

/**
 * Alta, renombrado y borrado de categorías.
 *
 * El borrado pide confirmación en el sitio, pero quien decide de verdad es la
 * base: `delete_category` se niega si la categoría tiene prendas dentro y dice
 * cuántas son. Aquí no se comprueba nada de eso por nuestra cuenta, porque el
 * recuento podría haber cambiado entre que se pintó la lista y se pulsó el
 * botón.
 */
export function GestionCategorias({ categorias }: { categorias: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  function guardar(id: string | null, valor: string, alTerminar: () => void) {
    const nombre = valor.trim();

    if (!nombre) {
      setError('La categoría necesita un nombre.');
      return;
    }

    setError(null);

    iniciar(async () => {
      const res = await guardarCategoriaAction({ id, name: nombre });

      if (res.ok) {
        alTerminar();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function abrirEdicion(categoria: Category) {
    setEditando(categoria.id);
    setNombreEditado(categoria.name);
    setConfirmando(null);
    setError(null);
  }

  function borrar(id: string) {
    setError(null);

    iniciar(async () => {
      const res = await borrarCategoriaAction(id);

      if (res.ok) {
        setConfirmando(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      {error ? (
        <div className="px-4 pt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {categorias.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías"
          description="Créalas aquí y aparecerán al dar de alta una prenda."
        />
      ) : (
        <ul className="divide-y divide-borde">
          {categorias.map((c) => (
            <li key={c.id} className="px-4 py-3">
              {editando === c.id ? (
                <div className="flex gap-2">
                  <Input
                    aria-label={`Nuevo nombre para ${c.name}`}
                    value={nombreEditado}
                    onChange={(e) => setNombreEditado(e.target.value)}
                    maxLength={60}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={pendiente}
                    onClick={() => guardar(c.id, nombreEditado, () => setEditando(null))}
                  >
                    {pendiente ? 'Guardando…' : 'Guardar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setEditando(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 font-medium text-tinta">{c.name}</span>

                  {confirmando === c.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-tinta-suave">¿Borrar?</span>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={pendiente}
                        onClick={() => borrar(c.id)}
                      >
                        {pendiente ? 'Borrando…' : 'Sí'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmando(null)}>
                        No
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="secondary" size="sm" onClick={() => abrirEdicion(c)}>
                        Renombrar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConfirmando(c.id);
                          setError(null);
                        }}
                      >
                        Borrar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-borde p-4">
        <Input
          aria-label="Nombre de la categoría nueva"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          maxLength={60}
          placeholder="Blusas"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              guardar(null, nombreNuevo, () => setNombreNuevo(''));
            }
          }}
        />
        <Button
          className="shrink-0"
          disabled={pendiente}
          onClick={() => guardar(null, nombreNuevo, () => setNombreNuevo(''))}
        >
          {pendiente ? 'Añadiendo…' : 'Añadir'}
        </Button>
      </div>
    </div>
  );
}
