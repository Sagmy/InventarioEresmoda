import { cn } from '@/lib/utils';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn('rounded-caja border border-borde bg-superficie', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-borde px-4 py-3">
      <div>
        <h2 className="font-semibold text-tinta">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-tinta-suave">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="font-medium text-tinta">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-tinta-suave">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'warn' | 'info';
  children: React.ReactNode;
}) {
  const tonos = {
    error: 'bg-rojo-suave text-rojo border-rojo/25',
    warn: 'bg-ambar-suave text-ambar border-ambar/30',
    info: 'bg-marca-suave text-marca border-marca/25',
  } as const;

  return (
    <div role="alert" className={cn('rounded-lg border px-3 py-2 text-sm', tonos[tone])}>
      {children}
    </div>
  );
}
