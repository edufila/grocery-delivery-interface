-- La identidad con la que el cliente reconoce a su shopper la pone la empresa.
--
-- Hasta ahora el shopper podía editar su propio nombre, y la foto salía de su
-- cuenta de Google. Si el cliente va a ver quién le toca la puerta, ese nombre
-- y esa foto tienen que ser confiables.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.profiles add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Foto que ve el cliente. La carga un admin: no está entre las columnas que el propio usuario puede escribir.';

-- Los permisos por columna dejan que cualquiera edite su full_name, y para un
-- shopper eso no puede ser. Como no se puede condicionar un permiso al rol,
-- va un disparador.
create or replace function public.protect_shopper_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'shopper'
     and new.full_name is distinct from old.full_name
     and not public.has_role(array['admin', 'dev'])
  then
    raise exception 'El nombre de un shopper lo asigna la empresa';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
  before update on public.profiles
  for each row execute function public.protect_shopper_identity();

-- Con qué nombre y foto sale el shopper.
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
    raise exception 'No tenés permiso para cambiar esto';
  end if;

  update public.profiles
  set full_name = nullif(trim(p_full_name), ''),
      avatar_url = nullif(trim(p_avatar_url), '')
  where id = p_user;

  return found;
end;
$$;

revoke execute on function public.admin_set_identity(uuid, text, text) from public, anon;
grant execute on function public.admin_set_identity(uuid, text, text) to authenticated;

-- ------------------------------------------------ el cliente ve a su shopper

-- Devuelve solo lo que el cliente necesita saber. No expone teléfono, correo
-- ni fecha de nacimiento, que es lo que pasaría con una política de lectura
-- sobre la fila entera.
create or replace function public.order_shopper(p_order_id uuid)
returns table (full_name text, avatar_url text, handle text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.avatar_url, p.handle
  from public.orders o
  join public.profiles p on p.id = o.shopper_id
  where o.id = p_order_id
    and o.user_id = (select auth.uid());
$$;

revoke execute on function public.order_shopper(uuid) from public, anon;
grant execute on function public.order_shopper(uuid) to authenticated;
