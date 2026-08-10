import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variant, string> = {
  primary:
    'bg-marca text-white hover:bg-marca-fuerte disabled:bg-borde-fuerte disabled:text-tinta-tenue',
  secondary:
    'bg-superficie text-tinta border border-borde-fuerte hover:bg-lienzo disabled:text-tinta-tenue',
  ghost: 'text-tinta-suave hover:bg-lienzo hover:text-tinta',
  danger: 'bg-rojo text-white hover:opacity-90 disabled:bg-borde-fuerte',
};

const TAMANOS: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors disabled:cursor-not-allowed',
        VARIANTES[variant],
        TAMANOS[size],
        className,
      )}
      {...props}
    />
  );
}
