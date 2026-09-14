-- 0046 · Buscar productos sin importar los acentos.
--
-- Explorar -- a donde cae el buscador del inicio -- busca con `ilike` sobre el
-- nombre, y `ilike` distingue acentos: "cafe" no encontraba "Café Molido", ni
-- "azucar" la "Azúcar Refinada". En el teléfono casi nadie escribe acentos, así
-- que la persona veía "No encontramos" con el producto cargado.
--
-- El catálogo de un abasto ya lo resolvía en la pantalla (lib/texto.ts). Aquí
-- tiene que ser la base, porque Explorar busca en todos los abastos a la vez y
-- no trae el catálogo entero al teléfono para filtrarlo.
--
-- Cómo: una columna calculada con el nombre en minúsculas y sin acentos, que
-- la base mantiene sola al crear o editar un producto. El código busca en ella
-- si existe, y en `name` si esta migración todavía no se corrió.
--
-- La ñ se conserva, igual que en la pantalla: "piña" no es "pina". `unaccent`
-- la convertiría en n, así que se aparta antes con un carácter de control que
-- ningún nombre trae, y se devuelve después.
--
-- Idempotente.

create extension if not exists unaccent with schema extensions;

create or replace function public.sin_acentos(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select replace(
    extensions.unaccent(
      'extensions.unaccent'::regdictionary,
      replace(lower(coalesce(p_texto, '')), 'ñ', chr(1))
    ),
    chr(1),
    'ñ'
  );
$$;

-- Supabase concede execute a anon en cada función nueva. Esta solo la usa la
-- columna calculada, que se evalúa al escribir un producto -- y escribir es de
-- admin y dev --, así que anon no la necesita.
revoke execute on function public.sin_acentos(text) from public, anon;
grant execute on function public.sin_acentos(text) to authenticated, service_role;

alter table public.products
  add column if not exists nombre_busqueda text
  generated always as (public.sin_acentos(name)) stored;

-- Para confirmar: las dos columnas tienen que verse iguales salvo acentos y
-- mayúsculas.
select name, nombre_busqueda from public.products order by name limit 10;
