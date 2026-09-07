-- El pedido no sale a buscar shopper hasta que el pago esté confirmado.
--
-- Hasta ahora un pedido entraba y aparecía en el acto en la lista de
-- disponibles. El shopper podía tomarlo, ir al abasto y comprar todo antes de
-- que nadie mirara si el dinero había llegado. Si no había llegado, la pérdida
-- ya estaba hecha: la mercancía comprada y el pedido armado.
--
-- Ahora el orden es el que tiene que ser:
--
--   1. El cliente pide y ve el monto exacto en bolívares (lo pone el sistema).
--   2. Paga y escribe su referencia. Solo eso: el monto no se lo preguntamos,
--      porque un monto escrito a mano es un monto que se puede equivocar -- o
--      inflar -- y perdería todo el sentido de los céntimos únicos.
--   3. Admin o dev lo verifica contra el banco.
--   4. Recién ahí el pedido aparece para los shoppers.
--
-- El efectivo contra entrega no pasa por nada de esto: no hay nada que
-- verificar antes, se cobra en la puerta. Por eso la regla no es "todo pedido
-- espera pago" sino "espera el que se paga por adelantado".
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- ------------------------------------------------- qué pedidos esperan pago

-- Se guarda en el pedido y no se consulta al método cada vez, a propósito: si
-- mañana el abasto cambia cómo cobra un método, los pedidos viejos siguen con
-- la regla bajo la que se hicieron. Un pedido ya entregado no puede volverse
-- "pendiente de pago" porque alguien tocó una configuración.
alter table public.orders
  add column if not exists payment_required boolean not null default true;

comment on column public.orders.payment_required is
  'Si hay que confirmar el pago antes de que el pedido salga a buscar shopper. Falso en el efectivo contra entrega.';

-- Los pedidos que ya existen: el efectivo nunca esperó y no va a empezar
-- ahora; los demás, si ya están verificados o entregados, tampoco se traban
-- porque la regla mira `payment_verified_at`.
update public.orders o
set payment_required = coalesce(
  (select m.needs_reference from public.payment_methods m where m.id = o.payment_method),
  true
)
where o.payment_required is distinct from coalesce(
  (select m.needs_reference from public.payment_methods m where m.id = o.payment_method),
  true
);

/**
 * ¿Este pedido ya se puede repartir?
 *
 * Una sola definición para las tres políticas y para los avisos: si esto se
 * escribiera cuatro veces, una se quedaría vieja y sería justo la que deja
 * salir un pedido sin pagar.
 */
create or replace function public.pago_resuelto(
  p_required boolean,
  p_verified timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_required, true) = false or p_verified is not null;
$$;

revoke execute on function public.pago_resuelto(boolean, timestamptz) from public, anon;
grant execute on function public.pago_resuelto(boolean, timestamptz) to authenticated;

-- ------------------------------------------------------ lo que ve el shopper

-- La condición se aplica solo a los pedidos sin dueño. Los propios se siguen
-- viendo pase lo que pase: si un admin desmarca un pago por error mientras el
-- shopper está en camino, lo último que queremos es que el pedido se le
-- desaparezca de las manos con la compra ya hecha.
drop policy if exists "shoppers: leer disponibles y propios" on public.orders;
create policy "shoppers: leer disponibles y propios"
  on public.orders for select
  using (
    public.has_role(array['shopper', 'admin', 'dev'])
    and (
      shopper_id = (select auth.uid())
      or (shopper_id is null and public.pago_resuelto(payment_required, payment_verified_at))
    )
  );

drop policy if exists "shoppers: tomar y avanzar" on public.orders;
create policy "shoppers: tomar y avanzar"
  on public.orders for update
  using (
    public.has_role(array['shopper', 'admin', 'dev'])
    and (
      shopper_id = (select auth.uid())
      or (shopper_id is null and public.pago_resuelto(payment_required, payment_verified_at))
    )
  )
  with check (
    public.has_role(array['shopper', 'admin', 'dev'])
    and shopper_id = (select auth.uid())
  );

-- Sin esto el shopper no vería el pedido pero sí la lista de compras, que es
-- media filtración y ninguna utilidad.
drop policy if exists "shoppers: leer renglones" on public.order_items;
create policy "shoppers: leer renglones"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.has_role(array['shopper', 'admin', 'dev'])
        and (
          o.shopper_id = (select auth.uid())
          or (o.shopper_id is null and public.pago_resuelto(o.payment_required, o.payment_verified_at))
        )
    )
  );

-- ------------------------------------------------------- al crear el pedido

/**
 * Igual que la 0032, más una línea: se anota si este pedido espera pago.
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
  v_exige boolean;
  v_tasa numeric(14, 4);
  v_total numeric(12, 2);
  v_ves numeric(14, 2);
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
    rate_ves, amount_ves, payment_required
  ) values (
    v_user, v_store, v_address.label, v_address.detail, v_address.lat, v_address.lng,
    nullif(trim(coalesce(p_note, '')), ''), p_substitution, p_payment_method,
    v_subtotal, v_service, v_delivery, v_total,
    case when v_moneda = 'VES' then v_tasa end, v_ves, coalesce(v_exige, true)
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

-- --------------------------------------------------------------- verificar

/**
 * Confirmar un pago devuelve con qué se está confirmando.
 *
 * Antes devolvía solo verdadero o falso, y el panel no tenía cómo mostrar qué
 * quedó verificado. Ahora devuelve el código, el monto y la referencia: es lo
 * que se pone en pantalla para que quien confirma vea que confirmó lo que
 * creía y no el pedido de al lado.
 *
 * Se borra antes de crearla porque `create or replace` no puede cambiarle el
 * tipo de retorno a una función que ya existe: devolvía boolean.
 */
drop function if exists public.verify_payment(uuid, boolean);

create function public.verify_payment(p_order_id uuid, p_ok boolean default true)
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

-- ------------------------------------------------------------------ avisos

/**
 * Qué aviso tiene pendiente quien pregunta. Reemplaza al de la 0036: los
 * pedidos que esperan shopper ahora son solo los que ya se pagaron.
 */
create or replace function public.avisos_pendientes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_rol text;
  v_pedidos int := 0;
  v_pagos int := 0;
begin
  if v_usuario is null then
    return jsonb_build_object('titulo', null);
  end if;

  select role into v_rol from public.profiles where id = v_usuario;

  if v_rol in ('shopper', 'admin', 'dev') then
    select count(*) into v_pedidos
    from public.orders
    where shopper_id is null
      and status = 'confirmado'
      and public.pago_resuelto(payment_required, payment_verified_at);
  end if;

  if v_rol in ('admin', 'dev') then
    select count(*) into v_pagos
    from public.orders
    where payment_reported_at is not null and payment_verified_at is null;
  end if;

  -- El pago primero: hay un cliente esperando que le liberen el pedido.
  if v_pagos > 0 then
    return jsonb_build_object(
      'titulo', 'Pago por verificar',
      'cuerpo', case when v_pagos = 1
        then 'Un cliente pagó y su pedido no sale hasta que lo confirmes.'
        else v_pagos || ' pagos esperan que los confirmes.' end,
      'url', '/admin'
    );
  end if;

  if v_pedidos > 0 then
    return jsonb_build_object(
      'titulo', 'Pedido pagado',
      'cuerpo', case when v_pedidos = 1
        then 'Hay un pedido pagado esperando shopper.'
        else v_pedidos || ' pedidos pagados esperando shopper.' end,
      'url', '/shopper'
    );
  end if;

  return jsonb_build_object('titulo', null);
end;
$$;

revoke execute on function public.avisos_pendientes() from public, anon;
grant execute on function public.avisos_pendientes() to authenticated;
