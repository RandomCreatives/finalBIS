-- 027_continuous_active_class_rolls.sql
-- Rolls are generated from the active class roster. They are never manually
-- assigned: 1..N in alphabetical order by the full displayed student name.

create or replace function public.renumber_student_class(
    p_school_id uuid,
    p_class_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    -- Clear active rolls first so the unique index is safe while names move.
    update students
       set roll_num = null
     where school_id = p_school_id
       and class_id = p_class_id
       and is_active = true;

    with ranked as (
        select id,
               row_number() over (
                   order by lower(trim(name)), trim(name), id
               )::integer as new_roll
          from students
         where school_id = p_school_id
           and class_id = p_class_id
           and is_active = true
    )
    update students s
       set roll_num = ranked.new_roll
      from ranked
     where s.id = ranked.id;

    select count(*)::integer
      into v_count
      from students
     where school_id = p_school_id
       and class_id = p_class_id
       and is_active = true;

    return v_count;
end;
$$;

-- Repair the existing active roster before adding the guardrail.
with ranked as (
    select id,
           row_number() over (
               partition by class_id
               order by lower(trim(name)), trim(name), id
           )::integer as new_roll
      from students
     where is_active = true
       and class_id is not null
)
update students s
   set roll_num = ranked.new_roll
  from ranked
 where s.id = ranked.id;

create unique index if not exists students_active_class_roll_unique
    on students (class_id, roll_num)
    where is_active = true and class_id is not null;

revoke all on function public.renumber_student_class(uuid, uuid) from anon, authenticated;
