-- =============================================================================
-- 0014 · Quitar el nombre de la tienda de los ajustes
-- =============================================================================
-- `settings.store_name` se podía editar desde Ajustes, se guardaba bien... y no
-- lo leía nadie. La cabecera, la pantalla de acceso y el título del navegador
-- siempre escribieron el nombre a mano. Un campo que se guarda sin efecto es
-- peor que no tenerlo: promete algo que no cumple, y quien lo cambia se queda
-- esperando un cambio que nunca llega.
--
-- El nombre pasa a estar fijo en el código y la columna se retira. Una tienda no
-- se cambia de nombre cada temporada; eso no es una regla de operación como el
-- plazo de un apartado o el umbral de poco stock, que sí viven aquí porque se
-- ajustan sobre la marcha.
--
-- `update_settings` pierde su primer parámetro. Eso cambia la firma, y
-- `create or replace` no puede: dejaría DOS funciones con el mismo nombre y las
-- llamadas quedarían ambiguas. Hay que soltarla y volver a crearla. Soltarla
-- también borra sus permisos, así que se vuelven a conceder al final.
-- =============================================================================

drop function if exists public.update_settings(
  text, text, numeric, integer, integer, numeric, integer, integer
);

create or replace function public.update_settings(
  p_timezone                text    default null,
  p_layaway_min_deposit_pct numeric default null,
  p_layaway_term_days       integer default null,
  p_layaway_reminder_days   integer default null,
  p_credit_min_deposit_pct  numeric default null,
  p_credit_reminder_days    integer default null,
  p_low_stock_threshold     integer default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := public.require_admin();
begin
  update public.settings
  set timezone                = coalesce(nullif(btrim(p_timezone), ''), timezone),
      layaway_min_deposit_pct = coalesce(p_layaway_min_deposit_pct, layaway_min_deposit_pct),
      layaway_term_days       = coalesce(p_layaway_term_days, layaway_term_days),
      layaway_reminder_days   = coalesce(p_layaway_reminder_days, layaway_reminder_days),
      credit_min_deposit_pct  = coalesce(p_credit_min_deposit_pct, credit_min_deposit_pct),
      credit_reminder_days    = coalesce(p_credit_reminder_days, credit_reminder_days),
      low_stock_threshold     = coalesce(p_low_stock_threshold, low_stock_threshold),
      updated_by              = v_actor
  where id;
end;
$$;

alter table public.settings drop column if exists store_name;

-- Postgres regala EXECUTE a PUBLIC en cada función nueva, y el revoke masivo de
-- la migración 0010 fue de una sola vez: no cubre a las que nacen después. Se
-- repite aquí para que la puerta quede como el resto.
revoke all on function public.update_settings(
  text, numeric, integer, integer, numeric, integer, integer
) from public, anon;

-- Como el resto de funciones de escritura: el GRANT no es un cheque en blanco,
-- porque `require_admin()` valida la sesión y el rol por dentro.
grant execute on function public.update_settings(
  text, numeric, integer, integer, numeric, integer, integer
) to authenticated;
