-- Que el apellido del cliente no salga de la base.
--
-- La pantalla del shopper ya mostraba solo el primer nombre, pero lo recortaba
-- al pintarlo: la base seguía mandando el nombre completo al teléfono. Con eso,
-- el apellido viaja en la respuesta del servidor aunque no se vea, y cualquiera
-- con la pantalla del shopper delante lo puede leer.
--
-- Esconder no es lo mismo que no enviar. Se recorta aquí, que es el único sitio
-- donde recortar significa algo.
--
-- El teléfono sí va entero y a propósito: es para llamar al llegar, que es
-- justo lo que hace falta cuando nadie atiende el timbre. Y como antes, ninguno
-- de los dos se entrega una vez entregado el pedido.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create or replace function public.order_customer(p_order_id uuid)
returns table (full_name text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  -- `split_part` con espacio: "María Pérez" queda en "María". Un nombre de una
  -- sola palabra vuelve igual, y uno vacío sigue vacío en vez de cadena vacía.
  select nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''), p.phone
  from public.orders o
  join public.profiles p on p.id = o.user_id
  where o.id = p_order_id
    and o.shopper_id = (select auth.uid())
    -- Entregado el pedido, el dato deja de hacer falta.
    and o.status in ('confirmado', 'preparando', 'en_camino');
$$;

revoke execute on function public.order_customer(uuid) from public, anon;
grant execute on function public.order_customer(uuid) to authenticated;
