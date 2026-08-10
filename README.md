# Inventario Eresmoda

Inventario, ventas, apartados y créditos para tienda de ropa.

---

## El problema que resuelve

El stock físico no es el stock vendible. Si hay 5 camisas y 2 están apartadas,
solo se pueden vender 3. Por eso cada prenda lleva **tres números**, no uno:

| | Significado |
|---|---|
| **Físico** | Prendas que están en la tienda |
| **Apartado** | Comprometidas en apartados sin terminar de pagar |
| **Disponible** | `Físico − Apartado` ← lo que realmente se puede vender |

`Disponible` la calcula Postgres, no la aplicación, y hay restricciones en la
base que impiden que `Apartado > Físico`. Ni un error de programación puede
dejar el inventario en un estado imposible.

### Los tres tipos de venta

| Tipo | Efecto en el inventario | Regla |
|---|---|---|
| **Contado** | Sale al instante | Se paga completo |
| **Apartado** | Se reserva; **sale al terminar de pagar** | Mínimo 50% de abono · 20 días · aviso al día 15 |
| **Crédito** | **Sale de una vez**, queda la deuda | Sin abono mínimo · **sin fecha límite** · aviso al día 14 |

Devolver una prenda al stock es **siempre** una decisión manual. El sistema
marca en rojo lo vencido y ahí se detiene: nunca libera nada por su cuenta.

---

## Arquitectura

**Next.js 16 · TypeScript estricto · Supabase (Postgres) · Tailwind 4**

La decisión que sostiene todo lo demás:

> **El navegador nunca escribe directo en una tabla.**

El rol `authenticated` no tiene `INSERT`, `UPDATE` ni `DELETE` sobre ninguna
tabla de negocio. Cada operación pasa por una función `SECURITY DEFINER` de
Postgres que corre dentro de una transacción, bloquea las filas de stock con
`SELECT … FOR UPDATE` y valida las reglas antes de escribir.

Eso es lo que hace **imposible** la sobreventa aunque dos personas registren la
última camisa a la vez: la segunda transacción espera, vuelve a leer el stock ya
actualizado y falla limpio. Un `UPDATE` desde el navegador no puede dar esa
garantía.

Los costos viven en tablas aparte (`variant_costs`, `order_item_costs`) cuya RLS
solo admite administradores. No es que la interfaz los esconda: el dato **no sale
de la base de datos** hacia un vendedor.

```
supabase/migrations/   Esquema, vistas, funciones y RLS (SQL versionado)
supabase/tests/        Tests pgTAP de las reglas de negocio
src/app/(app)/         Pantallas (tablero, ventas, inventario, cobros…)
src/features/          Un módulo por dominio: actions · schemas · components
src/lib/               Supabase, dinero, sesión, utilidades
src/types/database.ts  Tipos del esquema
```

---

## Puesta en marcha

### 1 · Requisitos

Node.js 20 o superior. Si `node -v` no responde, ya quedó instalado en
`~/.local/node` con su ruta en `~/.zshenv`; abre una terminal nueva.

```bash
npm install
```

### 2 · Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto gratuito.
2. Guarda la contraseña de la base de datos que te pida: **no se puede recuperar
   después**.
3. Ve a **Project Settings → API** y copia la *Project URL* y la *anon public key*.

### 3 · Configurar las variables

Edita `.env.local` (ya existe con valores de marcador) y reemplázalos:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Ambos valores salen del botón **Connect** del dashboard, paso *Add files*,
pestaña `.env.local`.

Supabase renombró esta clave: hoy se llama *publishable key*
(`sb_publishable_…`) y antes *anon key* (`eyJ…`). Son la misma y el proyecto
acepta los dos nombres, así que usa el que te dé tu panel.

Está diseñada para viajar al navegador: sin una sesión válida no puede leer ni
escribir nada, porque toda la seguridad la impone Row Level Security del lado del
servidor. **Nunca** pongas aquí la `service_role` (o *secret key*).

### 4 · Aplicar el esquema

```bash
npx supabase init
```

```bash
npx supabase link --project-ref TU-REFERENCIA
```

```bash
npx supabase db push
```

`db push` te pedirá la contraseña de la base de datos del paso 2.

### 5 · Generar los tipos desde el esquema real

```bash
npm run db:types
```

### 6 · Arrancar

```bash
npm run dev
```

Abre `http://localhost:3000`. **La primera cuenta que crees queda como
administrador.** Las siguientes entran como vendedor e inactivas, hasta que un
administrador las habilite desde Ajustes.

---

## Seguridad: revisa esto antes de usarlo en la tienda

- [ ] En **Supabase → Authentication → Providers**, desactiva el registro público
      (*Allow new users to sign up*) una vez creadas las cuentas del equipo. La
      app ya deja inactivas las cuentas nuevas, pero cerrar la puerta es mejor
      que vigilarla.
- [ ] Verifica que `.env.local` **no** esté en el repositorio (`git status`).
- [ ] Confirma que en **Ajustes** la zona horaria sea la de la tienda: define a
      qué hora cierra el día y, mal puesta, descuadra todos los totales diarios.

---

## Comandos

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npx supabase test db
```

Los tests pgTAP necesitan Docker y Supabase local (`npx supabase start`).
Comprueban lo que rompería el negocio: sobreventa, la regla del 50%, que un
apartado liquidado no descuente dos veces, que las promociones solo existan al
contado, y que un vendedor no pueda leer los costos.

---

## Decisiones que conviene conocer

**Todo el dinero se guarda en centavos enteros.** Con decimales flotantes,
`0.1 + 0.2` no da `0.3`, y sumando cien ventas al día la caja deja de cuadrar en
semanas sin que nadie encuentre de dónde salió la diferencia.

**Los precios y costos se congelan en cada línea de venta.** Si mañana subes el
precio de una camisa, los reportes del mes pasado no cambian.

**El método de pago va por pago, no por venta.** Un apartado con tres abonos
puede tener efectivo, Pago Móvil y Zelle; así la caja se puede cuadrar por
método al cierre del día.

**Los reportes son base caja:** el dinero cuenta el día en que se recibe. Es lo
que se puede contrastar contra el efectivo y las transferencias reales.

**`stock_movements` es un libro que solo crece.** Nunca se actualiza ni se
borra, así que siempre se puede responder «¿por qué tengo 3 y no 5?»
reconstruyendo la historia completa de la prenda.
