-- Dejar que el servidor registre pagos, no solo una persona con sesión.
--
-- record_payment exige rol admin o dev, y eso se mira contra auth.uid(): el
-- usuario que hizo la llamada. Un servidor que reenvía el aviso del banco no
-- es un usuario, no tiene sesión, y auth.uid() le da nulo. Con la regla actual
-- nunca podría registrar nada.
--
-- Se agrega la llave de servicio como segunda puerta. Es la llave maestra del
-- proyecto, así que quien la tenga podría hacer cualquier cosa igual: esto no
-- le da un poder nuevo, solo deja de rechazarla en esta función.
--
-- Vive en una variable de entorno del servidor, nunca en el navegador ni en el
-- repositorio, y la única parte de la app que la usa es la ruta que recibe los
-- avisos del banco.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create or replace function public.record_payment(
  p_reference text,
  p_amount numeric default null,
  p_paid_at timestamptz default null,
  p_method text default null,
  p_payer text default null,
  p_raw text default null,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limpia text := nullif(trim(p_reference), '');
  v_pago uuid;
  v_orden uuid;
  v_por text;
begin
  if not (
    public.has_role(array['admin', 'dev'])
    or (select auth.jwt() ->> 'role') = 'service_role'
  ) then
    raise exception 'No tienes permiso para registrar pagos';
  end if;

  if v_limpia is null or length(regexp_replace(v_limpia, '\D', '', 'g')) < 4 then
    raise exception 'La referencia tiene que traer al menos 4 dígitos';
  end if;

  insert into public.payments_received (reference, amount, paid_at, method, payer, raw, source)
  values (v_limpia, p_amount, coalesce(p_paid_at, now()), p_method, p_payer, p_raw, p_source)
  on conflict (reference) do update set
    amount = coalesce(excluded.amount, public.payments_received.amount),
    paid_at = coalesce(excluded.paid_at, public.payments_received.paid_at)
  returning id, order_id into v_pago, v_orden;

  if v_orden is not null then
    return jsonb_build_object('ok', true, 'ya_estaba', true, 'order_id', v_orden);
  end if;

  -- Primero por monto exacto: los céntimos únicos lo hacen inequívoco.
  if p_amount is not null then
    select o.id into v_orden
    from public.orders o
    where o.payment_verified_at is null
      and o.status <> 'cancelado'
      and o.amount_ves = p_amount
    order by o.created_at desc
    limit 1;

    if v_orden is not null then
      v_por := 'monto';
    end if;
  end if;

  -- Si no, por la referencia que el cliente reportó.
  if v_orden is null then
    select o.id into v_orden
    from public.orders o
    where o.payment_verified_at is null
      and o.payment_reference is not null
      and public.referencias_coinciden(o.payment_reference, v_limpia)
    order by o.payment_reported_at desc nulls last
    limit 1;

    if v_orden is not null then
      v_por := 'referencia';
    end if;
  end if;

  if v_orden is null then
    return jsonb_build_object('ok', true, 'conciliado', false);
  end if;

  update public.payments_received set order_id = v_orden where id = v_pago;
  update public.orders set payment_verified_at = now() where id = v_orden;

  return jsonb_build_object('ok', true, 'conciliado', true, 'order_id', v_orden, 'por', v_por);
end;
$$;

revoke execute on function public.record_payment(text, numeric, timestamptz, text, text, text, text)
  from public, anon;
grant execute on function public.record_payment(text, numeric, timestamptz, text, text, text, text)
  to authenticated, service_role;
