-- Perfil de cada usuario registrado.
-- Correr entero en Supabase → SQL Editor. Es idempotente: se puede repetir.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  birth_date date,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos de registro de cada usuario. Una fila por usuario de auth.';

-- Row Level Security: sin esto, cualquiera con la anon key lee todo.
alter table public.profiles enable row level security;

drop policy if exists "perfil propio: leer" on public.profiles;
create policy "perfil propio: leer"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "perfil propio: crear" on public.profiles;
create policy "perfil propio: crear"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "perfil propio: actualizar" on public.profiles;
create policy "perfil propio: actualizar"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Mantiene updated_at al día sin que la app tenga que acordarse.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Al registrarse un usuario le creamos la fila. Si entró con Google,
-- aprovechamos el nombre que ya nos dio.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        ''
      ),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Para los usuarios que ya existían antes de crear la tabla.
insert into public.profiles (id, full_name)
select
  u.id,
  nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), '')
from auth.users u
on conflict (id) do nothing;
