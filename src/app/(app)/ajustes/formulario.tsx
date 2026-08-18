'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Alert, Card, CardHeader } from '@/components/ui/surfaces';
import { guardarAjustesAction } from '@/features/settings/actions';
import { ZONAS_HORARIAS } from '@/features/settings/zonas';
import type { Settings } from '@/types/database';

export function FormularioAjustes({ ajustes }: { ajustes: Settings }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  // Una zona guardada que no esté en la lista (puesta a mano antes, o retirada
  // de la lista después) se añade tal cual: si no, el desplegable mostraría otra
  // y el primer guardado le cambiaría el cierre del día a la tienda sin avisar.
  const zonas = ZONAS_HORARIAS.some((z) => z.valor === ajustes.timezone)
    ? ZONAS_HORARIAS
    : [{ valor: ajustes.timezone, etiqueta: ajustes.timezone }, ...ZONAS_HORARIAS];

  function enviar(formData: FormData) {
    setError(null);
    setGuardado(false);

    const num = (campo: string) => {
      const v = String(formData.get(campo) ?? '').trim();
      return v === '' ? null : Number(v);
    };

    startTransition(async () => {
      const res = await guardarAjustesAction({
        timezone: String(formData.get('timezone') ?? '') || undefined,
        layaway_min_deposit_pct: num('layaway_min_deposit_pct'),
        layaway_term_days: num('layaway_term_days'),
        layaway_reminder_days: num('layaway_reminder_days'),
        credit_min_deposit_pct: num('credit_min_deposit_pct'),
        credit_reminder_days: num('credit_reminder_days'),
        low_stock_threshold: num('low_stock_threshold'),
      });

      if (res.ok) {
        setGuardado(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form action={enviar} className="space-y-4">
      <Card>
        <CardHeader title="Tienda" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="timezone" hint="cierre de caja">
              Zona horaria
            </Label>
            <Select id="timezone" name="timezone" defaultValue={ajustes.timezone}>
              {zonas.map((z) => (
                <option key={z.valor} value={z.valor}>
                  {z.etiqueta}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-tinta-tenue">
              Marca a qué hora cierra el día de la tienda. De ella dependen los reportes de caja,
              el filtro «solo hoy» del historial y el vencimiento de los apartados.
            </p>
          </div>

          <div>
            <Label htmlFor="low_stock_threshold">Aviso de poco stock</Label>
            <Input
              id="low_stock_threshold"
              name="low_stock_threshold"
              type="number"
              min={0}
              defaultValue={ajustes.low_stock_threshold}
            />
            <p className="mt-1 text-xs text-tinta-tenue">
              Se avisa cuando el disponible baje a este número o menos.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Apartados" subtitle="La prenda se separa pero no sale del inventario" />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="layaway_min_deposit_pct">Abono mínimo %</Label>
            <Input
              id="layaway_min_deposit_pct"
              name="layaway_min_deposit_pct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={ajustes.layaway_min_deposit_pct}
            />
          </div>

          <div>
            <Label htmlFor="layaway_term_days">Plazo (días)</Label>
            <Input
              id="layaway_term_days"
              name="layaway_term_days"
              type="number"
              min={1}
              defaultValue={ajustes.layaway_term_days}
            />
          </div>

          <div>
            <Label htmlFor="layaway_reminder_days">Aviso al día</Label>
            <Input
              id="layaway_reminder_days"
              name="layaway_reminder_days"
              type="number"
              min={1}
              defaultValue={ajustes.layaway_reminder_days}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Créditos"
          subtitle="La prenda sale ya. La deuda no tiene fecha límite."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="credit_min_deposit_pct">Abono inicial mínimo %</Label>
            <Input
              id="credit_min_deposit_pct"
              name="credit_min_deposit_pct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={ajustes.credit_min_deposit_pct}
            />
            <p className="mt-1 text-xs text-tinta-tenue">En 0 no se exige entrada.</p>
          </div>

          <div>
            <Label htmlFor="credit_reminder_days">Aviso al día</Label>
            <Input
              id="credit_reminder_days"
              name="credit_reminder_days"
              type="number"
              min={1}
              defaultValue={ajustes.credit_reminder_days}
            />
          </div>
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}
      {guardado ? <Alert tone="info">Ajustes guardados.</Alert> : null}

      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar ajustes'}
      </Button>
    </form>
  );
}
