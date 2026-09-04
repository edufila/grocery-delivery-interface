-- Corrige la 0030, que no hizo nada.
--
-- La 0030 decía:
--
--   revoke select (instructions) on public.payment_methods from anon;
--
-- y eso, en Postgres, no sirve cuando el rol ya tiene SELECT sobre la tabla
-- entera: revocar por columna solo quita permisos concedidos por columna. El
-- permiso de tabla sigue cubriéndolas todas, incluida esa.
--
-- Se vio midiendo: anon pedía `instructions` y recibía 200 en vez de "permiso
-- denegado". Como todavía no hay datos cargados el valor venía nulo, así que
-- de no haberlo comprobado contra la base habría parecido que funcionaba.
--
-- La forma correcta es al revés: se quita el permiso de la tabla y se vuelve a
-- conceder columna por columna, dejando `instructions` afuera.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

revoke select on public.payment_methods from anon;

grant select (
  id,
  label,
  hint,
  needs_reference,
  active,
  sort_order,
  updated_at
) on public.payment_methods to anon;

-- Quien inició sesión sí ve a dónde pagar: es lo que necesita para pagar.
grant select on public.payment_methods to authenticated;
