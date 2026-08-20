'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Select } from '@/components/ui/field';
import { Alert, Card, CardHeader } from '@/components/ui/surfaces';
import { parseMoneyToCents } from '@/lib/money';
import { crearProductoAction, guardarCategoriaAction } from '@/features/inventory/actions';
import { SubidorFotos, type FotoSubida } from './fotos';
import type { Category, VariantInput } from '@/types/database';

interface FilaVariante {
  clave: number;
  color: string;
  size: string;
  precio: string;
  costo: string;
  cantidad: string;
}

const TALLAS_SUGERIDAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Única'];

function filaVacia(clave: number): FilaVariante {
  return { clave, color: '', size: '', precio: '', costo: '', cantidad: '0' };
}

export function FormularioProducto({ categorias }: { categorias: Category[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [filas, setFilas] = useState<FilaVariante[]>([filaVacia(0)]);

  // Solo hacen falta id y nombre: `Category` pide además created_at, que la
  // categoría recién creada no tiene a mano y a este formulario no le importa.
  const [listaCategorias, setListaCategorias] = useState<{ id: string; name: string }[]>(categorias);
  const [categoriaId, setCategoriaId] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nombreCategoria, setNombreCategoria] = useState('');
  const [errorCategoria, setErrorCategoria] = useState<string | null>(null);
  const [pendienteCategoria, iniciarCategoria] = useTransition();
  const [fotos, setFotos] = useState<FotoSubida[]>([]);

  // Los colores que ya escribiste abajo son los que se pueden asignar a cada
  // foto. Se recalculan en cada render a propósito: si corriges un color, el
  // desplegable de las fotos tiene que seguirte.
  const coloresDeLasFilas = [...new Set(filas.map((f) => f.color.trim()).filter(Boolean))];

  function cerrarCategoria() {
    setCreandoCategoria(false);
    setNombreCategoria('');
    setErrorCategoria(null);
  }

  /**
   * Crea la categoría y la deja ya seleccionada: quien la está creando a mitad
   * de dar de alta una prenda la quiere para esa prenda.
   *
   * La lista se actualiza en local en vez de recargar del servidor, porque un
   * refresco aquí borraría las filas de colores y tallas ya escritas.
   */
  function anadirCategoria() {
    const nombre = nombreCategoria.trim();

    if (!nombre) {
      setErrorCategoria('Escribe un nombre para la categoría.');
      return;
    }

    setErrorCategoria(null);

    iniciarCategoria(async () => {
      const res = await guardarCategoriaAction({ id: null, name: nombre });

      if (!res.ok) {
        setErrorCategoria(res.error);
        return;
      }

      setListaCategorias((prev) =>
        [...prev, { id: res.data, name: nombre }].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
      setCategoriaId(res.data);
      cerrarCategoria();
    });
  }

  function actualizar(clave: number, campo: keyof FilaVariante, valor: string) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  }

  function agregarFila() {
    setFilas((prev) => {
      const ultima = prev[prev.length - 1];
      const siguiente = filaVacia(Date.now());

      // Al agregar una talla nueva casi siempre se repiten color y precio:
      // heredarlos ahorra teclear lo mismo cinco veces seguidas.
      if (ultima) {
        siguiente.color = ultima.color;
        siguiente.precio = ultima.precio;
        siguiente.costo = ultima.costo;
      }

      return [...prev, siguiente];
    });
  }

  function quitarFila(clave: number) {
    setFilas((prev) => (prev.length === 1 ? prev : prev.filter((f) => f.clave !== clave)));
  }

  function enviar(formData: FormData) {
    setError(null);

    const variants: VariantInput[] = [];

    for (const fila of filas) {
      const precio = parseMoneyToCents(fila.precio);

      if (precio === null) {
        setError(`Revisa el precio de la talla ${fila.size || '(sin talla)'}.`);
        return;
      }

      const costo = fila.costo.trim() === '' ? 0 : parseMoneyToCents(fila.costo);

      if (costo === null) {
        setError(`Revisa el costo de la talla ${fila.size || '(sin talla)'}.`);
        return;
      }

      variants.push({
        size: fila.size.trim() || undefined,
        color: fila.color.trim() || undefined,
        price_cents: precio,
        cost_cents: costo,
        qty: Number(fila.cantidad) || 0,
      });
    }

    if (fotos.length === 0) {
      setError('Añade al menos una foto de la prenda: es la que verá la página pública.');
      return;
    }

    startTransition(async () => {
      const res = await crearProductoAction({
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? '') || undefined,
        brand: String(formData.get('brand') ?? '') || undefined,
        category_id: categoriaId || null,
        variants,
        images: fotos.map((f) => ({ path: f.path, color: f.color })),
      });

      if (res.ok) router.push('/inventario');
      else setError(res.error);
    });
  }

  return (
    <form action={enviar} className="space-y-4">
      <Card className="space-y-4 p-4">
        <div>
          <Label htmlFor="name">Nombre de la prenda</Label>
          <Input id="name" name="name" required maxLength={160} autoFocus placeholder="Camisa de lino" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="brand" hint="opcional">
              Marca
            </Label>
            <Input id="brand" name="brand" maxLength={80} />
          </div>

          <div>
            <Label htmlFor="category_id" hint="opcional">
              Categoría
            </Label>
            {creandoCategoria ? (
              <div className="flex gap-2">
                <Input
                  aria-label="Nombre de la categoría"
                  value={nombreCategoria}
                  onChange={(e) => setNombreCategoria(e.target.value)}
                  maxLength={60}
                  autoFocus
                  placeholder="Blusas"
                  onKeyDown={(e) => {
                    // Enter dentro de un formulario lo envía entero. Aquí lo que
                    // se quiere es añadir la categoría, no dar de alta la prenda.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      anadirCategoria();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={anadirCategoria}
                  disabled={pendienteCategoria}
                >
                  {pendienteCategoria ? 'Añadiendo…' : 'Añadir'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0"
                  onClick={cerrarCategoria}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  id="category_id"
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                >
                  <option value="">Sin categoría</option>
                  {listaCategorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => setCreandoCategoria(true)}
                >
                  Nueva
                </Button>
              </div>
            )}

            <FieldError>{errorCategoria ?? undefined}</FieldError>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Colores y tallas"
          subtitle="Cada fila lleva su propio stock"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={agregarFila}>
              <Plus className="size-4" />
              Agregar
            </Button>
          }
        />

        <div className="divide-y divide-borde">
          {filas.map((fila, indice) => (
            <div key={fila.clave} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-tinta-tenue">
                  Variante {indice + 1}
                </span>

                {filas.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => quitarFila(fila.clave)}
                    className="text-tinta-tenue hover:text-rojo"
                    aria-label={`Quitar variante ${indice + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Color</Label>
                  <Input
                    value={fila.color}
                    onChange={(e) => actualizar(fila.clave, 'color', e.target.value)}
                    placeholder="Blanco"
                    maxLength={40}
                  />
                </div>

                <div>
                  <Label>Talla</Label>
                  <Input
                    value={fila.size}
                    onChange={(e) => actualizar(fila.clave, 'size', e.target.value)}
                    placeholder="M"
                    maxLength={30}
                    list="tallas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Precio</Label>
                  <Input
                    value={fila.precio}
                    onChange={(e) => actualizar(fila.clave, 'precio', e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label>Costo</Label>
                  <Input
                    value={fila.costo}
                    onChange={(e) => actualizar(fila.clave, 'costo', e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Cantidad</Label>
                  <Input
                    value={fila.cantidad}
                    onChange={(e) => actualizar(fila.clave, 'cantidad', e.target.value)}
                    type="number"
                    min={0}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <datalist id="tallas">
          {TALLAS_SUGERIDAS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Card>

      <Card className="p-4">
        <SubidorFotos fotos={fotos} onCambio={setFotos} colores={coloresDeLasFilas} />
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Guardar prenda'}
        </Button>
      </div>
    </form>
  );
}
