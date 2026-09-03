-- Cada producto pertenece a una tienda, así La Cosecha puede tener catálogo
-- propio en vez de decir "Próximamente".
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.products
  add column if not exists store_id text references public.stores (id) on delete cascade;

update public.products set store_id = 'girasol' where store_id is null;

alter table public.products alter column store_id set default 'girasol';
alter table public.products alter column store_id set not null;

create index if not exists products_store_idx on public.products (store_id, active);

-- El pedido se arma contra la tienda de los productos, no siempre Girasol, y
-- las tarifas salen de esa tienda.
create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_substitution text
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

  -- Un pedido es de una sola tienda: el shopper hace un solo recorrido.
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
    substitution_policy, payment_method, subtotal, service_fee, delivery_fee, total
  ) values (
    v_user, v_store, v_address.label, v_address.detail, v_address.lat, v_address.lng,
    p_substitution, p_payment_method, v_subtotal, v_service, v_delivery,
    v_subtotal + v_service + v_delivery
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

revoke execute on function public.place_order(jsonb, uuid, text, text) from public, anon;
grant execute on function public.place_order(jsonb, uuid, text, text) to authenticated;
