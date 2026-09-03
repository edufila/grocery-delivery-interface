-- La dirección tiene que tener punto en el mapa para poder pedir.
--
-- En Acarigua la gente no maneja nombres de calles pero sabe cómo llegar: el
-- pin es la dirección de verdad y el texto es la referencia de la puerta. Sin
-- coordenadas el repartidor no tiene a dónde ir.
--
-- La pantalla ya lo bloquea; esto lo hace cumplir aunque alguien llame a la
-- función por su cuenta.
--
-- Correr en Supabase → SQL Editor.

create or replace function public.place_order(
  p_items jsonb,
  p_address_id uuid,
  p_payment_method text,
  p_substitution text
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
  c_service constant numeric(12, 2) := 1.99;
  c_delivery constant numeric(12, 2) := 3.50;
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para pedir';
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

  if p_payment_method is null or p_substitution is null then
    raise exception 'Falta el método de pago o la política de sustitución';
  end if;

  select coalesce(sum(pr.price * (item.qty)::int), 0)
  into v_subtotal
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  if v_subtotal <= 0 then
    raise exception 'El carrito está vacío o los productos ya no existen';
  end if;

  insert into public.orders (
    user_id, address_label, address_detail, address_lat, address_lng,
    substitution_policy, payment_method, subtotal, service_fee, delivery_fee, total
  ) values (
    v_user, v_address.label, v_address.detail, v_address.lat, v_address.lng,
    p_substitution, p_payment_method, v_subtotal, c_service, c_delivery,
    v_subtotal + c_service + c_delivery
  )
  returning id, code into v_order_id, v_code;

  insert into public.order_items (order_id, product_id, name, unit, unit_price, qty)
  select v_order_id, pr.id, pr.name, pr.unit, pr.price, (item.qty)::int
  from jsonb_to_recordset(p_items) as item(product_id text, qty int)
  join public.products pr on pr.id = item.product_id and pr.active
  where item.qty > 0;

  return v_code;
end;
$$;

revoke execute on function public.place_order(jsonb, uuid, text, text) from public, anon;
grant execute on function public.place_order(jsonb, uuid, text, text) to authenticated;
