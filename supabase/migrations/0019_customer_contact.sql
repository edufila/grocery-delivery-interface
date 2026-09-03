-- El shopper necesita saber a quién le entrega.
--
-- Llegaba a la puerta sin nombre ni teléfono del cliente: si no atiende, no
-- tiene forma de avisar. Va por función y no por política de lectura, para no
-- exponerle la fila entera del perfil.
--
-- Correr en Supabase → SQL Editor. Es idempotente.

create or replace function public.order_customer(p_order_id uuid)
returns table (full_name text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.phone
  from public.orders o
  join public.profiles p on p.id = o.user_id
  where o.id = p_order_id
    and o.shopper_id = (select auth.uid())
    -- Entregado el pedido, el dato deja de hacer falta.
    and o.status in ('confirmado', 'preparando', 'en_camino');
$$;

revoke execute on function public.order_customer(uuid) from public, anon;
grant execute on function public.order_customer(uuid) to authenticated;
