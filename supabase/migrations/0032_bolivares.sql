-- Cotizar en bolívares, con céntimos únicos por pedido.
--
-- Los precios están en dólares y el pago móvil se hace en bolívares. La app le
-- decía al cliente "paga $6.35" y cada quien convertía con la tasa que se le
-- ocurriera: no llegaban dos pagos iguales, y conciliar era imposible incluso
-- a mano.
--
-- Ahora cada pedido guarda el monto exacto en bolívares con el que se cotizó,
-- y la tasa con la que se calculó. La tasa se congela en el pedido a
-- propósito: si cambia mañana, lo que el cliente debe no se mueve.
--
-- LOS CÉNTIMOS ÚNICOS
--
-- Al monto se le ajustan los céntimos para que no haya dos pedidos sin pagar
-- con el mismo total: uno paga 847,23 y otro 847,91. Así el monto por sí solo
-- dice de qué pedido se trata, sin depender de que el cliente copie bien una
-- referencia de veinte dígitos. Sirve igual si el aviso del banco llega por
-- correo, por notificación del teléfono o leyéndolo a mano.
--
-- La diferencia máxima es de 99 céntimos de bolívar, que a cualquier tasa es
-- una fracción de centavo de dólar.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- Bolívares por dólar. Nula mientras no se cargue: sin tasa no se cotiza en Bs.
alter table public.settings add column if not exists rate_ves numeric(14, 4);

comment on column public.settings.rate_ves is
  'Bolívares por dólar. La carga el panel; de qué fuente sale es decisión del abasto.';

-- En qué moneda cobra cada método.
alter table public.payment_methods
  add column if not exists currency text not null default 'USD';

update public.payment_methods set currency = 'VES' where id = 'pago-movil';

alter table public.orders add column if not exists rate_ves numeric(14, 4);
alter table public.orders add column if not exists amount_ves numeric(14, 2);

comment on column public.orders.amount_ves is
  'Lo exacto que el cliente debe pagar en bolívares, con céntimos únicos para poder identificarlo por el monto.';

/**
 * El monto en bolívares para un pedido, con céntimos que no choquen con los de
 * ningún otro pedido esperando pago.
 *
 * Se prueban céntimos al azar en vez de ir sumando de uno en uno: sumando, dos
 * pedidos hechos a la vez terminan pegados y se vuelve predecible cuál sigue.
 */
create or replace function public.monto_unico_ves(p_monto numeric)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_base numeric := floor(p_monto);
  v_centimos int;
  v_intento int := 0;
begin
  while v_intento < 40 loop
    v_centimos := floor(random() * 100);

    if not exists (
      select 1 from public.orders
      where amount_ves = v_base + v_centimos / 100.0
        and payment_verified_at is null
        and status <> 'cancelado'
    ) then
      return v_base + v_centimos / 100.0;
    end if;

    v_intento := v_intento + 1;
  end loop;

  -- Cien pedidos sin pagar con el mismo bolívar entero es improbable, pero si
  -- pasa se cobra el monto tal cual: mejor un cruce ambiguo que no cobrar.
  return round(p_monto, 2);
end;
$$;

create index if not exists orders_monto_ves_idx
  on public.orders (amount_ves)
  where payment_verified_at is null;

/**
 * Al crear el pedido se cotiza en bolívares si el método cobra en esa moneda y
 * hay tasa cargada.
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
  v_moneda text;
  v_tasa numeric(14, 4);
  v_total numeric(12, 2);
  v_ves numeric(14, 2);
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para pedir';
  end if;

  select currency into v_moneda
  from public.payment_methods
  where id = p_payment_method and active;

  if not found then
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

  select service_fee, rate_ves into v_service, v_tasa
  from public.settings where id = 'global';

  select delivery_fee into v_delivery from public.stores where id = v_store;
  v_service := coalesce(v_service, 1.99);
  v_delivery := coalesce(v_delivery, 3.50);
  v_total := v_subtotal + v_service + v_delivery;

  -- Sin tasa cargada no se puede cobrar en bolívares: mejor decirlo que
  -- registrar un pedido que nadie sabe cuánto cuesta.
  if v_moneda = 'VES' then
    if v_tasa is null or v_tasa <= 0 then
      raise exception 'Falta cargar la tasa del día para cobrar en bolívares';
    end if;
    v_ves := public.monto_unico_ves(v_total * v_tasa);
  end if;

  insert into public.orders (
    user_id, store_id, address_label, address_detail, address_lat, address_lng,
    customer_note, substitution_policy, payment_method,
    subtotal, service_fee, delivery_fee, total,
    rate_ves, amount_ves
  ) values (
    v_user, v_store, v_address.label, v_address.detail, v_address.lat, v_address.lng,
    nullif(trim(coalesce(p_note, '')), ''), p_substitution, p_payment_method,
    v_subtotal, v_service, v_delivery, v_total,
    case when v_moneda = 'VES' then v_tasa end, v_ves
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

/**
 * Un pago recibido ahora también se puede enganchar por monto.
 *
 * Es más confiable que la referencia: el monto lo pone el sistema y el cliente
 * no lo puede copiar mal. La referencia sigue sirviendo para el que paga un
 * monto distinto al cotizado.
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
  v_por text;
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
  to authenticated;

revoke execute on function public.monto_unico_ves(numeric) from public, anon, authenticated;
