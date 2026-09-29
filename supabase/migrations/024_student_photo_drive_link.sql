-- 024_student_photo_drive_link.sql
-- Store only the file_records reference on a student. The image itself
-- remains in the existing Google Drive-backed Files system.

alter table students
    add column if not exists photo_file_id uuid references file_records(id) on delete set null;

create index if not exists idx_students_photo_file_id on students(photo_file_id);
