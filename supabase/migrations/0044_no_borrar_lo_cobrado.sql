-- Que no se pueda borrar un pedido que ya movió dinero.
--
-- La política de borrado decía "si eres admin o dev, adelante". La pantalla del
-- panel dice que las casillas son para borrar los de prueba, y esa frase era lo
-- único que lo impedía.
--
-- Basta un toque mal dado en una lista de veinte para borrar un pedido cobrado.
-- Y se va con todo: los renglones, el código de entrega, el registro de que ese
-- cliente pagó. El pago recibido queda huérfano -- la referencia sigue en
-- `payments_received` pero apuntando a nada -- así que el dinero entró y no hay
-- contra qué cruzarlo. Eso no se deshace con un botón.
--
-- Lo que queda protegido:
--
--   pagado      alguien puso dinero, aunque todavía no esté verificado.
--   entregado   la mercancía salió; el pedido es el comprobante.
--
-- Lo que se sigue pudiendo borrar es exactamente lo que se quería borrar: los
-- de prueba, que ni se pagaron ni se entregaron, y los cancelados.
--
-- Se hace aquí y no en la pantalla porque la pantalla se puede saltar. Un
-- borrado que no debía pasar es de los pocos errores que no tienen arreglo.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

drop policy if exists "pedidos: admin borra" on public.orders;
create policy "pedidos: admin borra"
  on public.orders for delete
  using (
    public.has_role(array['admin', 'dev'])
    and status <> 'entregado'
    and payment_reported_at is null
    and payment_verified_at is null
  );
