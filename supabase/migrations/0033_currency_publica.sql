-- Que `currency` se vea sin sesión, como el resto de las columnas públicas.
--
-- La 0031 cambió el permiso de payment_methods de "toda la tabla" a columna por
-- columna, para reservar `instructions`. Efecto secundario: toda columna que
-- naciera después queda invisible para anon, y `currency` nació en la 0032.
--
-- Que sea invisible no rompe nada -- la consulta reintenta sin ella -- pero
-- deja un pedido fallido en cada carga y una diferencia sin motivo entre lo que
-- ve un anónimo y lo que ve alguien con sesión. En qué moneda cobra un método
-- no es un dato reservado.
--
-- Vale la pena recordarlo para la próxima: con permisos por columna, agregar
-- una columna no la publica. Hay que concederla.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

grant select (currency) on public.payment_methods to anon;
