-- 025_student_photo_storage.sql
-- Private Supabase Storage for compressed student ID photos.
-- The browser sends a resized JPEG; only its storage path is kept on students.

alter table students
    add column if not exists photo_storage_path text;

insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do update set public = false;
