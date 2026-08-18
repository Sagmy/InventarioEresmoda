'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Alert, EmptyState } from '@/components/ui/surfaces';
import { guardarCategoriaAction } from '@/features/inventory/actions';
import type { Category } from '@/types/database';

/**
 * Alta y renombrado de categorías.
 *
 * No hay borrado a propósito: las prendas apuntan a su categoría, y quitar una
 * en uso dejaría el inventario descolocado sin que nadie se entere. Renombrar
 * cubre el caso real, que es haberla escrito mal o querer llamarla de otra
 * forma.
 */
export function GestionCategorias({ categorias }: { categorias: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [pendiente, iniciar] = useTransition();

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
    setError(null);
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => abrirEdicion(c)}
                  >
                    Renombrar
                  </Button>
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
