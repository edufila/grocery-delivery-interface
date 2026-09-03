-- Decirle al cliente a dónde mandar el dinero, y dejarlo reportar el pago.
--
-- Hasta ahora el checkout ofrecía cuatro métodos de pago y el cliente elegía
-- uno, pero nunca se le decía a qué banco, a qué teléfono ni a nombre de
-- quién. El pedido entraba y ahí terminaba todo: no había forma de pagar ni de
-- avisar que se pagó.
--
-- Los datos NO van en el código: se cargan desde el panel. Así se cambian sin
-- desplegar, y mientras se prueba con una cuenta personal no queda un número
-- de nadie escrito en el repositorio.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- ------------------------------------------------------- métodos de pago

create table if not exists public.payment_methods (
  id text primary key,
  label text not null,
  hint text,
  -- A dónde pagar. Texto libre porque cada método pide datos distintos: el
  -- pago móvil quiere banco, teléfono y cédula; Zelle un correo y un nombre.
  instructions text,
  -- El efectivo se paga en la puerta: no hay referencia que reportar.
  needs_reference boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.payment_methods (id, label, hint, needs_reference, sort_order)
values
  ('pago-movil', 'Pago Móvil', 'En Bs.', true, 1),
  ('zelle', 'Zelle', 'En USD', true, 2),
  ('efectivo', 'Efectivo divisas', 'Contra entrega', false, 3),
  ('tarjeta', 'Tarjeta', 'Crédito / Débito', true, 4)
on conflict (id) do nothing;

alter table public.payment_methods enable row level security;

-- Los lee cualquiera: el checkout los necesita antes de iniciar sesión.
drop policy if exists "pagos: leer" on public.payment_methods;
create policy "pagos: leer" on public.payment_methods for select using (true);

drop policy if exists "pagos: administrar" on public.payment_methods;
create policy "pagos: administrar" on public.payment_methods for all
  using (public.has_role(array['admin', 'dev']))
  with check (public.has_role(array['admin', 'dev']));

drop trigger if exists pagos_touch_updated_at on public.payment_methods;
create trigger pagos_touch_updated_at
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------- el pago de un pedido

alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists payment_reported_at timestamptz;
alter table public.orders add column if not exists payment_verified_at timestamptz;
alter table public.orders add column if not exists payment_verified_by uuid references auth.users (id);

comment on column public.orders.payment_reference is
  'Los últimos dígitos o el número de la transferencia, escrito por el cliente.';

/**
 * El cliente reporta que pagó.
 *
 * Va por función y no por un update directo porque las columnas que puede
 * escribir un usuario están limitadas a mano (ver 0005), y con razón: si
 * pudiera escribir cualquier columna de su pedido, podría escribir el total.
 *
 * Se puede corregir mientras nadie lo haya verificado: la gente se equivoca
 * copiando una referencia.
 */
create or replace function public.report_payment(p_order_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limpia text := nullif(trim(p_reference), '');
begin
  if v_limpia is null or length(v_limpia) < 4 then
    raise exception 'Escribe al menos los últimos 4 dígitos de la referencia';
  end if;

  update public.orders
  set payment_reference = v_limpia,
      payment_reported_at = now()
  where id = p_order_id
    and user_id = (select auth.uid())
    and payment_verified_at is null;

  if not found then
    raise exception 'Ese pedido no es tuyo, o el pago ya fue verificado';
  end if;

  return true;
end;
$$;

/** El abasto confirma que el dinero llegó. */
create or replace function public.verify_payment(p_order_id uuid, p_ok boolean default true)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tienes permiso para verificar pagos';
  end if;

  update public.orders
  set payment_verified_at = case when p_ok then now() else null end,
      payment_verified_by = case when p_ok then (select auth.uid()) else null end
  where id = p_order_id;

  return found;
end;
$$;

revoke execute on function public.report_payment(uuid, text) from public, anon;
revoke execute on function public.verify_payment(uuid, boolean) from public, anon;
grant execute on function public.report_payment(uuid, text) to authenticated;
grant execute on function public.verify_payment(uuid, boolean) to authenticated;

/**
 * El pedido no puede entrar con un método que no está ofreciéndose.
 *
 * La pantalla solo muestra los activos, pero entre que alguien abre el
 * checkout y confirma pueden pasar minutos, y en ese rato el método pudo
 * apagarse. Sin esto entraría un pedido que nadie sabe cómo cobrar.
 */
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
  v_agotados text;
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para pedir';
  end if;

  if not exists (
    select 1 from public.payment_methods
    where id = p_payment_method and active
  ) then
    raise exception 'Ese método de pago ya no está disponible';
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

  select string_agg(pr.name, ', ' order by pr.name)
  into v_agotados
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0 and not pr.in_stock;

  if v_agotados is not null then
    raise exception 'Se agotó: %. Quítalo del carrito para poder pedir', v_agotados;
  end if;

  select count(distinct pr.store_id), min(pr.store_id)
  into v_tiendas, v_store
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active and pr.in_stock
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
  join public.products pr on pr.id = item.product_id and pr.active and pr.in_stock
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
  join public.products pr on pr.id = item.product_id and pr.active and pr.in_stock
  where item.qty > 0;

  return v_code;
end;
$$;

revoke execute on function public.place_order(jsonb, uuid, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, uuid, text, text, text) to authenticated;
