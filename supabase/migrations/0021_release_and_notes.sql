-- Salidas para cuando la compra no se puede hacer, y una nota del cliente.
--
-- El shopper que tomaba un pedido quedaba atrapado: si el abasto estaba
-- cerrado o no había nada, no podía soltarlo ni cancelarlo, y el pedido se
-- quedaba en su panel para siempre.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.orders add column if not exists customer_note text;
alter table public.orders add column if not exists cancel_reason text;

comment on column public.orders.customer_note is
  'Indicaciones del cliente para la entrega: timbre, referencia, a quién preguntar.';

-- Soltarlo: vuelve a la lista de disponibles para otro shopper.
create or replace function public.shopper_release_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set shopper_id = null,
      status = 'confirmado',
      shopper_lat = null,
      shopper_lng = null,
      shopper_located_at = null
  where id = p_order_id
    and shopper_id = (select auth.uid())
    -- Ya en camino no se suelta: la mercadería está comprada.
    and status in ('confirmado', 'preparando');

  return found;
end;
$$;

-- Cancelarlo con motivo, cuando directamente no se puede cumplir.
create or replace function public.shopper_cancel_order(p_order_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Escribí el motivo, lo va a leer el cliente';
  end if;

  update public.orders
  set status = 'cancelado',
      cancel_reason = trim(p_reason)
  where id = p_order_id
    and shopper_id = (select auth.uid())
    and status in ('confirmado', 'preparando', 'en_camino');

  return found;
end;
$$;

revoke execute on function public.shopper_release_order(uuid) from public, anon;
revoke execute on function public.shopper_cancel_order(uuid, text) from public, anon;
grant execute on function public.shopper_release_order(uuid) to authenticated;
grant execute on function public.shopper_cancel_order(uuid, text) to authenticated;

-- La nota viaja con el pedido.
create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_substitution text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_address public.addresses%rowtype;
  v_order_id uuid;
  v_code text;
  v_subtotal numeric(12, 2) := 0;
  v_service numeric(12, 2);
  v_delivery numeric(12, 2);
  v_store text;
  v_tiendas int;
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para pedir';
  end if;

  select * into v_address
  from public.addresses
  where id = p_address_id and user_id = v_user;

  if not found then
    raise exception 'Esa dirección no es tuya';
  end if;

  if v_address.lat is null or v_address.lng is null then
    raise exception 'Esa dirección no tiene el punto marcado en el mapa';
  end if;

  select count(distinct pr.store_id), min(pr.store_id)
  into v_tiendas, v_store
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  if v_tiendas = 0 then
    raise exception 'El carrito está vacío o los productos ya no existen';
  end if;

  if v_tiendas > 1 then
    raise exception 'No se puede pedir de dos abastos en el mismo pedido';
  end if;

  select coalesce(sum(pr.price * (item.qty)::int), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  select service_fee into v_service from public.settings where id = 'global';
  select delivery_fee into v_delivery from public.stores where id = v_store;
  v_service := coalesce(v_service, 1.99);
  v_delivery := coalesce(v_delivery, 3.50);

  insert into public.orders (
    user_id, store_id, address_label, address_detail, address_lat, address_lng,
    customer_note, substitution_policy, payment_method,
    subtotal, service_fee, delivery_fee, total
  ) values (
    v_user, v_store, v_address.label, v_address.detail, v_address.lat, v_address.lng,
    nullif(trim(coalesce(p_note, '')), ''), p_substitution, p_payment_method,
    v_subtotal, v_service, v_delivery, v_subtotal + v_service + v_delivery
  )
  returning id, code into v_order_id, v_code;

  insert into public.order_items (order_id, product_id, name, unit, unit_price, qty)
  select v_order_id, pr.id, pr.name, pr.unit, pr.price, (item.qty)::int
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  return v_code;
end;
$$;

-- La versión de cuatro argumentos ya no se usa.
drop function if exists public.place_order(jsonb, uuid, text, text);

revoke execute on function public.place_order(jsonb, uuid, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, uuid, text, text, text) to authenticated;
