-- 0045 · Ningún producto con precio en cero.
--
-- La tabla solo pedía que el precio no fuera negativo (0009), así que cero
-- entraba. Y entraba fácil: el editor del panel convertía un campo vacío en 0,
-- y borrar el precio para escribir otro y guardar a mitad dejaba el producto
-- gratis. `place_order` calcula el total contra el catálogo, así que un pedido
-- con ese producto salía cobrándolo en cero de verdad.
--
-- La pantalla ya lo frena, pero la pantalla no es el único camino: el SQL
-- editor, un script, otra pantalla mañana. La regla va aquí.
--
-- Si un producto no se consigue, lo que corresponde es `in_stock = false`.
--
-- Idempotente. Si hoy hubiera algún producto en cero, la restricción no se
-- podría crear: el bloque avisa cuántos son y cómo verlos, en vez de fallar a
-- medias.

do $$
declare
  v_en_cero int;
begin
  select count(*) into v_en_cero from public.products where price <= 0;

  if v_en_cero > 0 then
    raise exception
      'Hay % producto(s) con precio en cero. Corre: select id, name, store_id from public.products where price <= 0; ponles precio y vuelve a correr esta migración.',
      v_en_cero;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_precio_mayor_que_cero'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_precio_mayor_que_cero check (price > 0);
  end if;
end
$$;

-- Para confirmar que quedó: tiene que devolver una fila.
select conname, pg_get_constraintdef(oid) as regla
from pg_constraint
where conname = 'products_precio_mayor_que_cero';
