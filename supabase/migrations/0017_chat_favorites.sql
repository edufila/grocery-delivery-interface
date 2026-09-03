-- Chat real entre cliente y shopper, y favoritos en la cuenta.
--
-- El chat que había vivía en la pantalla: los mensajes se perdían al recargar
-- y el shopper nunca los veía. Los favoritos vivían en localStorage: cambiabas
-- de teléfono y se perdían.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

-- ---------------------------------------------------------------- mensajes

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists order_messages_order_idx
  on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;

-- Solo los dos que están en ese pedido.
drop policy if exists "mensajes: leer" on public.order_messages;
create policy "mensajes: leer"
  on public.order_messages for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and ((select auth.uid()) in (o.user_id, o.shopper_id))
    )
  );

drop policy if exists "mensajes: escribir" on public.order_messages;
create policy "mensajes: escribir"
  on public.order_messages for insert
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and ((select auth.uid()) in (o.user_id, o.shopper_id))
    )
  );

-- Un mensaje enviado no se edita ni se borra: es el registro de lo acordado.
revoke update, delete on public.order_messages from authenticated, anon;

do $$
begin
  alter publication supabase_realtime add table public.order_messages;
exception
  when duplicate_object then null;
end
$$;

-- ---------------------------------------------------------------- favoritos

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id text not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favoritos propios" on public.favorites;
create policy "favoritos propios"
  on public.favorites for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
