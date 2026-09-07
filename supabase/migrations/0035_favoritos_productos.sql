-- Marcar productos como habituales.
--
-- Ya se podían marcar abastos favoritos, pero no productos. Y en un abasto uno
-- compra casi lo mismo todas las semanas: harina, arroz, café. Tener esos a un
-- toque es la diferencia entre volver a pedir y no hacerlo.
--
-- Se guarda en la cuenta y no en el teléfono a propósito: la lista de lo que
-- uno compra siempre debe seguir a la persona cuando cambia de equipo.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

create table if not exists public.product_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sin llave foránea a products: si el abasto borra un producto, el favorito
  -- se queda sin estorbar y deja de mostrarse solo. Una foránea obligaría a
  -- decidir entre borrarlo en cascada o impedir borrar el producto.
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists favoritos_producto_usuario_idx
  on public.product_favorites (user_id, created_at desc);

alter table public.product_favorites enable row level security;

-- Cada quien ve y toca los suyos, y nada más.
drop policy if exists "favoritos: propios" on public.product_favorites;
create policy "favoritos: propios" on public.product_favorites for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
