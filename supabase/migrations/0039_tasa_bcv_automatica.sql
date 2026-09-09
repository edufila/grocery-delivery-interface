-- La tasa de bolívares dejaba de ser fiable apenas el admin se olvidaba de
-- cargarla un día. Ahora se trae sola del BCV una vez al día; el campo que
-- carga el panel a mano sigue existiendo como respaldo, y manda hasta que la
-- próxima corrida automática lo vuelva a pisar.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente.

alter table public.settings add column if not exists rate_ves_updated_at timestamptz;
alter table public.settings add column if not exists rate_ves_source text;

comment on column public.settings.rate_ves_updated_at is
  'Cuándo se cargó la tasa vigente, sea automática o a mano. Sirve para avisar si quedó vieja.';

comment on column public.settings.rate_ves_source is
  '''bcv'' si la trajo sola la corrida diaria, ''manual'' si la escribió un admin.';

do $$
begin
  alter table public.settings
    add constraint settings_rate_ves_source_check
    check (rate_ves_source is null or rate_ves_source in ('bcv', 'manual'));
exception
  when duplicate_object then null;
end
$$;
