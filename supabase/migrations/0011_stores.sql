-- Las tiendas, con su punto en el mapa, y de qué tienda es cada pedido.
--
-- Hacía falta para trazar la ruta del shopper hasta el abasto donde recoge.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create table if not exists public.stores (
  id text primary key,
  name text not null,
  lat double precision,
  lng double precision,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;

drop policy if exists "tiendas: leer" on public.stores;
create policy "tiendas: leer" on public.stores for select using (active);

drop policy if exists "tiendas: administrar" on public.stores;
create policy "tiendas: administrar" on public.stores for all
  using (public.has_role(array['admin', 'dev']))
  with check (public.has_role(array['admin', 'dev']));

-- OJO: estas coordenadas son el centro de Acarigua, puestas para que la ruta
-- tenga de dónde salir. Hay que corregirlas con el punto real del abasto:
--   update public.stores set lat = 9.55xx, lng = -69.20xx where id = 'girasol';
insert into public.stores (id, name, lat, lng) values
  ('girasol', 'Gran Abasto Girasol', 9.5597, -69.2019),
  ('cosecha', 'Mercado La Cosecha', null, null)
on conflict (id) do nothing;

alter table public.orders
  add column if not exists store_id text references public.stores (id);

update public.orders set store_id = 'girasol' where store_id is null;

-- El pedido queda atado a la tienda donde se compra.
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
  c_service constant numeric(12, 2) := 1.99;
  c_delivery constant numeric(12, 2) := 3.50;
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

  select coalesce(sum(pr.price * (item.qty)::int), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  if v_subtotal <= 0 then
    raise exception 'El carrito está vacío o los productos ya no existen';
  end if;

  insert into public.orders (
    user_id, store_id, address_label, address_detail, address_lat, address_lng,
    substitution_policy, payment_method, subtotal, service_fee, delivery_fee, total
  ) values (
    v_user, 'girasol', v_address.label, v_address.detail, v_address.lat, v_address.lng,
    p_substitution, p_payment_method, v_subtotal, c_service, c_delivery,
    v_subtotal + c_service + c_delivery
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
