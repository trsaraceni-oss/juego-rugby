-- Rugby Board · corrección 1 sobre el esquema inicial
--
-- Al escribir la pantalla de cuerpo técnico aparecieron dos faltantes:
--   1. el perfil no guardaba el mail, que está en auth.users y el navegador no puede leer;
--   2. cada entrenador sólo podía ver su propio perfil, así que la lista del club
--      salía sin nombres.
--
-- Supabase > SQL Editor > pegar > Run. Se puede correr más de una vez sin problema.

-- 1. el mail en el perfil ---------------------------------------------------

alter table profiles add column if not exists email text;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- los que ya se hayan registrado antes de esta corrección
update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- 2. ver el perfil de los compañeros de club --------------------------------

create or replace function shares_club(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from memberships mine
    join memberships theirs on theirs.club_id = mine.club_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

drop policy if exists profiles_self on profiles;
drop policy if exists profiles_read on profiles;
drop policy if exists profiles_write on profiles;

-- lectura: el propio y el de quienes comparten club
create policy profiles_read on profiles for select using (id = auth.uid() or shares_club(id));
-- escritura: sólo el propio
create policy profiles_write on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert on profiles for insert with check (id = auth.uid());

grant execute on function shares_club(uuid) to authenticated;
