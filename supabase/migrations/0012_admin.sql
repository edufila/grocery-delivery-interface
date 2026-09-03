-- Todo lo que hoy está escrito en el código y debería poder cambiarse sin
-- desplegar: datos de la tienda, tarifas y la foto del inicio.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.stores add column if not exists image text;
alter table public.stores add column if not exists tag text;
alter table public.stores add column if not exists eta text;
alter table public.stores add column if not exists rating text;
alter table public.stores add column if not exists reviews text;
alter table public.stores add column if not exists delivery_fee numeric(12, 2) not null default 3.50;
alter table public.stores add column if not exists sort_order integer not null default 0;

comment on column public.stores.delivery_fee is
  'En dólares, igual que los precios del catálogo. Antes la tarjeta del inicio decía Bs. y el pedido cobraba en $: eran dos números distintos.';

update public.stores set
  image = coalesce(image, '/images/store-girasol.png'),
  tag = coalesce(tag, 'Ahorro Mayorista'),
  eta = coalesce(eta, '35-45 min'),
  rating = coalesce(rating, '4.8'),
  reviews = coalesce(reviews, '2.4k'),
  sort_order = 0
where id = 'girasol';

update public.stores set
  image = coalesce(image, '/images/store-cosecha.png'),
  tag = coalesce(tag, 'Frescos del día'),
  eta = coalesce(eta, '25-35 min'),
  rating = coalesce(rating, '4.6'),
  reviews = coalesce(reviews, '1.1k'),
  sort_order = 1
where id = 'cosecha';

-- ---------------------------------------------------------------- ajustes

create table if not exists public.settings (
  id text primary key,
  service_fee numeric(12, 2) not null default 1.99,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values ('global') on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "ajustes: leer" on public.settings;
create policy "ajustes: leer" on public.settings for select using (true);

drop policy if exists "ajustes: administrar" on public.settings;
create policy "ajustes: administrar" on public.settings for all
  using (public.has_role(array['admin', 'dev']))
  with check (public.has_role(array['admin', 'dev']));

-- --------------------------------------------------- borrar pedidos de prueba

drop policy if exists "pedidos: admin borra" on public.orders;
create policy "pedidos: admin borra"
  on public.orders for delete
  using (public.has_role(array['admin', 'dev']));

drop policy if exists "pedidos: admin lee todo" on public.orders;
create policy "pedidos: admin lee todo"
  on public.orders for select
  using (public.has_role(array['admin', 'dev']));

-- ------------------------------------------------ tarifas desde la base

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

  -- Las tarifas ya no son constantes del código.
  select service_fee into v_service from public.settings where id = 'global';
  select delivery_fee into v_delivery from public.stores where id = 'girasol';
  v_service := coalesce(v_service, 1.99);
  v_delivery := coalesce(v_delivery, 3.50);

  insert into public.orders (
    user_id, store_id, address_label, address_detail, address_lat, address_lng,
    substitution_policy, payment_method, subtotal, service_fee, delivery_fee, total
  ) values (
    v_user, 'girasol', v_address.label, v_address.detail, v_address.lat, v_address.lng,
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
