'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { Alert, Card, CardHeader, EmptyState } from '@/components/ui/surfaces';
import { formatMoney, parseMoneyToCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { crearVentaAction } from '@/features/orders/actions';
import { guardarClienteAction } from '@/features/customers/actions';
import { ETIQUETA_METODO, type MetodoPago } from '@/features/orders/schemas';
import type { Customer, OrderType, Settings, StockRow } from '@/types/database';

interface Linea {
  variant: StockRow;
  qty: number;
  /** Precio efectivo en centavos. Solo editable en ventas de promoción. */
  priceCents: number;
}

interface FilaPago {
  clave: number;
  monto: string;
  metodo: MetodoPago;
  referencia: string;
}

const TIPOS: { valor: OrderType; etiqueta: string; ayuda: string }[] = [
  { valor: 'contado', etiqueta: 'Contado', ayuda: 'Se paga completo y la prenda sale ya' },
  { valor: 'apartado', etiqueta: 'Apartado', ayuda: 'La prenda se separa hasta terminar de pagar' },
  { valor: 'credito', etiqueta: 'Crédito', ayuda: 'La prenda sale ya y queda la deuda' },
];

const METODOS: MetodoPago[] = [
  'efectivo',
  'pago_movil',
  'zelle',
  'transferencia',
  'punto_venta',
  'otro',
];

export function PuntoDeVenta({
  stock,
  clientes,
  ajustes,
}: {
  stock: StockRow[];
  clientes: Customer[];
  ajustes: Settings;
}) {
  const router = useRouter();

  const [tipo, setTipo] = useState<OrderType>('contado');
  const [esPromo, setEsPromo] = useState(false);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagos, setPagos] = useState<FilaPago[]>([
    { clave: 0, monto: '', metodo: 'efectivo', referencia: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  /* ---------------------------------------------------------------------- */
  /* Totales                                                                 */
  /* ---------------------------------------------------------------------- */

  const total = useMemo(
    () => lineas.reduce((suma, l) => suma + l.priceCents * l.qty, 0),
    [lineas],
  );

  const pagado = useMemo(
    () => pagos.reduce((suma, p) => suma + (parseMoneyToCents(p.monto) ?? 0), 0),
    [pagos],
  );

  const minimoRequerido = useMemo(() => {
    if (tipo === 'contado') return total;
    const pct =
      tipo === 'apartado' ? ajustes.layaway_min_deposit_pct : ajustes.credit_min_deposit_pct;
    return Math.ceil((total * Number(pct)) / 100);
  }, [tipo, total, ajustes]);

  const restante = Math.max(0, total - pagado);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q === '') return stock.slice(0, 8);

    return stock
      .filter(
        (s) => s.label.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [busqueda, stock]);

  /* ---------------------------------------------------------------------- */
  /* Carrito                                                                 */
  /* ---------------------------------------------------------------------- */

  function agregar(variant: StockRow) {
    setError(null);

    setLineas((prev) => {
      const existente = prev.find((l) => l.variant.variant_id === variant.variant_id);

      if (existente) {
        // El tope es el DISPONIBLE, no el físico: lo apartado ya está comprometido.
        if (existente.qty >= variant.qty_available) {
          setError(
            `Solo hay ${variant.qty_available} disponible(s) de ${variant.label}. ` +
              (variant.qty_reserved > 0 ? `Hay ${variant.qty_reserved} apartada(s).` : ''),
          );
          return prev;
        }

        return prev.map((l) =>
          l.variant.variant_id === variant.variant_id ? { ...l, qty: l.qty + 1 } : l,
        );
      }

      return [...prev, { variant, qty: 1, priceCents: variant.price_cents }];
    });

    setBusqueda('');
  }

  function cambiarCantidad(variantId: string, delta: number) {
    setError(null);

    setLineas((prev) =>
      prev.flatMap((l) => {
        if (l.variant.variant_id !== variantId) return [l];

        const nueva = l.qty + delta;
        if (nueva <= 0) return [];

        if (nueva > l.variant.qty_available) {
          setError(`Solo hay ${l.variant.qty_available} disponible(s) de ${l.variant.label}.`);
          return [l];
        }

        return [{ ...l, qty: nueva }];
      }),
    );
  }

  function cambiarPrecio(variantId: string, texto: string) {
    const centavos = parseMoneyToCents(texto);
    if (centavos === null) return;

    setLineas((prev) =>
      prev.map((l) => (l.variant.variant_id === variantId ? { ...l, priceCents: centavos } : l)),
    );
  }

  function quitar(variantId: string) {
    setLineas((prev) => prev.filter((l) => l.variant.variant_id !== variantId));
  }

  /* ---------------------------------------------------------------------- */
  /* Cambio de tipo de venta                                                 */
  /* ---------------------------------------------------------------------- */

  function cambiarTipo(nuevo: OrderType) {
    setTipo(nuevo);
    setError(null);

    // Las promociones solo existen al contado: al cambiar de tipo hay que
    // devolver los precios a los de lista o la base rechazaría la venta.
    if (nuevo !== 'contado' && esPromo) {
      setEsPromo(false);
      setLineas((prev) => prev.map((l) => ({ ...l, priceCents: l.variant.price_cents })));
    }
  }

  function alternarPromo() {
    const siguiente = !esPromo;
    setEsPromo(siguiente);

    if (!siguiente) {
      setLineas((prev) => prev.map((l) => ({ ...l, priceCents: l.variant.price_cents })));
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Pagos                                                                   */
  /* ---------------------------------------------------------------------- */

  function actualizarPago(clave: number, campo: keyof FilaPago, valor: string) {
    setPagos((prev) =>
      prev.map((p) => (p.clave === clave ? { ...p, [campo]: valor } : p)),
    );
  }

  function agregarPago() {
    setPagos((prev) => [
      ...prev,
      { clave: Date.now(), monto: '', metodo: 'efectivo', referencia: '' },
    ]);
  }

  function quitarPago(clave: number) {
    setPagos((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.clave !== clave)));
  }

  /* ---------------------------------------------------------------------- */
  /* Envío                                                                   */
  /* ---------------------------------------------------------------------- */

  function confirmar() {
    setError(null);

    if (lineas.length === 0) {
      setError('Agrega al menos una prenda.');
      return;
    }

    if (tipo !== 'contado' && !clienteId) {
      setError('Los apartados y créditos necesitan un cliente.');
      return;
    }

    if (pagado > total) {
      setError(`El pago (${formatMoney(pagado)}) excede el total (${formatMoney(total)}).`);
      return;
    }

    if (tipo === 'contado' && pagado !== total) {
      setError(`Una venta de contado se paga completa: faltan ${formatMoney(restante)}.`);
      return;
    }

    if (pagado < minimoRequerido) {
      setError(
        tipo === 'apartado'
          ? `Para apartar hay que abonar al menos ${formatMoney(minimoRequerido)} (${ajustes.layaway_min_deposit_pct}% del total).`
          : `Este crédito exige un abono inicial de al menos ${formatMoney(minimoRequerido)}.`,
      );
      return;
    }

    const payments = pagos
      .map((p) => ({
        amount_cents: parseMoneyToCents(p.monto) ?? 0,
        method: p.metodo,
        reference: p.referencia.trim() || undefined,
      }))
      .filter((p) => p.amount_cents > 0);

    startTransition(async () => {
      const res = await crearVentaAction({
        type: tipo,
        price_kind: esPromo ? 'promo' : 'normal',
        customer_id: clienteId || null,
        items: lineas.map((l) => ({
          variant_id: l.variant.variant_id,
          qty: l.qty,
          ...(esPromo ? { unit_price_cents: l.priceCents } : {}),
        })),
        payments,
        notes: notas.trim() || undefined,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      const destino =
        tipo === 'apartado' ? '/apartados' : tipo === 'credito' ? '/creditos' : '/ventas';

      router.push(destino);
      router.refresh();
    });
  }

  /* ---------------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <h1 className="text-xl font-bold tracking-tight text-tinta">Nueva venta</h1>

      {/* Tipo de venta ------------------------------------------------------ */}
      <Card className="p-3">
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => cambiarTipo(t.valor)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                tipo === t.valor
                  ? 'border-marca bg-marca-suave text-marca'
                  : 'border-borde text-tinta-suave hover:border-borde-fuerte',
              )}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        <p className="mt-2 text-center text-xs text-tinta-suave">
          {TIPOS.find((t) => t.valor === tipo)?.ayuda}
        </p>
      </Card>

      {/* Buscador de prendas ------------------------------------------------ */}
      <Card>
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-tenue" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar prenda por nombre, color, talla o código…"
              className="pl-9"
              aria-label="Buscar prenda"
            />
          </div>
        </div>

        {resultados.length > 0 ? (
          <ul className="max-h-64 divide-y divide-borde overflow-y-auto border-t border-borde">
            {resultados.map((s) => (
              <li key={s.variant_id}>
                <button
                  type="button"
                  onClick={() => agregar(s)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-lienzo"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-tinta">{s.product_name}</p>
                    <p className="text-xs text-tinta-suave">
                      {s.color} · {s.size}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold text-tinta">
                      {formatMoney(s.price_cents)}
                    </p>
                    <p className="text-xs text-tinta-tenue">
                      {s.qty_available} disp.
                      {s.qty_reserved > 0 ? (
                        <span className="text-ambar"> · {s.qty_reserved} apart.</span>
                      ) : null}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Carrito ------------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Prendas"
          subtitle={lineas.length === 0 ? undefined : `${lineas.length} en la venta`}
          action={
            tipo === 'contado' ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={esPromo}
                  onChange={alternarPromo}
                  className="size-4 rounded border-borde-fuerte"
                />
                <span className={esPromo ? 'font-medium text-marca' : 'text-tinta-suave'}>
                  Promoción
                </span>
              </label>
            ) : undefined
          }
        />

        {lineas.length === 0 ? (
          <EmptyState title="Sin prendas" description="Busca arriba y toca una para agregarla." />
        ) : (
          <ul className="divide-y divide-borde">
            {lineas.map((l) => (
              <li key={l.variant.variant_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-tinta">
                    {l.variant.product_name}
                  </p>
                  <p className="text-xs text-tinta-suave">
                    {l.variant.color} · {l.variant.size}
                  </p>

                  {esPromo ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        value={(l.priceCents / 100).toFixed(2)}
                        onChange={(e) => cambiarPrecio(l.variant.variant_id, e.target.value)}
                        inputMode="decimal"
                        className="h-8 w-24 text-sm"
                        aria-label={`Precio promocional de ${l.variant.label}`}
                      />
                      <span className="text-xs text-tinta-tenue line-through">
                        {formatMoney(l.variant.price_cents)}
                      </span>
                    </div>
                  ) : (
                    <p className="tabular mt-0.5 text-xs text-tinta-suave">
                      {formatMoney(l.priceCents)} c/u
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => cambiarCantidad(l.variant.variant_id, -1)}
                    aria-label="Quitar una"
                  >
                    <Minus className="size-3.5" />
                  </Button>

                  <span className="tabular w-7 text-center text-sm font-semibold">{l.qty}</span>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => cambiarCantidad(l.variant.variant_id, 1)}
                    aria-label="Agregar una"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>

                <p className="tabular w-20 shrink-0 text-right text-sm font-semibold text-tinta">
                  {formatMoney(l.priceCents * l.qty)}
                </p>

                <button
                  type="button"
                  onClick={() => quitar(l.variant.variant_id)}
                  className="text-tinta-tenue hover:text-rojo"
                  aria-label={`Quitar ${l.variant.label}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Cliente ------------------------------------------------------------ */}
      {tipo !== 'contado' ? (
        <SelectorCliente clientes={clientes} valor={clienteId} onCambio={setClienteId} />
      ) : null}

      {/* Pagos -------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title={tipo === 'contado' ? 'Pago' : 'Abono inicial'}
          subtitle={
            tipo === 'apartado'
              ? `Mínimo ${ajustes.layaway_min_deposit_pct}% · ${formatMoney(minimoRequerido)}`
              : tipo === 'credito'
                ? minimoRequerido > 0
                  ? `Mínimo ${formatMoney(minimoRequerido)}`
                  : 'Sin mínimo obligatorio'
                : undefined
          }
          action={
            <Button type="button" variant="ghost" size="sm" onClick={agregarPago}>
              <Plus className="size-4" />
              Otro método
            </Button>
          }
        />

        <div className="space-y-3 p-4">
          {pagos.map((p, indice) => (
            <div key={p.clave} className="flex items-end gap-2">
              <div className="w-28 shrink-0">
                <Label>{indice === 0 ? 'Monto' : ''}</Label>
                <Input
                  value={p.monto}
                  onChange={(e) => actualizarPago(p.clave, 'monto', e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Monto del pago ${indice + 1}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <Label>{indice === 0 ? 'Método' : ''}</Label>
                <Select
                  value={p.metodo}
                  onChange={(e) => actualizarPago(p.clave, 'metodo', e.target.value)}
                  aria-label={`Método del pago ${indice + 1}`}
                >
                  {METODOS.map((m) => (
                    <option key={m} value={m}>
                      {ETIQUETA_METODO[m]}
                    </option>
                  ))}
                </Select>
              </div>

              {pagos.length > 1 ? (
                <button
                  type="button"
                  onClick={() => quitarPago(p.clave)}
                  className="mb-2.5 text-tinta-tenue hover:text-rojo"
                  aria-label={`Quitar pago ${indice + 1}`}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          ))}

          <div>
            <Label htmlFor="notas" hint="opcional">
              Nota
            </Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={2000}
              placeholder="Referencia de la transferencia, acuerdo con el cliente…"
              className="min-h-16"
            />
          </div>
        </div>
      </Card>

      {/* Resumen y confirmación --------------------------------------------- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-tinta-suave">Total</span>
          <span className="tabular text-2xl font-bold text-tinta">{formatMoney(total)}</span>
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className="text-tinta-suave">Se recibe ahora</span>
          <span className="tabular font-semibold text-tinta">{formatMoney(pagado)}</span>
        </div>

        {tipo !== 'contado' && restante > 0 ? (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-tinta-suave">Queda debiendo</span>
            <span className="tabular font-semibold text-ambar">{formatMoney(restante)}</span>
          </div>
        ) : null}

        {tipo === 'apartado' ? (
          <p className="rounded-lg bg-ambar-suave px-3 py-2 text-xs text-ambar">
            La prenda queda <strong>apartada</strong>: no se descuenta del inventario hasta
            terminar de pagarse, pero deja de estar disponible para vender. Plazo de{' '}
            {ajustes.layaway_term_days} días.
          </p>
        ) : null}

        {tipo === 'credito' ? (
          <p className="rounded-lg bg-marca-suave px-3 py-2 text-xs text-marca">
            La prenda <strong>sale ahora</strong> y se descuenta del inventario. La deuda queda
            abierta sin fecha límite; te avisamos a los {ajustes.credit_reminder_days} días.
          </p>
        ) : null}

        {error ? <Alert>{error}</Alert> : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={confirmar}
          disabled={pendiente || lineas.length === 0}
        >
          {pendiente ? 'Registrando…' : 'Confirmar venta'}
        </Button>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Selector de cliente con alta rápida                                         */
/* -------------------------------------------------------------------------- */

function SelectorCliente({
  clientes,
  valor,
  onCambio,
}: {
  clientes: Customer[];
  valor: string;
  onCambio: (id: string) => void;
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function crear(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const res = await guardarClienteAction({
        full_name: String(formData.get('full_name') ?? ''),
        phone: String(formData.get('phone') ?? '') || undefined,
      });

      if (res.ok) {
        onCambio(res.data);
        setCreando(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Cliente"
        subtitle="Necesario para saber a quién cobrarle"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCreando((c) => !c)}
          >
            <UserPlus className="size-4" />
            {creando ? 'Cancelar' : 'Nuevo'}
          </Button>
        }
      />

      <div className="p-4">
        {creando ? (
          <form action={crear} className="space-y-3">
            <div>
              <Label htmlFor="full_name">Nombre</Label>
              <Input id="full_name" name="full_name" required minLength={2} autoFocus />
            </div>

            <div>
              <Label htmlFor="phone" hint="opcional">
                Teléfono
              </Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" />
            </div>

            {error ? <Alert>{error}</Alert> : null}

            <Button type="submit" className="w-full" disabled={pendiente}>
              {pendiente ? 'Guardando…' : 'Guardar y seleccionar'}
            </Button>
          </form>
        ) : (
          <Select
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
            aria-label="Seleccionar cliente"
          >
            <option value="">Selecciona un cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.phone ? ` · ${c.phone}` : ''}
              </option>
            ))}
          </Select>
        )}
      </div>
    </Card>
  );
}
