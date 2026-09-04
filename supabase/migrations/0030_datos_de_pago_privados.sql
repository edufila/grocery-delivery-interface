-- Que los datos de pago no los pueda leer cualquiera.
--
-- La tabla payment_methods se lee sin sesión, porque el checkout necesita
-- listar las opciones. Pero la columna `instructions` es distinta: ahí va el
-- teléfono, el banco y la cédula de quien cobra.
--
-- Mientras se prueba con una cuenta personal, eso es el número y el documento
-- de una persona, y estaba al alcance de cualquiera que le pegara a la API.
-- Que un negocio publique a dónde pagarle es normal; que el dato de una
-- persona quede raspable por un script, no.
--
-- Con permiso por columna alcanza: RLS decide a qué filas se llega, no qué
-- campos. Y anon y authenticated son roles distintos de la base, así que la
-- distinción funciona.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

revoke select (instructions) on public.payment_methods from anon;
grant select (instructions) on public.payment_methods to authenticated;
