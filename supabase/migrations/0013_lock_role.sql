-- Nadie se cambia el rol a sí mismo.
--
-- La política "perfil propio: actualizar" permite escribir la propia fila, y
-- cuando se agregó la columna role quedó incluida sin querer: cualquier cliente
-- podía correr `update profiles set role = 'dev'` desde la consola del
-- navegador y entrar al panel de administración.
--
-- RLS elige filas, no columnas. Los permisos por columna sí.
--
-- Correr en Supabase → SQL Editor. Es idempotente.

revoke update on public.profiles from authenticated;

grant update (full_name, birth_date, phone) on public.profiles to authenticated;

-- El rol se cambia solo desde el SQL editor, con la service key, o por un
-- admin desde el panel más adelante.
