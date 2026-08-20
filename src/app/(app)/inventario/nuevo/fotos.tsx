'use client';

import { useState, useTransition } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Label, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/surfaces';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface FotoSubida {
  /** Ruta dentro del bucket, que es lo que se guarda en la base. */
  path: string;
  /** URL pública para la miniatura. No se guarda: se puede recalcular siempre. */
  url: string;
  /** Null = vale para todos los colores. */
  color: string | null;
}

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Sube las fotos de la prenda al bucket `prendas`.
 *
 * Sube en cuanto eliges el archivo, antes de que la prenda exista, para poder
 * enseñarte la miniatura y que veas qué estás guardando. El precio de eso es que
 * si abandonas el formulario a medias quedan archivos sueltos en el bucket; no
 * estorban a nadie y nada los referencia.
 *
 * Esto escribe desde el navegador, que es la excepción a la regla del proyecto
 * de que toda escritura pasa por una Server Action. La regla protege las TABLAS,
 * y aquí no se toca ninguna: el archivo va a Storage, que tiene sus propias
 * políticas, y la de subida exige `is_admin()`. Pasar cinco megas de foto por
 * una Server Action sería mandar el archivo dos veces por la red sin ganar nada.
 */
export function SubidorFotos({
  fotos,
  onCambio,
  colores,
}: {
  fotos: FotoSubida[];
  onCambio: (fotos: FotoSubida[]) => void;
  colores: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [subiendo, iniciarSubida] = useTransition();

  function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;

    const archivos = Array.from(lista);
    setError(null);

    for (const archivo of archivos) {
      if (!TIPOS.includes(archivo.type)) {
        setError(`«${archivo.name}» no es una imagen JPG, PNG ni WEBP.`);
        return;
      }

      if (archivo.size > MAX_BYTES) {
        setError(`«${archivo.name}» pesa más de 5 MB. Reduce la foto y vuelve a intentar.`);
        return;
      }
    }

    iniciarSubida(async () => {
      const supabase = getSupabaseBrowserClient();
      const subidas: FotoSubida[] = [];

      for (const archivo of archivos) {
        const ruta = `${crypto.randomUUID()}.${EXTENSIONES[archivo.type] ?? 'jpg'}`;

        const { error: fallo } = await supabase.storage
          .from('prendas')
          .upload(ruta, archivo, { contentType: archivo.type });

        if (fallo) {
          setError(`No se pudo subir «${archivo.name}». ${fallo.message}`);
          // Lo ya subido se conserva: repetir la subida de esas fotos sería
          // pedirle al usuario que rehaga trabajo que sí salió bien.
          if (subidas.length > 0) onCambio([...fotos, ...subidas]);
          return;
        }

        const { data } = supabase.storage.from('prendas').getPublicUrl(ruta);

        subidas.push({ path: ruta, url: data.publicUrl, color: null });
      }

      onCambio([...fotos, ...subidas]);
    });
  }

  function quitar(path: string) {
    onCambio(fotos.filter((f) => f.path !== path));

    // Se borra del bucket sin esperar respuesta: si fallara, el archivo queda
    // suelto sin que nada lo apunte, y no es motivo para bloquear el formulario.
    void getSupabaseBrowserClient().storage.from('prendas').remove([path]);
  }

  function asignarColor(path: string, color: string) {
    onCambio(fotos.map((f) => (f.path === path ? { ...f, color: color || null } : f)));
  }

  return (
    <div>
      <Label htmlFor="fotos">Fotos de la prenda</Label>

      <p className="mb-2 text-xs text-tinta-tenue">
        Son las que se verán en la página pública. Hace falta al menos una. Si la prenda viene en
        varios colores, asigna cada foto al suyo; las que dejes en «Todos los colores» sirven de
        respaldo.
      </p>

      <div className="flex flex-wrap gap-3">
        {fotos.map((foto, i) => (
          <div key={foto.path} className="w-28">
            <div className="relative">
              {/* Es una miniatura de algo que el usuario acaba de elegir: no
                  aporta nada a un lector de pantalla, y el botón de quitar sí
                  dice de qué foto se trata. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.url}
                alt=""
                className="h-28 w-28 rounded-lg border border-borde object-cover"
              />

              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-marca px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Principal
                </span>
              ) : null}

              <button
                type="button"
                aria-label={`Quitar la foto ${i + 1}`}
                onClick={() => quitar(foto.path)}
                className="absolute -right-2 -top-2 rounded-full border border-borde bg-superficie p-1 text-tinta-suave shadow-sm hover:text-rojo"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {colores.length > 0 ? (
              <Select
                aria-label={`Color de la foto ${i + 1}`}
                value={foto.color ?? ''}
                onChange={(e) => asignarColor(foto.path, e.target.value)}
                className="mt-1 h-8 px-2 text-xs"
              >
                <option value="">Todos los colores</option>
                {colores.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        ))}

        <label
          className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-borde-fuerte text-tinta-tenue hover:border-marca hover:text-marca"
        >
          <ImagePlus className="size-6" />
          <span className="text-xs">{subiendo ? 'Subiendo…' : 'Añadir'}</span>
          <input
            id="fotos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={subiendo}
            onChange={(e) => {
              elegir(e.target.files);
              // Sin esto, volver a elegir el mismo archivo no dispara el evento.
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
