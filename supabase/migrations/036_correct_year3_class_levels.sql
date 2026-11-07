-- Correct active Year 3 classes whose stored year_level was incorrectly set to 2.
-- This changes only class metadata; student records, marks, assignments, and reports are untouched.
UPDATE public.classes AS c
SET year_level = 3
WHERE c.year_level = 2
  AND c.name IN (
      'Year 3 - Blue',
      'Year 3 - Green',
      'Year 3 - Red',
      'Year 3 - Yellow'
  )
  AND EXISTS (
      SELECT 1
      FROM public.academic_years AS ay
      WHERE ay.school_id = c.school_id
        AND ay.is_current = TRUE
  );
