-- Que un admin pueda ver qué se pidió en cualquier pedido.
--
-- La política de renglones se escribió pensando en el shopper: deja ver los de
-- los pedidos sin dueño o propios. Un admin entra por esa misma puerta, así que
-- en cuanto otro shopper tomaba un pedido, dejaba de poder ver qué llevaba.
--
-- Eso es justo lo que hace falta cuando el cliente llama preguntando por su
-- pedido, que es cuando menos se puede decir "no lo puedo ver".
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

drop policy if exists "renglones: admin lee todo" on public.order_items;
create policy "renglones: admin lee todo"
  on public.order_items for select
  using (public.has_role(array['admin', 'dev']));
