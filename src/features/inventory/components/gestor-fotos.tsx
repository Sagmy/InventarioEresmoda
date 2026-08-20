'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surfaces';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { guardarFotosProductoAction } from '@/features/inventory/actions';
import { SubidorFotos, type FotoSubida } from './subidor-fotos';
import type { ProductImage } from '@/types/database';

/**
 * Edita las fotos de una prenda ya cargada.
 *
 * Carga las actuales desde el navegador (el personal puede leer product_images
 * y product_variants) y manda el juego completo al guardar. Los colores del
 * desplegable salen de las variantes reales de la prenda, no de un texto libre,
 * para que una foto no acabe asignada a un color que no existe.
 */
export function GestorFotos({
  productId,
  onGuardado,
  onCancelar,
}: {
  productId: string;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [fotos, setFotos] = useState<FotoSubida[] | null>(null);
  const [colores, setColores] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  useEffect(() => {
    // Si el modal se cierra mientras la consulta viaja, no se toca el estado de
    // un componente que ya no está montado.
    let vivo = true;

    void (async () => {
      const supabase = getSupabaseBrowserClient();

      const [{ data: imagenes, error: fallo }, { data: variantes }] = await Promise.all([
        supabase.from('product_images').select('*').eq('product_id', productId).order('sort_order'),
        supabase.from('product_variants').select('color').eq('product_id', productId),
      ]);

      if (!vivo) return;

      if (fallo) {
        setError('No se pudieron cargar las fotos de esta prenda.');
        setFotos([]);
        return;
      }

      setFotos(
        ((imagenes ?? []) as ProductImage[]).map((i) => ({
          path: i.storage_path,
          // La base guarda la ruta, no la URL: se reconstruye al vuelo.
          url: supabase.storage.from('prendas').getPublicUrl(i.storage_path).data.publicUrl,
          color: i.color,
        })),
      );

      setColores([
        ...new Set(
          (variantes ?? []).map((v) => v.color).filter((c): c is string => Boolean(c && c.trim())),
        ),
      ]);
    })();

    return () => {
      vivo = false;
    };
  }, [productId]);

  function guardar() {
    if (!fotos || fotos.length === 0) {
      setError('La prenda necesita al menos una foto.');
      return;
    }

    setError(null);

    iniciar(async () => {
      const res = await guardarFotosProductoAction({
        product_id: productId,
        images: fotos.map((f) => ({ path: f.path, color: f.color })),
      });

      if (res.ok) onGuardado();
      else setError(res.error);
    });
  }

  if (fotos === null) {
    return <p className="mt-4 text-sm text-tinta-suave">Cargando fotos…</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      <SubidorFotos
        fotos={fotos}
        onCambio={setFotos}
        colores={colores}
        borrarDelBucketAlQuitar={false}
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="button" className="flex-1" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar fotos'}
        </Button>
      </div>
    </div>
  );
}
