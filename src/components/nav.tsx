'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Bookmark,
  CreditCard,
  BellRing,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Item {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** Aparece en la barra inferior del celular. */
  principal?: boolean;
}

const ITEMS: Item[] = [
  { href: '/', label: 'Tablero', icon: LayoutDashboard, principal: true },
  { href: '/ventas', label: 'Vender', icon: ShoppingCart, principal: true },
  { href: '/inventario', label: 'Inventario', icon: Package, principal: true },
  { href: '/apartados', label: 'Apartados', icon: Bookmark },
  { href: '/creditos', label: 'Créditos', icon: CreditCard },
  { href: '/cobros', label: 'Cobros', icon: BellRing, principal: true },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, adminOnly: true },
  { href: '/ajustes', label: 'Ajustes', icon: Settings, adminOnly: true },
];

function estaActivo(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Sidebar({ isAdmin, pendingCount }: { isAdmin: boolean; pendingCount: number }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav className="hidden w-56 shrink-0 border-r border-borde bg-superficie md:block">
      <ul className="space-y-0.5 p-3">
        {items.map((item) => {
          const activo = estaActivo(pathname, item.href);
          const Icono = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  activo
                    ? 'bg-marca-suave text-marca'
                    : 'text-tinta-suave hover:bg-lienzo hover:text-tinta',
                )}
              >
                <Icono className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>

                {item.href === '/cobros' && pendingCount > 0 ? (
                  <span className="rounded-full bg-ambar px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.principal);

  return (
    /* `env(safe-area-inset-bottom)` deja hueco para la barra del gesto de inicio
       del iPhone. Sin eso, los botones de la barra inferior quedan justo debajo
       de ella y cuesta acertarles con el dedo. En equipos sin esa barra el
       valor es cero y no cambia nada. */
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const activo = estaActivo(pathname, item.href);
          const Icono = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium',
                  activo ? 'text-marca' : 'text-tinta-tenue',
                )}
              >
                <Icono className="size-5" />
                {item.label}

                {item.href === '/cobros' && pendingCount > 0 ? (
                  <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-ambar px-1.5 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
