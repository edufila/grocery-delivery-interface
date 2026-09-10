-- Lo mismo que la 0042, pero para el otro lado.
--
-- La 0042 dejó de mandarle al shopper el apellido del cliente. Al revés pasaba
-- igual: el cliente recibía el nombre completo de su shopper.
--
-- La pantalla ya muestra el nombre junto al @, que es la identidad que le
-- asigna el abasto y que el shopper no puede cambiarse. Para saber quién toca
-- la puerta, con el primer nombre, la foto y el @ alcanza y sobra. El apellido
-- no agrega nada y sí permite buscar a esa persona fuera de aquí.
--
-- Un shopper reparte a decenas de casas por semana. No eligió publicarle su
-- apellido a cada una.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create or replace function public.order_shopper(p_order_id uuid)
returns table (full_name text, avatar_url text, handle text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''),
    p.avatar_url,
    p.handle
  from public.orders o
  join public.profiles p on p.id = o.shopper_id
  where o.id = p_order_id
    and o.user_id = (select auth.uid());
$$;

revoke execute on function public.order_shopper(uuid) from public, anon;
grant execute on function public.order_shopper(uuid) to authenticated;
