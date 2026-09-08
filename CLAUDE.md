# Cómo se trabaja en este proyecto

Abasto es una app de delivery de víveres para Acarigua y Araure. Varios abastos
en una sola app: el cliente elige el local, arma el pedido y un shopper se lo
lleva.

La construyen dos hermanos. El repo es de `edufila`, el Supabase también, y el
proyecto de Vercel igual — que hoy sirve en **abastoweb.vercel.app**.

## Lo primero de cada sesión, sin excepción

```bash
node scripts/al-dia.mjs
```

Dice si esta copia está al día con GitHub y qué hacer si no. **Si sale con
error, no edites nada todavía.** Somos cuatro tocando el mismo repo -- dos
hermanos y el Claude de cada uno -- y nadie arranca sabiendo qué hizo el otro
hace media hora.

Se invoca con `node` y no con `pnpm al-dia` -- que también sirve -- porque
`pnpm` no está instalado en todas las máquinas del proyecto, y un primer paso
que falla por eso es un primer paso que nadie vuelve a correr. Da igual desde
qué carpeta se llame: mira el repo donde vive el script, no donde estés parado.

Al terminar algo, subirlo: `git add -A && git commit && git push`. Trabajo que
se queda sin subir es trabajo que el otro va a pisar sin saber.

### Lo que nunca se hace en este repo

| No | Por qué |
|---|---|
| `git push --force` | borra del servidor lo que hizo el otro, sin aviso |
| `git reset --hard` | tira cambios que quizá no son tuyos |
| `git checkout .` | lo mismo, y más silencioso todavía |
| deshacer un commit ajeno | si algo del otro parece mal, se pregunta primero |
| bajar el ZIP de GitHub encima de la carpeta | un ZIP es una foto vieja: revierte todo lo que no estaba en ella |

Ese último es el que ya mordió. **La carpeta se clona, no se descarga.** Si
el comando dice que esto no es un repositorio de git, es exactamente eso lo
que pasó, y el script explica cómo salir.

Cuando el push rebota porque las dos copias se separaron, la salida es
`git pull --rebase` y volver a empujar. Si el rebase se traba, **para y
pregunta**: trabarse cuesta minutos, forzar cuesta el trabajo de alguien.

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

**Con una excepción que ya mordió**: una función que se usa DENTRO de una
política de RLS tiene que poder ejecutarla todo rol al que la política le
aplique, `anon` incluido. La política se evalúa con el rol de quien consulta, no
con el del dueño de la tabla, así que revocarla no cierra nada -- la tabla ya
está cerrada por la política misma -- y en cambio convierte el bloqueo limpio en
un `permission denied for function ...` que además dice el nombre. Pasó con
`pago_resuelto` en la 0037 y lo arregló la 0038.

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

**El pedido no sale a buscar shopper hasta que el pago esté confirmado.** Lo
imponen las políticas de RLS de la 0037, no la pantalla: un shopper no ve el
pedido, ni sus renglones, mientras `payment_required` sea verdadero y
`payment_verified_at` esté vacío. El efectivo contra entrega no espera nada.

**Al cliente se le pide la referencia y nada más.** El monto lo pone el sistema.
Un monto escrito a mano se puede equivocar -- o inflar -- y perdería el sentido
de los céntimos únicos.

**admin y dev no son lo mismo.** Un admin maneja el abasto entero; solo un dev
reparte los roles de admin y dev, y un admin no puede tocarle el rol a otro
admin.

## Lo que está trabado y por qué

Los cobros esperan cuatro decisiones del negocio, empezando por si hay empresa
registrada. Sin RIF no hay C2P, ni botón de pago, ni tarjetas. Mientras tanto se
prueba con una cuenta personal y conciliación semiautomática: el abasto registra
el pago que ve en su banco y el pedido se verifica solo.

Las notificaciones con la app cerrada ya están escritas (`lib/push-servidor.ts`,
`lib/push-cliente.ts`, `/api/avisar`) y la base ya está lista, pero no salen
hasta que en Vercel estén **cuatro** variables: las tres que imprime
`node scripts/generar-vapid.mjs` más `SUPABASE_SERVICE_ROLE_KEY`, que es la que
permite buscar los teléfonos de admin y dev -- por definición no son los de quien
está pidiendo, así que la sesión no alcanza. El proyecto de Vercel es de Edu.

Y después hay que volver a desplegar: las variables no entran en un despliegue
que ya se hizo.

Para saber qué falta sin adivinar, sin exponer nada:

```bash
curl -X POST https://abastoweb.vercel.app/api/avisar   -H "Content-Type: application/json" -d '{"motivo":"pago-reportado"}'
```

`Faltan las claves VAPID` → falta alguna del script. `Falta la llave de
servicio` → falta la de Supabase. **`Hace falta sesión` → están las cuatro**;
eso no es un error, es la ruta lista rechazando a quien llama sin sesión.

Mientras tanto los avisos suenan solo con la app abierta o en segundo plano, que
no es lo mismo que cerrada: en segundo plano la app sigue viva y mantiene la
conexión con Supabase, y por eso el aviso llega igual. Deja de llegar cuando el
sistema mata la app, y gasta batería mientras tanto.

En iPhone el push necesita que la app esté agregada a la pantalla de inicio. En
una pestaña de Safari no llega nada, y el interruptor lo dice en pantalla en vez
de dejar a alguien confiando en un aviso que no va a existir.
