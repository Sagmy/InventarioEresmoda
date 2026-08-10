import { LoginForm } from './login-form';
import { Card } from '@/components/ui/surfaces';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-tinta">Eresmoda</h1>
          <p className="mt-1 text-sm text-tinta-suave">Inventario y ventas</p>
        </div>

        <Card className="p-6">
          <LoginForm next={next ?? '/'} />
        </Card>
      </div>
    </main>
  );
}
