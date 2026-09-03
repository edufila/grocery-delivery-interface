-- Fuera la calificación y las reseñas de las tiendas.
--
-- Vinieron con la plantilla, que era de restaurantes. Un abasto vende
-- productos sellados de marca: no hay nada que puntuar, la lata de atún es la
-- misma en los dos locales. Y mientras tanto el cliente veía "4.8 (2.4k)",
-- dos mil cuatrocientas reseñas que nunca existieron.
--
-- Se borran las columnas, no solo su contenido: dejarlas vacías es una
-- invitación a volver a llenarlas.

alter table public.stores drop column if exists rating;
alter table public.stores drop column if exists reviews;
