-- Gestión de usuarios desde el panel: dar y quitar el rol de shopper, y
-- asignarles un @ estable.
--
-- El rol no se puede escribir por update (los permisos por columna lo impiden,
-- que es lo que evita que alguien se ascienda solo). Se cambia por estas
-- funciones, que verifican quién llama antes de tocar nada.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- Copia del correo para poder listar gente en el panel: auth.users no se lee
-- desde la API, y sin el correo no hay forma de saber a quién le estás dando
-- el rol.
alter table public.profiles add column if not exists email text;

-- El @ del shopper: corto, único, estable, y lo pone la empresa.
alter table public.profiles add column if not exists handle text;

do $$
begin
  alter table public.profiles
    add constraint profiles_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists profiles_handle_unique on public.profiles (handle)
  where handle is not null;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Que los nuevos también lo traigan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    nullif(
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------ lectura

drop policy if exists "perfiles: admin lee todo" on public.profiles;
create policy "perfiles: admin lee todo"
  on public.profiles for select
  using (public.has_role(array['admin', 'dev']));

-- ------------------------------------------------------------ escritura

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['admin', 'dev']) then
    raise exception 'No tenés permiso para cambiar roles';
  end if;

  if p_role not in ('cliente', 'shopper', 'admin', 'dev') then
    raise exception 'Rol desconocido';
  end if;

  -- Nadie se saca a sí mismo el permiso y queda afuera del panel.
  if p_user = (select auth.uid()) and p_role not in ('admin', 'dev') then
    raise exception 'No podés quitarte tu propio acceso';
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
    raise exception 'No tenés permiso para asignar un @';
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

revoke execute on function public.admin_set_role(uuid, text) from public, anon;
revoke execute on function public.admin_set_handle(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_handle(uuid, text) to authenticated;
