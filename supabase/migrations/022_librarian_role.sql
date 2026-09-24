-- 022_librarian_role.sql
-- Store Manager and Librarian are separate staff roles.
-- Run this after (or instead of) migration 021.

alter table users drop constraint if exists users_role_check;

alter table users add constraint users_role_check
    check (role in (
        'admin',
        'main_teacher',
        'assistant_teacher',
        'subject_teacher',
        'store_manager',
        'librarian'
    ));
