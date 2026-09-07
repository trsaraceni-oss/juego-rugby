-- Rugby Board · corrección 2: set ups y jugadas en tres niveles
--
--   global    los que vienen con la app. Los edita el administrador del producto
--             y los ve cualquier entrenador, de cualquier club.
--   club      la base del club. La deja el dueño o un admin del club, y la ven
--             todos sus entrenadores.
--   personal  el trabajo de cada entrenador, que nadie más ve ni toca.
--
-- Cada nivel se apoya en el anterior: el entrenador abre el set up del club, y
-- si no hay, el global; guarda su versión y esa pasa a ser la suya, sin tocar
-- las de abajo.
--
-- Supabase > SQL Editor > pegar > Run. Se puede correr más de una vez.

-- 1. quién es quién ---------------------------------------------------------

alter table profiles add column if not exists is_admin boolean not null default false;

-- el club suma el rol de admin, que puede publicar la base del club
alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('owner', 'admin', 'coach'));

-- 2. el nivel de cada set up y de cada jugada --------------------------------

alter table setups add column if not exists scope text not null default 'personal';
alter table setups add column if not exists club_id uuid references clubs(id) on delete cascade;
alter table setups drop constraint if exists setups_scope_check;
alter table setups add constraint setups_scope_check check (scope in ('global', 'club', 'personal'));

alter table plays add column if not exists scope text not null default 'personal';
alter table plays add column if not exists club_id uuid references clubs(id) on delete cascade;
alter table plays drop constraint if exists plays_scope_check;
alter table plays add constraint plays_scope_check check (scope in ('global', 'club', 'personal'));

-- "compartido" pasa a ser el nivel club, así que la columna vieja sale. Antes hay
-- que soltar lo que dependía de ella: los índices y las políticas que la miraban.
drop index if exists setups_team_idx;
drop index if exists plays_team_idx;
drop policy if exists setups_read on setups;
drop policy if exists setups_write on setups;
drop policy if exists plays_read on plays;
drop policy if exists plays_write on plays;
alter table setups drop column if exists shared;
alter table plays drop column if exists shared;

-- un set up por situación en cada nivel
alter table setups drop constraint if exists setups_owner_id_base_key_key;
drop index if exists setups_base_personal;
drop index if exists setups_base_club;
drop index if exists setups_base_global;
create unique index setups_base_personal on setups (owner_id, base_key)
  where scope = 'personal' and base_key is not null;
create unique index setups_base_club on setups (club_id, base_key)
  where scope = 'club' and base_key is not null;
create unique index setups_base_global on setups (base_key)
  where scope = 'global' and base_key is not null;

create index if not exists setups_scope_idx on setups (scope);
create index if not exists plays_scope_idx on plays (scope);

-- 3. permisos ---------------------------------------------------------------

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function is_club_admin(club uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.club_id = club and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;

-- ve: todo lo global, la base de sus clubes, y lo suyo
drop policy if exists setups_read on setups;
create policy setups_read on setups for select using (
  scope = 'global'
  or (scope = 'club' and is_club_member(club_id))
  or owner_id = auth.uid()
);

-- escribe: el admin del producto lo global, el admin del club la base del club,
-- y cada entrenador lo suyo
drop policy if exists setups_write on setups;
drop policy if exists setups_insert on setups;
drop policy if exists setups_update on setups;
drop policy if exists setups_delete on setups;

create policy setups_insert on setups for insert with check (
  owner_id = auth.uid() and (
    (scope = 'personal')
    or (scope = 'club' and is_club_admin(club_id))
    or (scope = 'global' and is_admin())
  )
);
create policy setups_update on setups for update using (
  (scope = 'personal' and owner_id = auth.uid())
  or (scope = 'club' and is_club_admin(club_id))
  or (scope = 'global' and is_admin())
) with check (
  (scope = 'personal' and owner_id = auth.uid())
  or (scope = 'club' and is_club_admin(club_id))
  or (scope = 'global' and is_admin())
);
create policy setups_delete on setups for delete using (
  (scope = 'personal' and owner_id = auth.uid())
  or (scope = 'club' and is_club_admin(club_id))
  or (scope = 'global' and is_admin())
);

drop policy if exists plays_read on plays;
create policy plays_read on plays for select using (
  scope = 'global'
  or (scope = 'club' and is_club_member(club_id))
  or owner_id = auth.uid()
);

drop policy if exists plays_write on plays;
drop policy if exists plays_insert on plays;
drop policy if exists plays_update on plays;
drop policy if exists plays_delete on plays;

create policy plays_insert on plays for insert with check (
  owner_id = auth.uid() and (
    (scope = 'personal')
    or (scope = 'club' and is_club_admin(club_id))
    or (scope = 'global' and is_admin())
  )
);
create policy plays_update on plays for update using (
  (scope = 'personal' and owner_id = auth.uid())
  or (scope = 'club' and is_club_admin(club_id))
  or (scope = 'global' and is_admin())
) with check (
  (scope = 'personal' and owner_id = auth.uid())
  or (scope = 'club' and is_club_admin(club_id))
  or (scope = 'global' and is_admin())
);
create policy plays_delete on plays for delete using (
  (scope = 'personal' and owner_id = auth.uid())
  or (scope = 'club' and is_club_admin(club_id))
  or (scope = 'global' and is_admin())
);

grant execute on function is_admin() to authenticated;
grant execute on function is_club_admin(uuid) to authenticated;

-- 4. designar admins del club ------------------------------------------------

-- El dueño del club asciende o baja a un entrenador. Devuelve el rol que quedó.
create or replace function set_club_role(club uuid, member uuid, new_role text)
returns text language plpgsql security definer set search_path = public as $$
declare soy text;
begin
  select role into soy from memberships where club_id = club and user_id = auth.uid();
  if soy is null or soy <> 'owner' then raise exception 'Sólo el dueño del club cambia los roles'; end if;
  if new_role not in ('admin', 'coach') then raise exception 'Rol inválido'; end if;
  if member = auth.uid() then raise exception 'El dueño no puede cambiarse el rol a sí mismo'; end if;
  update memberships set role = new_role where club_id = club and user_id = member;
  return new_role;
end $$;

grant execute on function set_club_role(uuid, uuid, text) to authenticated;
