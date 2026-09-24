-- 020_teacher_payment_visibility.sql
-- Admin-controlled school-wide visibility for the teacher payment panel.
-- Admins always retain payment access; this switch only affects teachers.
--
-- Paste into the Supabase SQL editor and run once.

create table if not exists school_settings (
    school_id                 uuid primary key references schools(id) on delete cascade,
    teacher_payment_enabled   boolean not null default false,
    updated_by                uuid references users(id) on delete set null,
    updated_at                timestamptz not null default now()
);

insert into school_settings (school_id)
select id from schools
on conflict (school_id) do nothing;
