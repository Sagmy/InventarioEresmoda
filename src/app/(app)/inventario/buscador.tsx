'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const FILTROS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'agotado', etiqueta: 'Agotadas' },
  { valor: 'bajo', etiqueta: 'Poco stock' },
  { valor: 'apartado', etiqueta: 'Con apartados' },
] as const;

export function BuscadorInventario({
  valorInicial,
  filtroActivo,
}: {
  valorInicial: string;
  filtroActivo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(valorInicial);
  const [, startTransition] = useTransition();

  // Se espera a que deje de escribir: buscar en cada tecla dispararía una
  // consulta por letra y en el mostrador eso se siente lento, no rápido.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (texto.trim()) params.set('q', texto.trim());
      else params.delete('q');

      startTransition(() => router.replace(`/inventario?${params.toString()}`));
    }, 250);

    return () => clearTimeout(t);
    // `searchParams` cambia de identidad en cada render; incluirlo reiniciaría
    // el temporizador sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function cambiarFiltro(valor: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (valor) params.set('filtro', valor);
    else params.delete('filtro');

    startTransition(() => router.replace(`/inventario?${params.toString()}`));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-tenue" />
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por prenda, color, talla o código…"
          className="pl-9"
          type="search"
          aria-label="Buscar en el inventario"
        />
      </div>

      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => cambiarFiltro(f.valor)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filtroActivo === f.valor
                ? 'border-marca bg-marca-suave text-marca'
                : 'border-borde text-tinta-suave hover:border-borde-fuerte',
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
