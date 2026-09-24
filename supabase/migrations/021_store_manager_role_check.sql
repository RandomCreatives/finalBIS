-- 021_store_manager_role_check.sql
-- The live database still has the older four-role users constraint.
-- Run this once before creating the librarian Store Manager account.

alter table users drop constraint if exists users_role_check;

alter table users add constraint users_role_check
    check (role in (
        'admin',
        'main_teacher',
        'assistant_teacher',
        'subject_teacher',
        'store_manager'
    ));
