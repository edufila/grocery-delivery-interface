-- 0048 · Pagos de pedidos cancelados: marcarlos como devueltos.
--
-- Un cliente puede cancelar mientras nadie tomó su pedido, aunque ya haya
-- pagado. El panel ahora los lista en "Cancelados con pago encima", pero sin
-- una forma de decir "ya se lo devolví" esa lista crece para siempre y deja de
-- servir: nadie distingue el que falta del que ya se resolvió.
--
-- Dos cosas:
--
--   1. `payment_refunded_at`: cuándo se devolvió. La lista muestra solo los que
--      no la tienen. Se escribe con `marcar_devuelto`, no con un update: a la
--      columna no le llega nadie por la tabla (0005 limita qué campos se tocan).
--
--   2. `verify_payment` ya no confirma pagos de pedidos cancelados. Antes sí:
--      confirmar desde la lista de pagos -- donde el cancelado seguía apareciendo
--      -- marcaba verificado un pedido que el cliente ya no quiere.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.orders
  add column if not exists payment_refunded_at timestamptz;

create or replace function public.marcar_devuelto(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tienes permiso para marcar devoluciones';
  end if;

  update public.orders
  set payment_refunded_at = now()
  where id = p_order_id
    and status = 'cancelado'
    and payment_refunded_at is null
  returning code into v_code;

  if v_code is null then
    raise exception 'Ese pedido no está cancelado o ya estaba marcado como devuelto';
  end if;

  return jsonb_build_object('ok', true, 'code', v_code);
end;
$$;

revoke execute on function public.marcar_devuelto(uuid) from public, anon;
grant execute on function public.marcar_devuelto(uuid) to authenticated;

create or replace function public.verify_payment(p_order_id uuid, p_ok boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_ves numeric(14, 2);
  v_ref text;
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tienes permiso para verificar pagos';
  end if;

  if p_ok and exists (
    select 1 from public.orders where id = p_order_id and status = 'cancelado'
  ) then
    raise exception 'Ese pedido está cancelado: su pago va a devolución, no se confirma';
  end if;

  update public.orders
  set payment_verified_at = case when p_ok then now() else null end,
      payment_verified_by = case when p_ok then (select auth.uid()) else null end
  where id = p_order_id
  returning code, amount_ves, payment_reference into v_code, v_ves, v_ref;

  if v_code is null then
    raise exception 'Ese pedido no existe';
  end if;

  return jsonb_build_object(
    'ok', true, 'code', v_code, 'amount_ves', v_ves,
    'reference', v_ref, 'verificado', p_ok
  );
end;
$$;

revoke execute on function public.verify_payment(uuid, boolean) from public, anon;
grant execute on function public.verify_payment(uuid, boolean) to authenticated;

-- Para confirmar: la columna existe y la función quedó cerrada a anónimos.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_refunded_at'
  ) as columna_lista,
  has_function_privilege('anon', 'public.marcar_devuelto(uuid)', 'execute') as anon_puede;
