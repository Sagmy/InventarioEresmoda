'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Mantiene la pantalla al día sin recargar.
 *
 * Escucha los cambios de stock, ventas y pagos, y le pide a Next que vuelva a
 * renderizar en el servidor. Así, si alguien vende la última camisa desde el
 * celular, la computadora del mostrador deja de ofrecerla en segundos.
 *
 * Realtime respeta Row Level Security: cada quien solo recibe eventos de las
 * filas que tendría derecho a consultar. Por eso solo se publican tablas sin
 * información de costos.
 *
 * Los avisos se agrupan en una ventana corta: una venta de cinco prendas
 * dispara varios eventos casi a la vez y no tiene sentido re-renderizar cinco
 * veces seguidas.
 */
export function RealtimeRefresher() {
  const router = useRouter();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const refrescarAgrupado = () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => router.refresh(), 400);
    };

    const canal = supabase
      .channel('cambios-tienda')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants' },
        refrescarAgrupado,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refrescarAgrupado)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        refrescarAgrupado,
      )
      .subscribe();

    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      void supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
