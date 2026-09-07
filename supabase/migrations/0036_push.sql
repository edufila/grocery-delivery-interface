-- Notificaciones que llegan con la app cerrada.
--
-- Hasta ahora los avisos sonaban solo con la pantalla abierta: era el propio
-- navegador reaccionando a un cambio. Sirve para el turno de guardia, pero no
-- para enterarse de un pedido mientras uno hace otra cosa.
--
-- Push funciona al revés: el navegador le da a la app una dirección suya, y
-- después el servidor le manda el aviso a esa dirección aunque no haya nadie
-- mirando. Aquí se guardan esas direcciones.
--
-- Cada navegador de cada persona tiene la suya, así que alguien con teléfono y
-- computadora aparece dos veces, y está bien: quiere que le suene en las dos.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create table if not exists public.push_subscriptions (
  -- La dirección que da el navegador es única e identifica la suscripción.
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Las dos claves con las que el servicio de push cifra el aviso.
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_por_usuario_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada quien administra las suyas. Quien manda los avisos entra con la llave
-- de servicio, que se salta RLS.
drop policy if exists "push: propias" on public.push_subscriptions;
create policy "push: propias" on public.push_subscriptions for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/**
 * Qué aviso tiene pendiente quien pregunta.
 *
 * El golpe de push viaja sin contenido a propósito: mandarlo con texto obliga a
 * cifrarlo con el esquema del navegador, que es fácil de equivocar y falla en
 * silencio. Así el service worker recibe el golpe, llama a esta función, y ella
 * le dice qué mostrar sabiendo quién es por su sesión.
 *
 * Devuelve titulo nulo cuando no hay nada: entonces el service worker muestra
 * un aviso genérico en vez de mentir con un número.
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
    where shopper_id is null and status = 'confirmado';
  end if;

  if v_rol in ('admin', 'dev') then
    select count(*) into v_pagos
    from public.orders
    where payment_reported_at is not null and payment_verified_at is null;
  end if;

  -- El pago primero: hay dinero esperando que alguien lo confirme.
  if v_pagos > 0 then
    return jsonb_build_object(
      'titulo', 'Pago reportado',
      'cuerpo', case when v_pagos = 1
        then 'Un cliente dice haber pagado. Toca para revisarlo.'
        else v_pagos || ' pagos esperan que los revises.' end,
      'url', '/admin'
    );
  end if;

  if v_pedidos > 0 then
    return jsonb_build_object(
      'titulo', 'Pedido nuevo',
      'cuerpo', case when v_pedidos = 1
        then 'Hay un pedido esperando shopper.'
        else v_pedidos || ' pedidos esperando shopper.' end,
      'url', '/shopper'
    );
  end if;

  return jsonb_build_object('titulo', null);
end;
$$;

revoke execute on function public.avisos_pendientes() from public, anon;
grant execute on function public.avisos_pendientes() to authenticated;
