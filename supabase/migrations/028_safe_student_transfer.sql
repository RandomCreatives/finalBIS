-- 028_safe_student_transfer.sql
-- Clear the old class roll before moving a student. Migration 027 added a
-- unique active (class, roll) index; retaining the old roll during a move can
-- collide with a student already holding that number in the target class.

create or replace function public.transfer_student(
    p_student_id  uuid,
    p_to_class_id uuid,
    p_reason      text,
    p_actor_id    uuid,
    p_school_id   uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_from_class_id uuid;
    v_result json;
begin
    select class_id into v_from_class_id
      from students
     where id = p_student_id
       and school_id = p_school_id
     for update;

    if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
    if not exists (select 1 from classes where id = p_to_class_id and school_id = p_school_id) then
        raise exception 'CLASS_NOT_FOUND';
    end if;
    if v_from_class_id is not distinct from p_to_class_id then
        raise exception 'SAME_CLASS';
    end if;

    update students
       set roll_num = null,
           class_id = p_to_class_id
     where id = p_student_id
       and school_id = p_school_id;

    insert into student_transfers (student_id, from_class_id, to_class_id, reason, transferred_by)
    values (p_student_id, v_from_class_id, p_to_class_id, p_reason, p_actor_id);

    select json_build_object(
        'id', s.id, 'admission_no', s.admission_no, 'name', s.name,
        'roll_num', s.roll_num, 'class_id', s.class_id, 'is_active', s.is_active,
        'special_needs', s.special_needs,
        'class', case when c.id is null then null
                      else json_build_object('id', c.id, 'name', c.name) end
    ) into v_result
      from students s
      left join classes c on c.id = s.class_id
     where s.id = p_student_id;

    return v_result;
end;
$$;

revoke all on function public.transfer_student(uuid, uuid, text, uuid, uuid) from anon, authenticated;
