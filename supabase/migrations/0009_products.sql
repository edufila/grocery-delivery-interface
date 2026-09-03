-- Catálogo en la base y precios calculados del lado del servidor.
--
-- Hasta ahora los productos vivían en un archivo del repo y el navegador
-- mandaba el total del pedido, que la base aceptaba tal cual: con la consola
-- abierta se podía comprar por un centavo. Ahora el precio sale de acá.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create table if not exists public.products (
  id text primary key,
  name text not null,
  unit text not null,
  price numeric(12, 2) not null check (price >= 0),
  image text not null,
  category text not null,
  wholesale boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- El catálogo es público: se ve sin haber entrado.
drop policy if exists "catalogo: leer" on public.products;
create policy "catalogo: leer"
  on public.products for select
  using (active);

-- Escribir es solo para admin y dev. Un cliente no cambia precios.
drop policy if exists "catalogo: administrar" on public.products;
create policy "catalogo: administrar"
  on public.products for all
  using (public.has_role(array['admin', 'dev']))
  with check (public.has_role(array['admin', 'dev']));

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

-- Los ocho que ya estaban en el código.
insert into public.products (id, name, unit, price, image, category, wholesale) values
  ('harina-pan', 'Harina de Maíz PAN', 'Bulto de 12 · 1 kg c/u', 24.50, '/products/harina-pan.png', 'Harinas', true),
  ('aceite', 'Aceite Comestible Vegetal', 'Caja de 12 · 1 L c/u', 32.90, '/products/aceite.png', 'Aceites', true),
  ('arroz', 'Arroz Blanco Superior', 'Unidad · 1 kg', 1.85, '/products/arroz.png', 'Granos', false),
  ('cafe', 'Café Molido Premium', 'Unidad · 500 g', 6.75, '/products/cafe.png', 'Bebidas', false),
  ('azucar', 'Azúcar Refinada', 'Unidad · 1 kg', 1.45, '/products/azucar.png', 'Granos', false),
  ('pasta', 'Pasta Larga Spaghetti', 'Bulto de 20 · 1 kg c/u', 18.00, '/products/pasta.png', 'Harinas', true),
  ('harina-trigo', 'Harina de Trigo Leudante', 'Unidad · 1 kg', 1.20, '/products/harina-trigo.png', 'Harinas', false),
  ('leche', 'Leche en Polvo Completa', 'Unidad · 900 g', 8.90, '/products/leche.png', 'Lácteos', false)
on conflict (id) do nothing;

-- ------------------------------------------------------- crear el pedido

-- El navegador ya no inserta pedidos: manda qué productos y cuántos, y la
-- base pone los precios. Es la única forma de que el total sea confiable.
revoke insert on public.orders from authenticated, anon;
revoke insert on public.order_items from authenticated, anon;

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
  -- Tarifas fijas por ahora. Cuando cambien por tienda o por zona, salen de
  -- su propia tabla en vez de estar acá.
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

  if p_payment_method is null or p_substitution is null then
    raise exception 'Falta el método de pago o la política de sustitución';
  end if;

  -- Precio y datos salen del catálogo, no de lo que mandó el navegador.
  select coalesce(sum(pr.price * (item.qty)::int), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  if v_subtotal <= 0 then
    raise exception 'El carrito está vacío o los productos ya no existen';
  end if;

  insert into public.orders (
    user_id, address_label, address_detail, address_lat, address_lng,
    substitution_policy, payment_method, subtotal, service_fee, delivery_fee, total
  ) values (
    v_user, v_address.label, v_address.detail, v_address.lat, v_address.lng,
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
