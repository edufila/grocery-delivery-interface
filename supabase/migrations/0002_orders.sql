-- Pedidos, sus renglones y las direcciones del usuario.
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- ---------------------------------------------------------------- direcciones

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  detail text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses (user_id);

alter table public.addresses enable row level security;

drop policy if exists "direcciones propias" on public.addresses;
create policy "direcciones propias"
  on public.addresses for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Una sola dirección por defecto por persona.
create unique index if not exists addresses_one_default
  on public.addresses (user_id)
  where is_default;

-- ---------------------------------------------------------------- pedidos

-- Arranca en 4822 porque el mockup mostraba el pedido GA-4821.
create sequence if not exists public.order_code_seq start 4822;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('GA-' || nextval('public.order_code_seq')),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Copia de la dirección, no una referencia: si mañana el usuario borra o
  -- edita esa dirección, el pedido tiene que seguir diciendo a dónde fue.
  address_label text,
  address_detail text,

  status text not null default 'confirmado'
    check (status in ('confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado')),
  substitution_policy text not null default 'shopper'
    check (substitution_policy in ('shopper', 'chat', 'none')),
  payment_method text not null,

  subtotal numeric(12, 2) not null,
  service_fee numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "pedidos propios: leer" on public.orders;
create policy "pedidos propios: leer"
  on public.orders for select
  using ((select auth.uid()) = user_id);

drop policy if exists "pedidos propios: crear" on public.orders;
create policy "pedidos propios: crear"
  on public.orders for insert
  with check ((select auth.uid()) = user_id);

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- renglones

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,

  product_id text not null,
  -- Nombre, presentación y precio quedan congelados al momento de la compra.
  -- Si mañana sube el café, el pedido viejo tiene que seguir mostrando lo que
  -- se pagó, no lo que cuesta hoy.
  name text not null,
  unit text not null,
  unit_price numeric(12, 2) not null,
  qty integer not null check (qty > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

drop policy if exists "renglones de pedidos propios: leer" on public.order_items;
create policy "renglones de pedidos propios: leer"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "renglones de pedidos propios: crear" on public.order_items;
create policy "renglones de pedidos propios: crear"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );
