-- Avisar cuando la tasa se quedó vieja.
--
-- La 0039 trae la tasa del BCV sola una vez al día, y la app le dice al cliente
-- de cuándo es la que está usando. Lo que faltaba es que el abasto se entere.
--
-- Si la corrida automática se rompe -- se venció el token, cambió la fuente, se
-- cayó -- no pasa nada visible: la app sigue cobrando, con la última tasa que
-- se pudo traer. Cada pedido se cotiza un poco más barato que el anterior, y
-- eso no se nota mirando la pantalla. Se nota cuando las cuentas del mes no dan.
--
-- Dos días y no uno: el cron corre una vez al día, así que una sola falla es
-- ruido normal. Dos seguidas ya es que está roto.
--
-- Va después de lo que tiene a un cliente esperando -- un pago por confirmar,
-- un pedido pagado sin shopper -- y antes de lo que solo pide una llamada.
-- Cuesta plata en silencio, pero nadie está parado esperando por ello.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

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
  v_sin_pagar int := 0;
  v_tasa_de timestamptz;
  v_dias int;
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

    -- Solo los de más de veinte minutos: uno recién hecho SIEMPRE está sin
    -- pagar, porque la persona está mirando la pantalla de pago en ese momento.
    select count(*) into v_sin_pagar
    from public.orders
    where payment_required
      and payment_reported_at is null
      and payment_verified_at is null
      and status not in ('cancelado', 'entregado')
      and created_at < now() - interval '20 minutes';

    select rate_ves_updated_at into v_tasa_de
    from public.settings where id = 'global';
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

  if v_tasa_de is not null and v_tasa_de < now() - interval '2 days' then
    v_dias := greatest(1, (extract(epoch from now() - v_tasa_de) / 86400)::int);

    return jsonb_build_object(
      'titulo', 'La tasa está vieja',
      'cuerpo', 'Lleva ' || v_dias || ' días sin actualizarse y se está cobrando con ella. Cárgala a mano en Tarifas.',
      'url', '/admin'
    );
  end if;

  if v_sin_pagar > 0 then
    return jsonb_build_object(
      'titulo', 'Pedido sin pagar',
      'cuerpo', case when v_sin_pagar = 1
        then 'Alguien pidió hace rato y no ha pagado. Quizá convenga escribirle.'
        else v_sin_pagar || ' pedidos llevan rato detenidos sin pago.' end,
      'url', '/admin'
    );
  end if;

  return jsonb_build_object('titulo', null);
end;
$$;

revoke execute on function public.avisos_pendientes() from public, anon;
grant execute on function public.avisos_pendientes() to authenticated;
