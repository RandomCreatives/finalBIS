-- 019_student_requests.sql
-- Main-teacher student intake: teachers request a new student for their
-- class, admins get a bell nudge and approve (or decline). Approving creates
-- the real student record with the next admission number and roll number.
--
-- Paste into the Supabase SQL editor (same drill as 017/018).

create table if not exists student_requests (
    id                uuid primary key default gen_random_uuid(),
    school_id         uuid not null references schools(id) on delete cascade,
    academic_year_id  uuid not null references academic_years(id) on delete cascade,
    class_id          uuid not null references classes(id) on delete cascade,
    requested_by      uuid not null references users(id),
    name              text not null,
    gender            text check (gender in ('male', 'female', 'other')),
    date_of_birth     date,
    guardian_name     text,
    guardian_phone    text,
    guardian_email    text,
    special_needs     boolean not null default false,
    special_needs_note text,
    status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),
    review_note       text,
    reviewed_by       uuid references users(id),
    reviewed_at       timestamptz,
    student_id        uuid references students(id) on delete set null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- one live request per student name per class — blocks accidental
-- double-submits while a request is waiting for the office
create unique index if not exists student_requests_one_pending
    on student_requests (class_id, lower(name)) where status = 'pending';

create index if not exists student_requests_school_status
    on student_requests (school_id, status);
