# Cómo se trabaja en este proyecto

Abasto es una app de delivery de víveres para Acarigua y Araure. Varios abastos
en una sola app: el cliente elige el local, arma el pedido y un shopper se lo
lleva.

La construyen dos hermanos. El repo es de `edufila`, el Supabase también, y el
proyecto de Vercel igual — que hoy sirve en **abastoweb.vercel.app**.

## Antes de tocar nada

**Traer lo último**: `git pull`. Trabajan dos personas sobre el mismo repo.

**El dominio no se escribe a mano en ningún lado.** Ya cambió una vez y dejó
rastros rotos. Sale de `lib/brand.ts`, que lo lee de las variables de Vercel.

## Cómo se habla

Español neutro, de tú. Nada de voseo: ni "vos", ni "tenés", ni "escribilo", ni
"pedile". Aparece cada tanto porque la plantilla original venía así — si ves
uno, se corrige.

Los textos son para gente que compra en un abasto, no para programadores.
"Dirección", no "cómo reconocer la casa".

## Móvil primero, sin excepciones

Se usa desde el teléfono, en la calle, con datos móviles. Área táctil mínima de
44 píxeles, respetar `env(safe-area-inset-*)`, y medir el peso de lo que se
manda al navegador antes de sumar una librería.

## La base de datos

El esquema vive en `supabase/migrations/`, numerado. **No hay CLI conectado**:
cada archivo se pega a mano en el SQL editor de Supabase. Son idempotentes.

Eso tiene una consecuencia que ya rompió cosas dos veces: **el código se
despliega solo al hacer push, las migraciones no.** Entre una cosa y la otra hay
un rato en el que la columna nueva no existe, y PostgREST rechaza la consulta
ENTERA, no solo esa columna. Toda consulta que pida una columna recién agregada
tiene que reintentar sin ella. Ver `fetchProducts` y `fetchMetodosPago`.

## Medir contra la base, no leer el SQL

Dos veces el archivo decía una cosa y la base tenía otra: `deliver_order` quedó
abierta a anónimos aunque su migración la revocaba, y una migración de permisos
por columna no cerró nada porque el rol tenía permiso sobre la tabla entera.

Después de cada migración que cree funciones, tablas o columnas:

```bash
pnpm audit:funciones   # qué puede invocar alguien sin sesión
pnpm audit:tablas      # qué puede leer y escribir sin sesión
pnpm build && pnpm audit:bundle   # qué claves viajan al navegador
pnpm check:supabase    # conexión, proveedores de login, contenido
```

Supabase concede `execute` a `anon` por defecto en cada función nueva. Toda
función que no revoque después queda abierta al mundo.

## Sobre las claves

La clave publicable de Supabase **viaja al navegador y está bien**: se ve con
Inspeccionar y no hay forma de esconderla. Lo que protege los datos son las
políticas de RLS, no el secreto de esa clave.

La `service_role` no va nunca al repo, ni a `.env.local`, ni con prefijo
`NEXT_PUBLIC_`. Solo en variables de servidor de Vercel.

## Reglas que ya se decidieron

**Los precios los pone la base, no el cliente.** `place_order` recibe qué y
cuánto, y calcula el total contra el catálogo. Si viajara desde el navegador se
podría adulterar.

**Un pedido es de un solo abasto.** El shopper hace un recorrido. Al entrar a
otro local con carrito armado se pregunta qué hacer con él.

**El pin del mapa es obligatorio en las direcciones.** Aquí la gente no maneja
nombres de calles pero sí sabe llegar. Sin punto no hay a dónde entregar.

**Nada de reseñas ni calificaciones.** Se quitaron: un abasto vende productos
sellados de marca, no hay qué puntuar, y los números que traía la plantilla eran
inventados.

**Un método de pago solo se ofrece si se puede cumplir**: activo, con datos
cargados, y con tasa del día si cobra en bolívares.

**Cada pedido en bolívares lleva céntimos únicos**, para poder reconocer el pago
por el monto sin depender de que el cliente copie bien una referencia.

**admin y dev no son lo mismo.** Un admin maneja el abasto entero; solo un dev
reparte los roles de admin y dev, y un admin no puede tocarle el rol a otro
admin.

## Lo que está trabado y por qué

Los cobros esperan cuatro decisiones del negocio, empezando por si hay empresa
registrada. Sin RIF no hay C2P, ni botón de pago, ni tarjetas. Mientras tanto se
prueba con una cuenta personal y conciliación semiautomática: el abasto registra
el pago que ve en su banco y el pedido se verifica solo.

Las notificaciones con la app cerrada necesitan push, que necesita servidor. Hoy
los avisos suenan solo con la pantalla abierta.
