-- Que un pedido que nadie paga no se quede callado.
--
-- La 0037 hizo que el pedido espere el pago antes de salir a buscar shopper, y
-- que reportar el pago le suene a admin y dev. Faltaba el caso de en medio: el
-- cliente pide, no paga, y no reporta nada.
--
-- Ahí no le suena a nadie, porque no hay nada que verificar. El pedido se queda
-- detenido en silencio hasta que alguien se acuerde de mirar la lista entera.
-- Y detrás de cada uno hay una persona: puede que pagara y no supiera dónde
-- poner la referencia, o que se arrepintiera y esté ocupando un monto reservado
-- que ningún otro pedido puede usar.
--
-- Va al final de las prioridades a propósito. Un pago reportado es urgente --
-- hay dinero esperando y un cliente mirando el teléfono. Esto no: aquí no hay
-- nada que confirmar, hay a quién preguntarle.
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

    /**
     * Solo los de más de veinte minutos.
     *
     * Un pedido recién hecho SIEMPRE está sin pagar: la persona está mirando
     * la pantalla de pago en ese mismo momento. Avisar ahí sería avisar de
     * todos los pedidos, siempre, y un aviso que suena siempre deja de
     * significar algo. Veinte minutos es tiempo de sobra para hacer un pago
     * móvil y escribir la referencia.
     */
    select count(*) into v_sin_pagar
    from public.orders
    where payment_required
      and payment_reported_at is null
      and payment_verified_at is null
      and status not in ('cancelado', 'entregado')
      and created_at < now() - interval '20 minutes';
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
