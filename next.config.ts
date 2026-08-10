import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Un error de tipos no debe poder llegar a producción disfrazado de build
  // exitoso. (En Next 16 el lint ya no corre dentro del build: va aparte, con
  // `npm run lint`.)
  typescript: { ignoreBuildErrors: false },

  // La app no sirve contenido público ni embebe nada de terceros: la política
  // más restrictiva posible no cuesta nada aquí y cierra XSS y clickjacking.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
