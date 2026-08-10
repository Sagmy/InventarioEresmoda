import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const BASE =
  'w-full rounded-lg border border-borde-fuerte bg-superficie px-3 py-2 text-sm text-tinta ' +
  'placeholder:text-tinta-tenue focus:border-marca focus:outline-none focus:ring-1 focus:ring-marca ' +
  'disabled:bg-lienzo disabled:text-tinta-tenue';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(BASE, 'h-10', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(BASE, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(BASE, 'min-h-20 resize-y', className)} {...props} />;
}

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string | undefined;
  hint?: string | undefined;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-tinta">
      {children}
      {hint ? <span className="ml-2 font-normal text-tinta-tenue">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: string | undefined }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-rojo">
      {children}
    </p>
  );
}
