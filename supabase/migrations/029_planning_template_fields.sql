-- 029_planning_template_fields.sql
-- Add the table-shaped fields used by the BIS Scheme of Work and Weekly
-- Lesson Plan templates. Existing planning data remains valid.

alter table if exists public.scheme_weeks
    add column if not exists resources text,
    add column if not exists assessment text,
    add column if not exists evaluation text;

alter table if exists public.lesson_plans
    add column if not exists success_criteria text,
    add column if not exists starter text,
    add column if not exists introduction text,
    add column if not exists development text,
    add column if not exists plenary text,
    add column if not exists sen_planning text;
