-- 023_nurse_role.sql
-- Add a dedicated Nurse role. Store Manager and Librarian remain separate.

alter table users drop constraint if exists users_role_check;

alter table users add constraint users_role_check
    check (role in (
        'admin',
        'main_teacher',
        'assistant_teacher',
        'subject_teacher',
        'store_manager',
        'librarian',
        'nurse'
    ));
