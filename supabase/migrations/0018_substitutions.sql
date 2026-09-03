-- Qué pasó con cada producto en la caja, y cuánto se paga al final.
--
-- El cliente elige qué hacer si falta algo, pero el shopper no tenía cómo
-- marcarlo. Y el total que se confirma es una estimación: recién se sabe el
-- monto real cuando el shopper terminó de recorrer el abasto.
--
-- Por eso el total original se conserva y el final va aparte: la diferencia
-- entre los dos es lo que hay que poder justificar.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.order_items
  add column if not exists status text not null default 'pendiente';

do $$
begin
  alter table public.order_items
    add constraint order_items_status_check
    check (status in ('pendiente', 'ok', 'ajustado', 'faltante'));
exception
  when duplicate_object then null;
end
$$;

-- Cuántas llevó de verdad. null mientras no se haya revisado.
alter table public.order_items add column if not exists final_qty integer;

alter table public.orders add column if not exists final_subtotal numeric(12, 2);
alter table public.orders add column if not exists final_total numeric(12, 2);

comment on column public.orders.final_total is
  'Lo que se paga de verdad. Queda en null hasta que el shopper cierra la compra; total sigue siendo lo estimado al confirmar.';

-- El shopper marca un renglón y el pedido se recalcula solo.
create or replace function public.shopper_set_item(
  p_item_id uuid,
  p_status text,
  p_final_qty integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_qty integer;
  v_final integer;
begin
  if p_status not in ('pendiente', 'ok', 'ajustado', 'faltante') then
    raise exception 'Estado desconocido';
  end if;

  select i.order_id, i.qty into v_order_id, v_qty
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where i.id = p_item_id
    and o.shopper_id = (select auth.uid())
    and o.status in ('confirmado', 'preparando');

  if v_order_id is null then
    raise exception 'Ese producto no es de un pedido tuyo en preparación';
  end if;

  v_final := case
    when p_status = 'faltante' then 0
    when p_status = 'ok' then v_qty
    else greatest(0, least(coalesce(p_final_qty, v_qty), v_qty))
  end;

  update public.order_items
  set status = p_status, final_qty = v_final
  where id = p_item_id;

  -- Recalcula con lo que quedó marcado. Lo que todavía no se revisó cuenta
  -- por su cantidad original: el total no se desploma a mitad de la compra.
  update public.orders o
  set final_subtotal = sub.monto,
      final_total = sub.monto + o.service_fee + o.delivery_fee
  from (
    select sum(i.unit_price * coalesce(i.final_qty, i.qty)) as monto
    from public.order_items i
    where i.order_id = v_order_id
  ) sub
  where o.id = v_order_id;

  return true;
end;
$$;

revoke execute on function public.shopper_set_item(uuid, text, integer) from public, anon;
grant execute on function public.shopper_set_item(uuid, text, integer) to authenticated;
