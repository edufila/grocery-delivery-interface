-- Limita QUÉ columnas puede escribir un usuario logueado en orders.
--
-- RLS decide a qué filas llega, no qué campos toca. Sin esto, la política
-- "shoppers: tomar y avanzar" permitía que en el mismo update se cambiara el
-- total, las tarifas o el user_id del pedido, mientras quedara a su nombre.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

revoke update on public.orders from authenticated;

grant update (
  status,
  shopper_id,
  shopper_lat,
  shopper_lng,
  shopper_located_at
) on public.orders to authenticated;

-- Los renglones nunca se editan después de creados: se insertan con el pedido
-- y quedan como registro de lo que se compró.
revoke update on public.order_items from authenticated;

-- El cliente puede cancelar su pedido mientras nadie lo haya tomado. Cancelar
-- y no borrar: el pedido queda como registro de que existió.
drop policy if exists "pedidos propios: cancelar" on public.orders;
create policy "pedidos propios: cancelar"
  on public.orders for update
  using (
    (select auth.uid()) = user_id
    and status = 'confirmado'
    and shopper_id is null
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'cancelado'
  );
