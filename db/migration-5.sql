-- Rugby Board · corrección 5: cada jugada vive dentro de un set up
--
-- El playbook se ordena solo si la jugada cuelga de la situación: se elige
-- «Line de 4» y ahí están sus jugadas. Hasta ahora la jugada no sabía de dónde
-- salía, y la lista era una bolsa con todo junto.
--
-- Supabase > SQL Editor > pegar > Run. Se puede correr más de una vez.

alter table plays add column if not exists setup_key text;
create index if not exists plays_setup_idx on plays (setup_key);

-- La función de guardado tiene que saberlo. Sigue corriendo como el usuario que
-- llama, así que sigue pasando por las reglas de acceso.
create or replace function save_play(
  p_scope     text,
  p_club      uuid,
  p_name      text,
  p_data      jsonb,
  p_setup_key text default null
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
    insert into plays (owner_id, scope, club_id, name, data, setup_key)
      values (auth.uid(), p_scope, p_club, p_name, p_data, p_setup_key)
      returning * into r;
  else
    update plays set data = p_data, setup_key = p_setup_key, updated_at = now()
     where id = r.id returning * into r;
  end if;

  if r.id is null then raise exception 'No tenés permiso para guardar en ese nivel'; end if;
  return r;
end $$;

grant execute on function save_play(text, uuid, text, jsonb, text) to authenticated;

-- Las jugadas que ya estaban guardadas no lo saben, pero su nombre sí: así las
-- nombra el entrenador. El resto queda sin set up hasta que las acomode.
update plays set setup_key = 'line4'
 where setup_key is null and lower(translate(name, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) like '%sudafrica%';
update plays set setup_key = 'line5'
 where setup_key is null and (lower(name) like '%niebla%' or lower(name) like '%leinster%');
update plays set setup_key = 'line3'
 where setup_key is null and lower(translate(name, 'éÉ', 'eE')) like '%canape%';
