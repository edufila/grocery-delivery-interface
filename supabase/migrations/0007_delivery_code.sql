-- Código de entrega: el cliente se lo dicta al shopper en la puerta.
--
-- Vive en su propia tabla porque el shopper puede leer su pedido entero; si el
-- código estuviera en orders lo vería en la misma consulta y no probaría nada.
-- Acá no tiene permiso de lectura: solo puede enviarlo a la función de abajo,
-- que compara del lado del servidor.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create table if not exists public.order_delivery_codes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

alter table public.order_delivery_codes enable row level security;

-- Solo el dueño del pedido lo lee. El shopper no tiene ninguna política de
-- lectura acá, así que para él la tabla está vacía.
drop policy if exists "codigo: solo el cliente" on public.order_delivery_codes;
create policy "codigo: solo el cliente"
  on public.order_delivery_codes for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
    )
  );

-- Nadie lo escribe desde la app: lo genera la base al crear el pedido.
revoke insert, update, delete on public.order_delivery_codes from authenticated, anon;

create or replace function public.create_delivery_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_delivery_codes (order_id, code)
  values (new.id, lpad((floor(random() * 10000))::int::text, 4, '0'))
  on conflict (order_id) do nothing;
  return new;
end;
$$;

drop trigger if exists orders_delivery_code on public.orders;
create trigger orders_delivery_code
  after insert on public.orders
  for each row execute function public.create_delivery_code();

-- Le da código a los pedidos que ya existían.
insert into public.order_delivery_codes (order_id, code)
select o.id, lpad((floor(random() * 10000))::int::text, 4, '0')
from public.orders o
on conflict (order_id) do nothing;

-- ------------------------------------------------------------ entrega

-- El shopper ya no puede marcar entregado con un update común: tiene que pasar
-- por la función, que exige el código correcto.
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
    and status <> 'entregado'
  );

create or replace function public.deliver_order(p_order_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  correcto boolean;
begin
  select exists (
    select 1
    from public.orders o
    join public.order_delivery_codes c on c.order_id = o.id
    where o.id = p_order_id
      and o.shopper_id = (select auth.uid())
      and o.status = 'en_camino'
      and c.code = p_code
  ) into correcto;

  if correcto then
    update public.orders set status = 'entregado' where id = p_order_id;
  end if;

  return correcto;
end;
$$;

revoke execute on function public.deliver_order(uuid, text) from public, anon;
grant execute on function public.deliver_order(uuid, text) to authenticated;
