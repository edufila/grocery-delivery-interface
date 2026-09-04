-- Cerrar las funciones que quedaron abiertas a quien no ha iniciado sesión.
--
-- Supabase concede EXECUTE a `anon` por defecto en toda función nueva del
-- esquema public. Cada `create function` que no revoque después queda abierta,
-- y una auditoría contra la base encontró tres así:
--
--   conciliar_pedido       la dejé abierta yo. Es security definer, o sea que
--                          se salta RLS: cualquiera con un id de pedido podía
--                          disparar la conciliación de un pago ajeno.
--   referencias_coinciden  pura, no lee nada. Inofensiva, pero no hay razón
--                          para exponerla.
--   deliver_order          revocada en 0008 y aun así abierta en la base. No
--                          era explotable -- lo primero que hace es exigir que
--                          quien llama sea el shopper asignado, y sin sesión
--                          auth.uid() es null, así que siempre respondía
--                          "no_corresponde" -- pero no tiene por qué estar
--                          al alcance de nadie.
--
-- conciliar_pedido se cierra también para los que SÍ iniciaron sesión: es un
-- auxiliar interno. La llama report_payment, que es security definer y corre
-- como su dueño, así que no necesita permiso concedido a nadie más.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

revoke execute on function public.conciliar_pedido(uuid) from public, anon, authenticated;
revoke execute on function public.referencias_coinciden(text, text) from public, anon;
revoke execute on function public.deliver_order(uuid, text) from public, anon;
revoke execute on function public.reset_delivery_code(uuid) from public, anon;

-- Y se reafirma quién sí tiene que poder llamarlas.
grant execute on function public.deliver_order(uuid, text) to authenticated;
grant execute on function public.reset_delivery_code(uuid) to authenticated;
