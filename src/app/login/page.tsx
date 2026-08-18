import Image from 'next/image';
import { LoginForm } from './login-form';

/**
 * Pantalla de acceso con foto de fondo.
 *
 * Dos decisiones deliberadas:
 *
 * · La tarjeta NO sigue el tema claro/oscuro del sistema. Sobre una foto fija,
 *   una tarjeta clara quedaría ilegible en las zonas claras de la imagen; se
 *   fija en oscuro translúcido, que funciona sobre cualquier fondo.
 *
 * · Hay un velo oscuro sobre la foto. Sin él, el texto blanco desaparecería
 *   sobre las prendas naranjas. El velo es más denso abajo y en el centro,
 *   donde está el formulario, y más suave arriba para que la foto se aprecie.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12 md:justify-start md:px-16 lg:px-24"
      // Respaldo en los tonos de la foto. Se ve mientras la imagen carga, y
      // también si el archivo llegara a faltar: la pantalla sigue presentable en
      // vez de quedar en negro.
      style={{
        background: 'linear-gradient(160deg, oklch(42% 0.05 200), oklch(28% 0.04 200))',
      }}
    >
      {/* Fondo ------------------------------------------------------------- */}
      <Image
        src="/login-fondo.jpg"
        alt=""
        fill
        // `priority` porque es lo primero que se ve: sin esto la pantalla
        // aparecería en negro un instante antes de cargar la foto.
        priority
        sizes="100vw"
        className="object-cover object-center"
        // La imagen es decorativa; que no la anuncie un lector de pantalla.
        aria-hidden
      />

      {/* Velo para que el texto se lea sobre cualquier zona de la foto ------ */}
      {/* Dos velos superpuestos.
          · En vertical (celular) oscurece de arriba abajo, porque la tarjeta
            queda centrada sobre la ropa.
          · En pantalla ancha oscurece de izquierda a derecha: el formulario se
            apoya sobre la pared lisa y la ropa se ve limpia a la derecha.
          Si el texto costara leerse, sube los porcentajes; si tapa demasiado la
          foto, bájalos. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-black/55 md:hidden"
      />
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-gradient-to-r from-black/75 via-black/45 to-black/15 md:block"
      />

      {/* Contenido ---------------------------------------------------------- */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">
            Eres Moda
          </h1>
          <p className="mt-1 text-sm text-white/70">Inventario y ventas</p>
        </div>

        {/* `sobre-foto` fija la paleta en oscuro dentro de la tarjeta, para que
            los campos se lean igual en tema claro que en oscuro. */}
        <div className="sobre-foto rounded-caja border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md">
          <LoginForm next={next ?? '/'} />
        </div>
      </div>
    </main>
  );
}
