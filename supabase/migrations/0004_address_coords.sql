-- Coordenadas de las direcciones, para poder ubicarlas en el mapa.
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.addresses add column if not exists lat double precision;
alter table public.addresses add column if not exists lng double precision;

comment on column public.addresses.lat is
  'Tomada del GPS del teléfono al guardar la dirección. Puede ser null: no todos aceptan el permiso.';

-- El pedido se lleva una copia, igual que el resto de la dirección: si después
-- la corrigen o la borran, el pedido tiene que seguir apuntando a donde fue.
alter table public.orders add column if not exists address_lat double precision;
alter table public.orders add column if not exists address_lng double precision;
