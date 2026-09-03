-- Bucket para las fotos: tiendas, productos y shoppers.
--
-- Así se suben desde el panel en vez de commitear el archivo y desplegar, que
-- es un embudo para un abasto que cambia productos seguido.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos',
  'fotos',
  true,                                    -- las fotos se ven sin haber entrado
  3145728,                                 -- 3 MB: más que eso es una foto sin redimensionar
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Cualquiera las ve: son las fotos del catálogo y del inicio.
drop policy if exists "fotos: leer" on storage.objects;
create policy "fotos: leer"
  on storage.objects for select
  using (bucket_id = 'fotos');

-- Solo admin y dev suben, reemplazan o borran.
drop policy if exists "fotos: admin sube" on storage.objects;
create policy "fotos: admin sube"
  on storage.objects for insert
  with check (bucket_id = 'fotos' and public.has_role(array['admin', 'dev']));

drop policy if exists "fotos: admin reemplaza" on storage.objects;
create policy "fotos: admin reemplaza"
  on storage.objects for update
  using (bucket_id = 'fotos' and public.has_role(array['admin', 'dev']))
  with check (bucket_id = 'fotos' and public.has_role(array['admin', 'dev']));

drop policy if exists "fotos: admin borra" on storage.objects;
create policy "fotos: admin borra"
  on storage.objects for delete
  using (bucket_id = 'fotos' and public.has_role(array['admin', 'dev']));
