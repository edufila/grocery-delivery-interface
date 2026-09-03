-- Habilita que los cambios de orders lleguen en vivo al navegador del cliente,
-- para que el punto del shopper se mueva sin recargar la página.
-- Realtime respeta RLS: cada quien recibe solo los pedidos que puede leer.
--
-- Correr en Supabase → SQL Editor.

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end
$$;
