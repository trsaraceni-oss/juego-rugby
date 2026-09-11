-- Rugby Board · corrección 4: la pantalla de administración
--
-- El administrador del producto (profiles.is_admin) pasa a ver y manejar todos
-- los clubes, sus equipos y su cuerpo técnico. Sin esto no puede ni listarlos:
-- las reglas de acceso sólo dejan ver el club del que uno es parte, que es
-- justamente lo que las hace seguras para el resto.
--
-- Nada cambia para un entrenador común: cada agregado es «o es el admin».
--
-- Supabase > SQL Editor > pegar > Run. Se puede correr más de una vez.

-- 1. perfiles: para listar el cuerpo técnico de cualquier club ---------------

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (
  id = auth.uid() or shares_club(id) or is_admin()
);

-- 2. clubes -----------------------------------------------------------------

drop policy if exists clubs_read on clubs;
create policy clubs_read on clubs for select using (is_club_member(id) or is_admin());

drop policy if exists clubs_update on clubs;
create policy clubs_update on clubs for update using (
  is_admin() or exists (
    select 1 from memberships m where m.club_id = clubs.id and m.user_id = auth.uid() and m.role = 'owner'
  )
);

-- borrar un club se lleva puesto todo lo suyo, así que queda para el dueño y el admin
drop policy if exists clubs_delete on clubs;
create policy clubs_delete on clubs for delete using (
  is_admin() or exists (
    select 1 from memberships m where m.club_id = clubs.id and m.user_id = auth.uid() and m.role = 'owner'
  )
);

-- 3. equipos ----------------------------------------------------------------

drop policy if exists teams_read on teams;
create policy teams_read on teams for select using (is_club_member(club_id) or is_admin());

drop policy if exists teams_write on teams;
create policy teams_write on teams for all
  using (is_club_member(club_id) or is_admin())
  with check (is_club_member(club_id) or is_admin());

-- 4. cuerpo técnico ---------------------------------------------------------

drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships for select using (is_club_member(club_id) or is_admin());

-- sacar a alguien del club: uno mismo, el dueño, o el admin
drop policy if exists memberships_leave on memberships;
create policy memberships_leave on memberships for delete using (
  user_id = auth.uid() or is_admin() or exists (
    select 1 from memberships m where m.club_id = memberships.club_id and m.user_id = auth.uid() and m.role = 'owner'
  )
);

-- 5. roles ------------------------------------------------------------------

-- El dueño sigue ascendiendo entrenadores a admin del club. El admin del
-- producto puede además pasar el club a otro dueño, que es lo que hace falta
-- cuando lo crea él y se lo entrega a un entrenador.
create or replace function set_club_role(club uuid, member uuid, new_role text)
returns text language plpgsql security definer set search_path = public as $$
declare soy text; manda boolean;
begin
  select role into soy from memberships where club_id = club and user_id = auth.uid();
  manda := is_admin();
  if not manda and (soy is null or soy <> 'owner') then
    raise exception 'Sólo el dueño del club cambia los roles';
  end if;
  if new_role not in ('owner', 'admin', 'coach') then raise exception 'Rol inválido'; end if;
  if new_role = 'owner' and not manda then raise exception 'Sólo el administrador pasa el club a otro dueño'; end if;
  if member = auth.uid() and not manda then raise exception 'El dueño no puede cambiarse el rol a sí mismo'; end if;
  update memberships set role = new_role where club_id = club and user_id = member;
  if not found then raise exception 'Esa persona no está en el club'; end if;
  return new_role;
end $$;

grant execute on function set_club_role(uuid, uuid, text) to authenticated;
