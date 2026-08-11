-- =============================================================================
-- 0011 · Correo visible en el perfil
-- =============================================================================
-- NOTA: esta migración ya está aplicada en la base remota. Se ejecutó desde el
-- SQL Editor cuando la CLI no lograba conectar, y el archivo local se perdió al
-- descartar cambios. Se restaura aquí para que el historial local coincida con
-- el remoto; `db push` la verá registrada y no intentará repetirla.
--
-- El correo vive en `auth.users`, que no se expone por la API. Sin él, la
-- pantalla de equipo no puede distinguir a dos personas con nombres parecidos.
-- Se copia a `profiles`, cuya RLS ya limita la lectura a la persona dueña de la
-- fila y a los administradores.
-- =============================================================================

alter table public.profiles
  add column if not exists email text;

-- Cuentas que ya existían antes de esta migración.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- Y de aquí en adelante, en el mismo trigger que crea el perfil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    case when v_is_first then 'admin' else 'seller' end::public.user_role,
    v_is_first
  );

  return new;
end;
$$;

-- Si alguien cambia su correo desde Supabase Auth, el perfil lo sigue.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and email is distinct from new.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.sync_profile_email() to supabase_auth_admin;
  end if;
end;
$$;
