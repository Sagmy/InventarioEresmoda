'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Alert, Card, CardHeader } from '@/components/ui/surfaces';
import { parseMoneyToCents } from '@/lib/money';
import { crearProductoAction } from '@/features/inventory/actions';
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

    const categoriaId = String(formData.get('category_id') ?? '');

    startTransition(async () => {
      const res = await crearProductoAction({
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? '') || undefined,
        brand: String(formData.get('brand') ?? '') || undefined,
        category_id: categoriaId || null,
        variants,
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
            <Select id="category_id" name="category_id" defaultValue="">
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
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
