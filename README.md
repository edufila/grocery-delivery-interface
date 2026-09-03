# Abasto

Delivery de víveres para Acarigua y Araure. Varios abastos en una sola app:
el cliente elige el local, arma el pedido y un shopper se lo lleva.

Next.js 16 y Supabase, desplegado en Vercel.

El nombre de la plataforma vive en `lib/brand.ts` y en ningún otro lado.
"Gran Abasto Girasol" es uno de los locales, no la app.

Tres roles sobre la misma app: el **cliente** compra, el **shopper** arma el pedido
y lo entrega, y **admin/dev** administran el catálogo y las cuentas.

## Correr en local

```bash
pnpm install
cp .env.local.example .env.local   # y completá los dos valores
pnpm dev
```

Las claves salen de Supabase → Project Settings → API. La `anon` es pública por
diseño; la `service_role` no va nunca en este archivo ni en el repo.

```bash
pnpm check:supabase   # verifica que la conexión y los proveedores estén bien
pnpm test             # pruebas de la lógica pura
pnpm build            # lo mismo que corre Vercel
```

## La base de datos

El esquema vive en `supabase/migrations/`, numerado. **No hay CLI conectado**:
cada archivo se pega a mano en el SQL editor de Supabase, en orden. Son
idempotentes, así que repetir uno no rompe nada.

| Tabla | Para qué |
|---|---|
| `profiles` | Datos de cada usuario y su **rol** |
| `addresses` | Direcciones con su punto en el mapa |
| `stores` | Los abastos, su foto y su ubicación |
| `products` | Catálogo, ligado a una tienda |
| `orders` / `order_items` | Pedidos y sus renglones |
| `order_delivery_codes` | El código que el cliente le dicta al shopper |
| `order_messages` | Chat de cada pedido |
| `favorites`, `settings` | Favoritos y tarifas |

## Decisiones que conviene entender antes de tocar

**Los precios los calcula la base, no el navegador.** Pedir pasa por la función
`place_order`, que recibe qué productos y cuántos y busca los precios en el
catálogo. Insertar directo en `orders` está revocado. Si el navegador mandara el
total, se podría comprar por un centavo.

**Los pedidos guardan copias, no referencias.** El nombre, la presentación y el
precio de cada producto quedan congelados al comprar, igual que la dirección. Si
mañana sube el café o se borra una dirección, el pedido viejo tiene que seguir
mostrando lo que se pagó y a dónde fue.

**El total estimado y el real conviven.** `total` es lo que se calculó al
confirmar; `final_total` es lo que se cobra después de que el shopper marcó qué
faltaba. La diferencia entre los dos es lo que hay que poder justificar.

**RLS elige filas, no columnas.** Donde hacía falta limitar campos —que nadie se
cambie el rol, que un shopper no toque el total— van permisos por columna
(`grant update (col)`) o funciones `security definer` que verifican quién llama.

**El código de entrega vive en su propia tabla** porque el shopper puede leer su
pedido entero: si estuviera en `orders` lo vería y no probaría nada.

**La dirección es el pin, no el texto.** En Acarigua la gente no maneja nombres
de calles pero sabe cómo llegar. Sin coordenadas no se puede pedir.

## Límites conocidos

- **La web no rastrea en segundo plano.** Si el shopper bloquea el teléfono, el
  navegador suspende el script y la ubicación deja de viajar. No hay forma de
  esquivarlo sin una app nativa.
- **Tiles de mapa y ruteo son servicios públicos de prueba** (OpenStreetMap y
  OSRM). Sirven para probar; con tráfico real hay que contratar un proveedor.
- **No hay notificaciones.** Sin la app abierta, el cliente no se entera de nada.
- **Nadie cobra todavía.** El diseño de pagos está pensado pero sin implementar.
- **Las imágenes no se optimizan** (`unoptimized` en `next.config.mjs`): lo que
  se sube es lo que descarga el cliente. Por eso el panel recorta y comprime
  antes de subir.
