-- 0050 · Privacidad: a quién escribir, la ubicación del shopper, borrar mis datos
--
-- Tres cosas que hacían falta para poder publicar una política de datos que
-- diga la verdad:
--
-- 1. Un WhatsApp de soporte. No había a quién escribirle: ni para un problema
--    con un pedido ni para pedir que borren tus datos.
-- 2. La ubicación del shopper se borra cuando el pedido termina. Quedaba
--    guardada para siempre en el pedido: el último punto donde estuvo alguien,
--    sin ningún motivo para conservarlo.
-- 3. Un cliente puede borrar sus datos desde Perfil, sin pedírselo a nadie.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- ---------------------------------------------------------- 1. soporte

alter table public.settings add column if not exists soporte_whatsapp text;

comment on column public.settings.soporte_whatsapp is
  'WhatsApp de soporte, solo dígitos con código de país (584141234567). Lo ve cualquiera.';

-- ------------------------------------------- 2. la ubicación no se queda

create or replace function public.soltar_ubicacion_shopper()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('entregado', 'cancelado') then
    new.shopper_lat := null;
    new.shopper_lng := null;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_soltar_ubicacion on public.orders;
create trigger orders_soltar_ubicacion
  before update on public.orders
  for each row execute function public.soltar_ubicacion_shopper();

-- La que ya quedó guardada en pedidos viejos.
update public.orders
set shopper_lat = null, shopper_lng = null
where status in ('entregado', 'cancelado')
  and (shopper_lat is not null or shopper_lng is not null);

-- Un disparador no se invoca por RPC, pero Supabase igual le da execute a
-- anon: se cierra para que no quede nada abierto sin motivo.
revoke execute on function public.soltar_ubicacion_shopper() from public, anon, authenticated;

-- ------------------------------------------------- 3. borrar mis datos

/**
 * Borra lo personal de quien la llama.
 *
 * Qué se va: nombre, teléfono, fecha de nacimiento, direcciones, favoritos,
 * avisos del teléfono, y de sus pedidos la dirección, el punto, la nota y el
 * chat.
 *
 * Qué queda: los pedidos mismos (código, productos, montos, referencia de
 * pago), porque son el registro de un cobro y de una devolución. Y la cuenta
 * de acceso con su correo: borrarla necesita la llave de servicio, que no vive
 * en la base.
 *
 * No se puede con un pedido en curso: el shopper necesita la dirección.
 * Solo clientes: el nombre de un shopper lo asigna la empresa, y un admin
 * borrándose por error dejaría el panel sin nadie.
 */
create or replace function public.borrar_mis_datos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_rol text;
  v_en_curso int;
begin
  if v_usuario is null then
    raise exception 'Hay que iniciar sesión';
  end if;

  select role into v_rol from public.profiles where id = v_usuario;
  if coalesce(v_rol, 'cliente') <> 'cliente' then
    raise exception 'Las cuentas del equipo se dan de baja desde Administración';
  end if;

  select count(*) into v_en_curso
  from public.orders
  where user_id = v_usuario and status not in ('entregado', 'cancelado');

  if v_en_curso > 0 then
    raise exception 'Tienes un pedido en curso. Cuando llegue o lo canceles, puedes borrar tus datos';
  end if;

  delete from public.order_messages
  where order_id in (select id from public.orders where user_id = v_usuario);

  update public.orders
  set address_label = null,
      address_detail = null,
      address_lat = null,
      address_lng = null,
      customer_note = null
  where user_id = v_usuario;

  delete from public.addresses where user_id = v_usuario;
  delete from public.favorites where user_id = v_usuario;
  delete from public.product_favorites where user_id = v_usuario;
  delete from public.push_subscriptions where user_id = v_usuario;

  update public.profiles
  set full_name = null,
      phone = null,
      birth_date = null,
      avatar_url = null
  where id = v_usuario;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.borrar_mis_datos() from public, anon;
grant execute on function public.borrar_mis_datos() to authenticated;
