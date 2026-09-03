-- Separar de verdad los roles admin y dev.
--
-- Hasta ahora eran el mismo rol con dos nombres: TODOS los controles decían
-- has_role(array['admin', 'dev']). Peor que redundante, era engañoso: el panel
-- ofrecía los dos en un desplegable, dando a entender que admin era menos
-- poderoso, cuando en realidad un admin podía ascenderse a dev.
--
-- El corte queda en una sola cosa, las llaves del panel:
--
--   admin (el encargado del abasto)
--     productos, precios, disponibilidad, fotos
--     tiendas, ubicación y costo de envío
--     nombre, foto y @ de los shoppers
--     dar y quitar el rol de shopper
--     borrar pedidos
--
--   dev (los dueños)
--     todo lo anterior
--     dar los roles de admin y dev
--
-- La app esconde lo que un admin no puede hacer, pero quien manda es esto: la
-- pantalla se puede saltar, la base no.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

/**
 * Un admin reparte shoppers; las llaves del panel las reparte un dev.
 *
 * También se cuida el otro lado: un admin no puede tocar a alguien que YA es
 * admin o dev. Sin eso podría degradar a un dev y quedarse solo arriba, que es
 * la misma puerta por otro lado.
 */
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual text;
  v_soy_dev boolean := public.has_role(array['dev']);
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tienes permiso para cambiar roles';
  end if;

  if p_role not in ('cliente', 'shopper', 'admin', 'dev') then
    raise exception 'Rol desconocido';
  end if;

  -- Nadie se saca a sí mismo el permiso y queda afuera del panel.
  if p_user = (select auth.uid()) and p_role not in ('admin', 'dev') then
    raise exception 'No puedes quitarte tu propio acceso';
  end if;

  if not v_soy_dev and p_role in ('admin', 'dev') then
    raise exception 'Los roles de admin y dev los da un dev';
  end if;

  select role into v_actual from public.profiles where id = p_user;

  if not v_soy_dev and v_actual in ('admin', 'dev') then
    raise exception 'No puedes cambiarle el rol a un admin o a un dev';
  end if;

  update public.profiles set role = p_role where id = p_user;
  return found;
end;
$$;

/**
 * Para que el panel sepa qué esconder. Es solo comodidad: quien decide es la
 * función de arriba, no esta.
 */
create or replace function public.soy_dev()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.has_role(array['dev']);
$$;

revoke execute on function public.soy_dev() from public, anon;
grant execute on function public.soy_dev() to authenticated;
