-- Cruzar lo que el cliente reporta contra lo que el banco dice que llegó.
--
-- Hasta ahora el cliente escribía su referencia y alguien tenía que ir al banco
-- a buscarla a mano. Esto guarda los pagos que el banco informa y los cruza
-- solo: cuando la referencia del cliente coincide con una recibida, el pedido
-- queda verificado sin que nadie mire nada.
--
-- El cruce funciona por los dos lados, porque el orden no está garantizado:
-- el cliente puede reportar antes de que llegue el aviso del banco, o después.
--
-- QUÉ NO HACE ESTO: no entra al banco. No hay claves bancarias en ningún lado
-- y no las va a haber. Los pagos entran por `record_payment`, que es lo que
-- llama quien tenga acceso a los avisos del banco: hoy el panel a mano, y más
-- adelante lo que se automatice.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create table if not exists public.payments_received (
  id uuid primary key default gen_random_uuid(),
  -- La referencia completa, tal como la informa el banco.
  reference text not null unique,
  amount numeric(12, 2),
  currency text not null default 'VES',
  paid_at timestamptz,
  method text references public.payment_methods (id),
  payer text,
  -- El aviso original, por si hay que revisar a mano qué se entendió mal.
  raw text,
  source text not null default 'manual',
  -- A qué pedido se enganchó. Un pago paga un pedido y nada más.
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pagos_recibidos_orden_idx on public.payments_received (order_id);

alter table public.payments_received enable row level security;

-- Solo el abasto. El cliente no tiene nada que hacer viendo los pagos de otros.
drop policy if exists "pagos recibidos: admin" on public.payments_received;
create policy "pagos recibidos: admin" on public.payments_received for all
  using (public.has_role(array['admin', 'dev']))
  with check (public.has_role(array['admin', 'dev']));

/**
 * ¿Esta referencia reportada corresponde a esta recibida?
 *
 * El cliente escribe los últimos dígitos, no la referencia entera: es lo que
 * ve en la pantalla de su banco y lo que recuerda. Así que se compara por el
 * final, exigiendo al menos cuatro dígitos para que no cruce cualquier cosa.
 *
 * Se ignora todo lo que no sea número: unos escriben "0001234", otros
 * "Ref. 001234" y otros con espacios.
 */
create or replace function public.referencias_coinciden(p_reportada text, p_recibida text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    length(regexp_replace(coalesce(p_reportada, ''), '\D', '', 'g')) >= 4
    and regexp_replace(coalesce(p_recibida, ''), '\D', '', 'g')
        like '%' || regexp_replace(coalesce(p_reportada, ''), '\D', '', 'g');
$$;

/**
 * Engancha un pedido con un pago recibido, si hay uno que le calce.
 *
 * Devuelve verdadero si quedó verificado. No toca nada si el pago ya está
 * enganchado a otro pedido: un pago paga uno solo, y si dos clientes reportan
 * la misma referencia, el segundo se queda sin verificar y alguien lo mira.
 */
create or replace function public.conciliar_pedido(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_pago uuid;
begin
  select payment_reference into v_ref
  from public.orders
  where id = p_order_id and payment_verified_at is null;

  if v_ref is null then
    return false;
  end if;

  select id into v_pago
  from public.payments_received
  where order_id is null
    and public.referencias_coinciden(v_ref, reference)
  order by paid_at desc nulls last
  limit 1;

  if v_pago is null then
    return false;
  end if;

  update public.payments_received set order_id = p_order_id where id = v_pago;

  update public.orders
  set payment_verified_at = now()
  where id = p_order_id;

  return true;
end;
$$;

/**
 * El cliente reporta que pagó, y si el aviso del banco ya llegó, queda
 * verificado en el acto.
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
  if v_limpia is null or length(regexp_replace(v_limpia, '\D', '', 'g')) < 4 then
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

  -- Devuelve si quedó verificado solo, para poder decírselo en la pantalla.
  return public.conciliar_pedido(p_order_id);
end;
$$;

/**
 * Entra un pago informado por el banco, y se engancha solo con el pedido que
 * lo esté esperando.
 *
 * Esta es la puerta por donde entra todo: hoy la usa el panel cuando alguien
 * pega el aviso, y es la misma que va a usar lo que se automatice después. No
 * hace falta cambiar nada más para que la conciliación deje de ser manual.
 */
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
begin
  if not public.has_role(array['admin', 'dev']) then
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

  -- Ya estaba enganchado: no se toca nada.
  if v_orden is not null then
    return jsonb_build_object('ok', true, 'ya_estaba', true, 'order_id', v_orden);
  end if;

  -- El cliente pudo haber reportado antes de que llegara el aviso.
  select o.id into v_orden
  from public.orders o
  where o.payment_verified_at is null
    and o.payment_reference is not null
    and public.referencias_coinciden(o.payment_reference, v_limpia)
  order by o.payment_reported_at desc nulls last
  limit 1;

  if v_orden is null then
    return jsonb_build_object('ok', true, 'conciliado', false);
  end if;

  update public.payments_received set order_id = v_orden where id = v_pago;
  update public.orders set payment_verified_at = now() where id = v_orden;

  return jsonb_build_object('ok', true, 'conciliado', true, 'order_id', v_orden);
end;
$$;

revoke execute on function public.record_payment(text, numeric, timestamptz, text, text, text, text)
  from public, anon;
grant execute on function public.record_payment(text, numeric, timestamptz, text, text, text, text)
  to authenticated;
