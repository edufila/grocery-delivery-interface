-- Tope de intentos del código de entrega.
--
-- Cuatro dígitos son 10.000 combinaciones: sin tope se prueban todas por
-- script. Cinco intentos dan margen para equivocarse tipeando sin que el
-- control deje de servir.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.order_delivery_codes
  add column if not exists attempts integer not null default 0;

-- Cambia el tipo de retorno, así que hay que soltarla antes de recrearla.
drop function if exists public.deliver_order(uuid, text);

create or replace function public.deliver_order(p_order_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  fila public.order_delivery_codes%rowtype;
  le_corresponde boolean;
begin
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and o.shopper_id = (select auth.uid())
      and o.status = 'en_camino'
  ) into le_corresponde;

  if not le_corresponde then
    return jsonb_build_object('ok', false, 'motivo', 'no_corresponde');
  end if;

  -- for update: dos intentos a la vez no pueden saltarse el contador.
  select * into fila
  from public.order_delivery_codes
  where order_id = p_order_id
  for update;

  if fila.attempts >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
  end if;

  if fila.code = p_code then
    update public.orders set status = 'entregado' where id = p_order_id;
    return jsonb_build_object('ok', true);
  end if;

  update public.order_delivery_codes
  set attempts = attempts + 1
  where order_id = p_order_id;

  return jsonb_build_object(
    'ok', false,
    'motivo', 'incorrecto',
    'restantes', 5 - (fila.attempts + 1)
  );
end;
$$;

revoke execute on function public.deliver_order(uuid, text) from public, anon;
grant execute on function public.deliver_order(uuid, text) to authenticated;

-- Salida para cuando se bloquea: el cliente pide un código nuevo desde su
-- pedido. Solo él puede, y de paso vuelve el contador a cero.
create or replace function public.reset_delivery_code(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo text;
begin
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.user_id = (select auth.uid())
  ) then
    return null;
  end if;

  nuevo := lpad((floor(random() * 10000))::int::text, 4, '0');

  update public.order_delivery_codes
  set code = nuevo, attempts = 0
  where order_id = p_order_id;

  return nuevo;
end;
$$;

revoke execute on function public.reset_delivery_code(uuid) from public, anon;
grant execute on function public.reset_delivery_code(uuid) to authenticated;
