-- 0051 · Entrega programada
--
-- Hasta ahora todo pedido era "lo antes posible". Con el horario de la 0049,
-- eso significa que fuera de horario no se podía comprar nada: la persona que
-- arma el mercado de mañana a las 10 de la noche se iba sin pedir.
--
-- Ahora el pedido puede llevar a partir de cuándo se entrega. Vacío = lo antes
-- posible, como siempre.
--
-- place_order valida lo mismo que ofrece la pantalla (lib/horario.ts):
--   · al menos 50 minutos de margen (la pantalla ofrece 60; el resto es por lo
--     que tarda en tocar el botón),
--   · a lo sumo 3 días,
--   · con el abasto abierto la hora antes (cuando se compra) y a la hora misma.
-- Sin horario cargado, de 8 a. m. a 8 p. m.
--
-- Necesita la 0049 (horario). Correr entero en Supabase → SQL Editor.
-- Es idempotente.

alter table public.orders add column if not exists entregar_desde timestamptz;

comment on column public.orders.entregar_desde is
  'A partir de cuándo se entrega. Nulo = lo antes posible.';

-- --------------------------------------------- abierto en un momento dado

create or replace function public.abasto_abierto_en(p_abre time, p_cierra time, p_momento timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_abre is null or p_cierra is null or p_abre = p_cierra then true
    when p_abre < p_cierra then
      (p_momento at time zone 'America/Caracas')::time >= p_abre
      and (p_momento at time zone 'America/Caracas')::time < p_cierra
    else
      (p_momento at time zone 'America/Caracas')::time >= p_abre
      or (p_momento at time zone 'America/Caracas')::time < p_cierra
  end;
$$;

revoke execute on function public.abasto_abierto_en(time, time, timestamptz) from public, anon, authenticated;

-- ------------------------------------------------------- al crear el pedido

/**
 * Igual que la 0049, más p_programado. Se borra la de cinco parámetros: con
 * las dos vivas, PostgREST no sabría a cuál llamar cuando no llega
 * p_programado. La nueva lo tiene con valor por defecto, así que el código
 * que no lo manda sigue funcionando.
 */
drop function if exists public.place_order(jsonb, uuid, text, text, text);

create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_substitution text,
  p_note text default null,
  p_programado timestamptz default null
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
  v_exige boolean;
  v_tasa numeric(14, 4);
  v_total numeric(12, 2);
  v_ves numeric(14, 2);
  v_abre time;
  v_cierra time;
  v_nombre text;
  v_a time;
  v_c time;
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para pedir';
  end if;

  select currency, needs_reference into v_moneda, v_exige
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

  select delivery_fee, abre, cierra, name
  into v_delivery, v_abre, v_cierra, v_nombre
  from public.stores where id = v_store;

  if p_programado is null then
    if not public.abasto_abierto(v_abre, v_cierra) then
      raise exception '% está cerrado ahora. Programa la entrega para cuando abra', v_nombre;
    end if;
  else
    if p_programado < now() + interval '50 minutes' then
      raise exception 'La entrega programada tiene que ser al menos en una hora';
    end if;
    if p_programado > now() + interval '3 days' then
      raise exception 'La entrega programada puede ser hasta dentro de tres días';
    end if;

    -- Sin horario cargado, de 8 a 8.
    v_a := case when v_abre is null or v_cierra is null or v_abre = v_cierra then time '08:00' else v_abre end;
    v_c := case when v_abre is null or v_cierra is null or v_abre = v_cierra then time '20:00' else v_cierra end;

    if not public.abasto_abierto_en(v_a, v_c, p_programado - interval '60 minutes')
       or not public.abasto_abierto_en(v_a, v_c, p_programado - interval '5 minutes') then
      raise exception 'A esa hora % no está abierto. Elige otra', v_nombre;
    end if;
  end if;

  select coalesce(sum(pr.price * (item.qty)::int), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active and pr.in_stock
  where item.qty > 0;

  select service_fee, rate_ves into v_service, v_tasa
  from public.settings where id = 'global';

  v_service := coalesce(v_service, 1.99);
  v_delivery := coalesce(v_delivery, 3.50);
  v_total := v_subtotal + v_service + v_delivery;

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
    rate_ves, amount_ves, payment_required, entregar_desde
  ) values (
    v_user, v_store, v_address.label, v_address.detail, v_address.lat, v_address.lng,
    nullif(trim(coalesce(p_note, '')), ''), p_substitution, p_payment_method,
    v_subtotal, v_service, v_delivery, v_total,
    case when v_moneda = 'VES' then v_tasa end, v_ves, coalesce(v_exige, true), p_programado
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

revoke execute on function public.place_order(jsonb, uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.place_order(jsonb, uuid, text, text, text, timestamptz) to authenticated;
