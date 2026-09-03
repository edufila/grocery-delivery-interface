-- Los mensajes de error de estas funciones llegan tal cual a la pantalla del
-- panel de administración, y estaban escritos en voseo. La app habla en
-- español neutro, así que aquí también.
--
-- Solo cambia el texto: la lógica queda idéntica.

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

  update public.profiles set role = p_role where id = p_user;
  return found;
end;
$$;

create or replace function public.admin_set_handle(p_user uuid, p_handle text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := nullif(lower(trim(p_handle)), '');
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tienes permiso para asignar un @';
  end if;

  if v_handle is not null and v_handle !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'El @ va de 3 a 20 caracteres, en minúsculas, sin espacios';
  end if;

  if v_handle is not null and exists (
    select 1 from public.profiles where handle = v_handle and id <> p_user
  ) then
    raise exception 'Ese @ ya está tomado';
  end if;

  update public.profiles set handle = v_handle where id = p_user;
  return found;
end;
$$;

create or replace function public.admin_set_identity(
  p_user uuid,
  p_full_name text,
  p_avatar_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tienes permiso para cambiar esto';
  end if;

  update public.profiles
  set full_name = nullif(trim(p_full_name), ''),
      avatar_url = nullif(trim(p_avatar_url), '')
  where id = p_user;

  return found;
end;
$$;
