-- 026_assigned_sen_teacher.sql
-- Store the SEN teacher assigned to a student. This is intentionally a
-- free-text name for now while the school collects the teacher names.

alter table if exists public.students
    add column if not exists sen_teacher_name text;

alter table if exists public.student_requests
    add column if not exists sen_teacher_name text;

create index if not exists students_sen_teacher_name_idx
    on public.students (school_id, sen_teacher_name)
    where sen_teacher_name is not null;
