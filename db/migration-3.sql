-- Rugby Board · corrección 3: guardar set ups y jugadas sin duplicar
--
-- La app guarda muchas veces el mismo set up: cada vez que el entrenador corrige
-- una posición. Estas funciones deciden si es alta o corrección, en el nivel que
-- corresponda, y devuelven la fila resultante.
--
-- Corren como el usuario que llama (security invoker), así que siguen pasando por
-- las reglas de acceso: nadie escribe donde no puede.
--
-- Supabase > SQL Editor > pegar > Run. Se puede correr más de una vez.

create or replace function save_setup(
  p_scope     text,
  p_club      uuid,
  p_base_key  text,
  p_name      text,
  p_data      jsonb,
  p_stage     text default 'field'
) returns setups language plpgsql security invoker set search_path = public as $$
declare r setups;
begin
  if p_scope not in ('global', 'club', 'personal') then raise exception 'Nivel inválido'; end if;
  if p_scope = 'club' and p_club is null then raise exception 'Falta el club'; end if;

  /* ¿ya existe uno para esta situación en este nivel? */
  select * into r from setups s
   where s.scope = p_scope
     and (p_scope <> 'personal' or s.owner_id = auth.uid())
     and (p_scope <> 'club' or s.club_id = p_club)
     and (case when p_base_key is null then s.base_key is null and s.name = p_name
               else s.base_key = p_base_key end)
   limit 1;

  if r.id is null then
    insert into setups (owner_id, scope, club_id, base_key, name, data)
      values (auth.uid(), p_scope, p_club, p_base_key, p_name, p_data)
      returning * into r;
  else
    update setups set name = p_name, data = p_data, updated_at = now()
     where id = r.id returning * into r;
  end if;

  /* Un update que las reglas de acceso rechazan no falla: no toca ninguna fila.
     Sin esto, la app creería que guardó algo que el servidor no aceptó. */
  if r.id is null then raise exception 'No tenés permiso para guardar en ese nivel'; end if;
  return r;
end $$;

create or replace function save_play(
  p_scope  text,
  p_club   uuid,
  p_name   text,
  p_data   jsonb
) returns plays language plpgsql security invoker set search_path = public as $$
declare r plays;
begin
  if p_scope not in ('global', 'club', 'personal') then raise exception 'Nivel inválido'; end if;
  if p_scope = 'club' and p_club is null then raise exception 'Falta el club'; end if;

  select * into r from plays p
   where p.scope = p_scope
     and (p_scope <> 'personal' or p.owner_id = auth.uid())
     and (p_scope <> 'club' or p.club_id = p_club)
     and p.name = p_name
   limit 1;

  if r.id is null then
    insert into plays (owner_id, scope, club_id, name, data)
      values (auth.uid(), p_scope, p_club, p_name, p_data)
      returning * into r;
  else
    update plays set data = p_data, updated_at = now() where id = r.id returning * into r;
  end if;

  if r.id is null then raise exception 'No tenés permiso para guardar en ese nivel'; end if;
  return r;
end $$;

grant execute on function save_setup(text, uuid, text, text, jsonb, text) to authenticated;
grant execute on function save_play(text, uuid, text, jsonb) to authenticated;
