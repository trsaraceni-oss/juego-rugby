-- Rugby Board · esquema de la base (Supabase / Postgres)
--
-- Estructura: club > equipos > entrenadores. Cada entrenador es dueño de sus
-- set ups y jugadas, y decide cuáles publica al equipo. Nadie edita lo de otro.
--
-- Para instalarlo: Supabase > SQL Editor > pegar todo > Run.

-- ---------------------------------------------------------------- perfiles

create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text,
  created_at  timestamptz not null default now()
);

-- al registrarse queda el perfil creado solo
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------ club y equipos

create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,           -- código para sumarse al club
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,                  -- Primera, M19, Femenino
  created_at  timestamptz not null default now(),
  unique (club_id, name)
);

create table if not exists memberships (
  club_id     uuid not null references clubs(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'coach' check (role in ('owner', 'coach')),
  created_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- un entrenador puede trabajar sólo en algunos equipos del club
create table if not exists team_members (
  team_id     uuid not null references teams(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ------------------------------------------------------- set ups y jugadas

-- base_key: 'line5' cuando es la versión propia de un set up de fábrica;
-- null cuando el entrenador lo creó desde cero.
create table if not exists setups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  team_id     uuid references teams(id) on delete set null,
  shared      boolean not null default false,
  base_key    text,
  name        text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (owner_id, base_key)
);

create table if not exists plays (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  team_id     uuid references teams(id) on delete set null,
  shared      boolean not null default false,
  name        text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists setups_owner_idx on setups (owner_id);
create index if not exists setups_team_idx  on setups (team_id) where shared;
create index if not exists plays_owner_idx  on plays (owner_id);
create index if not exists plays_team_idx   on plays (team_id) where shared;

-- --------------------------------------------------------------- permisos

-- Las políticas no pueden consultar tablas que a su vez tienen políticas: se
-- resuelve con funciones security definer, que leen sin pasar por RLS.

create or replace function is_club_member(club uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from memberships m where m.club_id = club and m.user_id = auth.uid());
$$;

create or replace function is_team_member(team uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from team_members t where t.team_id = team and t.user_id = auth.uid());
$$;

create or replace function my_team_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select team_id from team_members where user_id = auth.uid();
$$;

alter table profiles     enable row level security;
alter table clubs        enable row level security;
alter table teams        enable row level security;
alter table memberships  enable row level security;
alter table team_members enable row level security;
alter table setups       enable row level security;
alter table plays        enable row level security;

-- perfiles: cada uno el suyo
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- clubes: los ve quien es miembro; los crea cualquiera autenticado
drop policy if exists clubs_read on clubs;
create policy clubs_read on clubs for select using (is_club_member(id));
drop policy if exists clubs_insert on clubs;
create policy clubs_insert on clubs for insert with check (created_by = auth.uid());
drop policy if exists clubs_update on clubs;
create policy clubs_update on clubs for update using (
  exists (select 1 from memberships m where m.club_id = clubs.id and m.user_id = auth.uid() and m.role = 'owner')
);

-- equipos: los ve quien está en el club
drop policy if exists teams_read on teams;
create policy teams_read on teams for select using (is_club_member(club_id));
drop policy if exists teams_write on teams;
create policy teams_write on teams for all using (is_club_member(club_id)) with check (is_club_member(club_id));

-- membresías: cada uno ve las del club al que pertenece y se suma a sí mismo
drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships for select using (is_club_member(club_id));
drop policy if exists memberships_join on memberships;
create policy memberships_join on memberships for insert with check (user_id = auth.uid());
drop policy if exists memberships_leave on memberships;
create policy memberships_leave on memberships for delete using (user_id = auth.uid());

drop policy if exists team_members_read on team_members;
create policy team_members_read on team_members for select using (
  user_id = auth.uid() or exists (select 1 from teams t where t.id = team_id and is_club_member(t.club_id))
);
drop policy if exists team_members_join on team_members;
create policy team_members_join on team_members for insert with check (
  user_id = auth.uid() and exists (select 1 from teams t where t.id = team_id and is_club_member(t.club_id))
);
drop policy if exists team_members_leave on team_members;
create policy team_members_leave on team_members for delete using (user_id = auth.uid());

-- set ups y jugadas: propios siempre; ajenos sólo si están compartidos a un
-- equipo del que también formo parte. Escribe únicamente el dueño.
drop policy if exists setups_read on setups;
create policy setups_read on setups for select using (
  owner_id = auth.uid() or (shared and team_id in (select my_team_ids()))
);
drop policy if exists setups_write on setups;
create policy setups_write on setups for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists plays_read on plays;
create policy plays_read on plays for select using (
  owner_id = auth.uid() or (shared and team_id in (select my_team_ids()))
);
drop policy if exists plays_write on plays;
create policy plays_write on plays for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------- sumarse a un club

-- Con el código de invitación: crea la membresía y devuelve el club.
create or replace function join_club(code text)
returns clubs language plpgsql security definer set search_path = public as $$
declare c clubs;
begin
  select * into c from clubs where join_code = upper(trim(code));
  if not found then raise exception 'Código de club inválido'; end if;
  insert into memberships (club_id, user_id, role) values (c.id, auth.uid(), 'coach')
    on conflict (club_id, user_id) do nothing;
  return c;
end $$;

-- Crea el club, deja al que lo creó como dueño y arma el primer equipo.
create or replace function create_club(club_name text, first_team text default 'Primera')
returns clubs language plpgsql security definer set search_path = public as $$
declare c clubs; code text;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from clubs where join_code = code);
  end loop;
  insert into clubs (name, join_code, created_by) values (club_name, code, auth.uid()) returning * into c;
  insert into memberships (club_id, user_id, role) values (c.id, auth.uid(), 'owner');
  insert into teams (club_id, name) values (c.id, first_team);
  insert into team_members (team_id, user_id)
    select id, auth.uid() from teams where club_id = c.id;
  return c;
end $$;

-- ------------------------------------------------------------------ grants
-- Supabase ya los aplica por defecto a las tablas nuevas; van explícitos para
-- que el esquema quede completo si se instala en otro Postgres.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
