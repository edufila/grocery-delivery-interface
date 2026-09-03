-- Roles, asignación de pedidos a shoppers y su ubicación en vivo.
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- ---------------------------------------------------------------- roles

alter table public.profiles
  add column if not exists role text not null default 'cliente';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('cliente', 'shopper', 'admin', 'dev'));
exception
  when duplicate_object then null;
end
$$;

comment on column public.profiles.role is
  'cliente compra; shopper arma pedidos; admin y dev ven todo (dev es para probar).';

-- Lee el rol saltando RLS: se usa dentro de las políticas de abajo y así se
-- evita depender de que el usuario pueda leerse a sí mismo.
create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any(roles)
  );
$$;

-- ---------------------------------------------------------------- asignación

alter table public.orders
  add column if not exists shopper_id uuid references auth.users (id) on delete set null;

-- Última posición conocida del shopper para este pedido.
alter table public.orders add column if not exists shopper_lat double precision;
alter table public.orders add column if not exists shopper_lng double precision;
alter table public.orders add column if not exists shopper_located_at timestamptz;

create index if not exists orders_shopper_idx on public.orders (shopper_id, created_at desc);

-- ---------------------------------------------------------------- políticas

-- Los pedidos sin dueño asignado están disponibles para cualquier shopper;
-- una vez tomados, solo los ve quien los tomó.
drop policy if exists "shoppers: leer disponibles y propios" on public.orders;
create policy "shoppers: leer disponibles y propios"
  on public.orders for select
  using (
    public.has_role(array['shopper', 'admin', 'dev'])
    and (shopper_id is null or shopper_id = (select auth.uid()))
  );

-- Puede tomar uno libre y avanzar los suyos, pero al escribir tiene que
-- quedar a su nombre: así no se asigna pedidos a terceros.
drop policy if exists "shoppers: tomar y avanzar" on public.orders;
create policy "shoppers: tomar y avanzar"
  on public.orders for update
  using (
    public.has_role(array['shopper', 'admin', 'dev'])
    and (shopper_id is null or shopper_id = (select auth.uid()))
  )
  with check (
    public.has_role(array['shopper', 'admin', 'dev'])
    and shopper_id = (select auth.uid())
  );

-- El shopper necesita ver qué comprar.
drop policy if exists "shoppers: leer renglones" on public.order_items;
create policy "shoppers: leer renglones"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.has_role(array['shopper', 'admin', 'dev'])
        and (o.shopper_id is null or o.shopper_id = (select auth.uid()))
    )
  );

-- ------------------------------------------------------------ para probar
-- Convertirte en shopper (reemplazá el correo por el tuyo):
--
--   update public.profiles set role = 'dev'
--   where id = (select id from auth.users where email = 'tu@correo.com');
--
-- Y para volver a ser cliente, lo mismo con 'cliente'.
