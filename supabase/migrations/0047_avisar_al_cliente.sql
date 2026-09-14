-- 0047 · Que al cliente también le llegue cuando su pedido avanza.
--
-- Las notificaciones con la app cerrada solo despertaban al equipo: pago por
-- verificar, pedido listo, tasa vieja. Al cliente no le llegaba nada. Para
-- saber si ya habían confirmado su pago, si ya estaban comprando o si ya venía,
-- tenía que acordarse de abrir la app -- justo lo que una notificación evita.
--
-- Ahora el shopper, al avanzar el pedido, y admin o dev, al confirmar el pago,
-- tocan la puerta del teléfono del dueño (/api/avisar, motivo estado-cliente).
-- El golpe llega sin texto y el teléfono pregunta aquí qué mostrar; esta es la
-- misma función de la 0041 con un caso más al final: el último pedido propio
-- que cambió en los últimos quince minutos, dicho según en qué va.
--
-- Va al final y no al principio: para admin, dev y shopper lo del trabajo sigue
-- mandando. Un cliente no tiene nada de lo de arriba, así que a él le toca esto.
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
  v_mio record;
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

  -- ------------------------------------------------ lo que espera el cliente

  select code, status, shopper_id, payment_verified_at
    into v_mio
  from public.orders
  where user_id = v_usuario
    and status <> 'cancelado'
    and updated_at > now() - interval '15 minutes'
  order by updated_at desc
  limit 1;

  if found then
    if v_mio.status = 'entregado' then
      return jsonb_build_object(
        'titulo', '¡Llegó tu pedido!',
        'cuerpo', 'Que lo disfrutes. Gracias por comprar con nosotros.',
        'url', '/pedidos/' || v_mio.code
      );
    elsif v_mio.status = 'en_camino' then
      return jsonb_build_object(
        'titulo', 'Tu pedido va en camino',
        'cuerpo', 'Tu shopper salió con tu compra. Mira por dónde viene.',
        'url', '/pedidos/' || v_mio.code
      );
    elsif v_mio.status = 'preparando' then
      return jsonb_build_object(
        'titulo', 'Están comprando tu pedido',
        'cuerpo', 'Tu shopper ya está en el abasto buscando lo tuyo.',
        'url', '/pedidos/' || v_mio.code
      );
    elsif v_mio.status = 'confirmado' and v_mio.shopper_id is not null then
      return jsonb_build_object(
        'titulo', 'Ya tienes shopper',
        'cuerpo', 'Alguien tomó tu pedido y en breve empieza a comprar.',
        'url', '/pedidos/' || v_mio.code
      );
    elsif v_mio.status = 'confirmado' and v_mio.payment_verified_at is not null then
      return jsonb_build_object(
        'titulo', 'Confirmamos tu pago',
        'cuerpo', 'Tu pedido ya está buscando quién haga tu compra.',
        'url', '/pedidos/' || v_mio.code
      );
    end if;
  end if;

  return jsonb_build_object('titulo', null);
end;
$$;

revoke execute on function public.avisos_pendientes() from public, anon;
grant execute on function public.avisos_pendientes() to authenticated;
