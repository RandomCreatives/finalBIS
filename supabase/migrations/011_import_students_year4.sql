-- ============================================================================
-- Year 4 student import 2026/27 — names + guardian phones only
-- Generated from the ten class CSVs (messy source formats handled:
-- missing headers, title rows, shifted columns). Names title-cased.
-- Run in Supabase SQL Editor. Idempotent: same-name students in the
-- same class are skipped.
--
-- Admission numbers continue the Year 3 sequence: BIS2026-099 …
-- ============================================================================
DO $$
DECLARE
    v_school_id uuid;
    v_class_id  uuid;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No school found.';
    END IF;

    -- ── Year 4 - Blue (26 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Blue';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Blue not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-099', 'Bemnet Berhanu', v_class_id, 1, '911207099', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bemnet Berhanu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-100', 'Nahom Berhanu', v_class_id, 2, '911207099', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nahom Berhanu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-101', 'Nathan Berhanu', v_class_id, 3, '911207099', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Berhanu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-102', 'Rewina Abraham', v_class_id, 4, '911619640', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rewina Abraham');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-103', 'Eldana Yonas', v_class_id, 5, '920222687', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eldana Yonas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-104', 'Abigail Henok', v_class_id, 6, '911987213', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abigail Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-105', 'Blen Alemayehu', v_class_id, 7, '913523437', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Blen Alemayehu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-106', 'Noah Henok', v_class_id, 8, '944141154', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Noah Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-107', 'Yulia Mahary', v_class_id, 9, '930012182', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yulia Mahary');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-108', 'Hasset Zegeye', v_class_id, 10, '912106486', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hasset Zegeye');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-109', 'Deon Daniel', v_class_id, 11, '912096211', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Deon Daniel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-110', 'Adey Amanuel', v_class_id, 12, '911668598', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Adey Amanuel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-111', 'Abel Kirubel', v_class_id, 13, '911752920', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abel Kirubel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-112', 'Yamlak Bereket', v_class_id, 14, '911230953', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yamlak Bereket');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-113', 'Nathan Birhanu', v_class_id, 15, '911152215', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Birhanu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-114', 'Dagim Asnake', v_class_id, 16, '911123984', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Dagim Asnake');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-115', 'Maya Alebele', v_class_id, 17, '911229714', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maya Alebele');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-116', 'Yosef Temesgen', v_class_id, 18, '911614465', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yosef Temesgen');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-117', 'Gabriela Habtu', v_class_id, 19, '911054561', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gabriela Habtu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-118', 'Marcon Tsega', v_class_id, 20, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Marcon Tsega');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-119', 'Esman Tesfaye', v_class_id, 21, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Esman Tesfaye');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-120', 'Christian Tagel', v_class_id, 22, '966258210', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Tagel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-121', 'Nathan Robel', v_class_id, 23, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Robel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-122', 'Amen Nuredien', v_class_id, 24, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amen Nuredien');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-123', 'Yemariam Yordanos', v_class_id, 25, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yemariam Yordanos');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-124', 'Mohammed Hatem', v_class_id, 26, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mohammed Hatem');
    END IF;

    -- ── Year 4 - Purple (23 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Purple';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Purple not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-125', 'Abigail Yared', v_class_id, 1, '921337155', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abigail Yared');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-126', 'Eliana Habtom', v_class_id, 2, '980132196', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eliana Habtom');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-127', 'Hiyab Yosef', v_class_id, 3, '913448655', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hiyab Yosef');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-128', 'Khalid Kinfe', v_class_id, 4, '910979281', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Khalid Kinfe');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-129', 'Leilt Dimetros', v_class_id, 5, '913054291', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leilt Dimetros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-130', 'Rufa Dimetros', v_class_id, 6, '913054291', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rufa Dimetros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-131', 'Leul Bemnet', v_class_id, 7, '911229241', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leul Bemnet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-132', 'Leyu Robel', v_class_id, 8, '911368497', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leyu Robel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-133', 'Maramawit Endale', v_class_id, 9, '911599685', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maramawit Endale');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-134', 'Melali Kidane', v_class_id, 10, '913238407', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Melali Kidane');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-135', 'Mohammed Sharmak', v_class_id, 11, '905238810', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mohammed Sharmak');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-136', 'Nahom Yamlaksira', v_class_id, 12, '978882135', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nahom Yamlaksira');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-137', 'Nathan Amdie', v_class_id, 13, '911234869', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Amdie');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-138', 'Yael Daniel', v_class_id, 14, '902518700', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yael Daniel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-139', 'Yemariam Abinet', v_class_id, 15, '911417058', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yemariam Abinet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-140', 'Yonael Henok', v_class_id, 16, '911401225', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yonael Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-141', 'Zachary Zelalem', v_class_id, 17, '911972424', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Zachary Zelalem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-142', 'Biruk Abiy', v_class_id, 18, '911873862', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Biruk Abiy');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-143', 'Alana Elias', v_class_id, 19, '911219799', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Alana Elias');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-144', 'Eliana Tegete', v_class_id, 20, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eliana Tegete');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-145', 'Epalle Behome', v_class_id, 21, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Epalle Behome');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-146', 'Heran Abiy', v_class_id, 22, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Heran Abiy');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-147', 'Ritaj Jemal', v_class_id, 23, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ritaj Jemal');
    END IF;

    -- ── Year 4 - Lavender (22 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Lavender';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Lavender not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-148', 'Abemelek Ameha', v_class_id, 1, '947415327', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abemelek Ameha');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-149', 'Abigail Binyam', v_class_id, 2, '913787042', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abigail Binyam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-150', 'Abigia Tezazu', v_class_id, 3, '913787042', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abigia Tezazu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-151', 'Barok Abinet', v_class_id, 4, '931626262', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Barok Abinet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-152', 'Christian Anteneh', v_class_id, 5, '911218768', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Anteneh');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-153', 'Elfre Binalewt', v_class_id, 6, '911455724', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elfre Binalewt');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-154', 'Eyuel Mulugeta', v_class_id, 7, '912417636', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyuel Mulugeta');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-155', 'Eyuel Seifu', v_class_id, 8, '911035298', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyuel Seifu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-156', 'Hebron Frezer', v_class_id, 9, '910688491', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hebron Frezer');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-157', 'Johan Mussie', v_class_id, 10, '911514626', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Johan Mussie');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-158', 'Liyat Zelalem', v_class_id, 11, '911721237', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Liyat Zelalem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-159', 'Michael Mengistu', v_class_id, 12, '911605385', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Michael Mengistu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-160', 'Raphael Simon', v_class_id, 13, '911409737', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Raphael Simon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-161', 'Yemariam Bisrat', v_class_id, 14, '911208606', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yemariam Bisrat');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-162', 'Zeyad Ahmed', v_class_id, 15, '911227197', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Zeyad Ahmed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-163', 'Zoe Abenezer', v_class_id, 16, '938034930', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Zoe Abenezer');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-164', 'Yeab Henoke', v_class_id, 17, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yeab Henoke');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-165', 'Yohana Andint', v_class_id, 18, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yohana Andint');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-166', 'Miseal Garcia', v_class_id, 19, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Miseal Garcia');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-167', 'Yabrak Esubalew', v_class_id, 20, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yabrak Esubalew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-168', 'Mahtot Mehari', v_class_id, 21, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mahtot Mehari');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-169', 'Arsema Eyael', v_class_id, 22, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Arsema Eyael');
    END IF;

    -- ── Year 4 - Crimson (25 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Crimson';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Crimson not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-170', 'Markon Sisay', v_class_id, 1, '911663117', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Markon Sisay');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-171', 'Justina Mengistu', v_class_id, 2, '911136467', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Justina Mengistu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-172', 'Adiel Henok', v_class_id, 3, '911110160', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Adiel Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-173', 'Ayan Abdulahafiz', v_class_id, 4, '929287828', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ayan Abdulahafiz');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-174', 'Eliyas Mohammed', v_class_id, 5, '988303333', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eliyas Mohammed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-175', 'Gabriel Dawit', v_class_id, 6, '925321731', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gabriel Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-176', 'Liyana Thomas', v_class_id, 7, '939731018', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Liyana Thomas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-177', 'Yadel Yohannes', v_class_id, 8, '900686137', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yadel Yohannes');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-178', 'Naflet Henok', v_class_id, 9, '911340290', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Naflet Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-179', 'Bethel Nebiyu', v_class_id, 10, '911647887', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bethel Nebiyu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-180', 'Zion Abel', v_class_id, 11, '911241027', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Zion Abel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-181', 'Tensiya Gebru', v_class_id, 12, '911659298', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Tensiya Gebru');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-182', 'Arsema Bantegize', v_class_id, 13, '911147830', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Arsema Bantegize');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-183', 'Noah G/ Hiwot', v_class_id, 14, '941626033', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Noah G/ Hiwot');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-184', 'Elda Dejene', v_class_id, 15, '911455433', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elda Dejene');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-185', 'Yohanna Fitsumbirhan', v_class_id, 16, '930294007', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yohanna Fitsumbirhan');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-186', 'Makbel Dawit', v_class_id, 17, '966241969', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Makbel Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-187', 'Naomi Tikikil', v_class_id, 18, '911707866', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Naomi Tikikil');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-188', 'Rakeb Yismashewa', v_class_id, 19, '993071181', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rakeb Yismashewa');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-189', 'Gao Xinrut', v_class_id, 20, '966032050', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gao Xinrut');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-190', 'Nyalem Duol', v_class_id, 21, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nyalem Duol');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-191', 'Timon Gezahegn', v_class_id, 22, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Timon Gezahegn');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-192', 'Mihiret Adebabay', v_class_id, 23, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mihiret Adebabay');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-193', 'Kidus Dawit', v_class_id, 24, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Kidus Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-194', 'Dina Dawit', v_class_id, 25, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Dina Dawit');
    END IF;

    -- ── Year 4 - Green (18 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Green';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Green not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-195', 'Absalat Amha Mezgebu', v_class_id, 1, '911225755', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Absalat Amha Mezgebu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-196', 'Bitaniya Fikreeyesus Kibru', v_class_id, 2, '982314746', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bitaniya Fikreeyesus Kibru');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-197', 'Christian Michael Embaye', v_class_id, 3, '929247755', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Michael Embaye');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-198', 'Christiantewodros Mezgebu', v_class_id, 4, '911435172', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christiantewodros Mezgebu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-199', 'Christian Yohannes Ezra', v_class_id, 5, '911484900', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Yohannes Ezra');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-200', 'Dawit Belay Chane', v_class_id, 6, '911688045', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Dawit Belay Chane');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-201', 'Delina Abeselom Haile', v_class_id, 7, '909798002', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Delina Abeselom Haile');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-202', 'Elnathan Tenketem', v_class_id, 8, '911754582', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elnathan Tenketem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-203', 'Elon Mikias Gebremeskel', v_class_id, 9, '912742473', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elon Mikias Gebremeskel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-204', 'Kidus Dawit Nega', v_class_id, 10, '912185859', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Kidus Dawit Nega');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-205', 'Loanna Biniyam Taye', v_class_id, 11, '911213735', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Loanna Biniyam Taye');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-206', 'Maher Awol Mohammed', v_class_id, 12, '922469314', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maher Awol Mohammed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-207', 'Mariya Deneke Zerga', v_class_id, 13, '973600000', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mariya Deneke Zerga');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-208', 'Matthan Tamrat Woldeselase', v_class_id, 14, '946726466', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Matthan Tamrat Woldeselase');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-209', 'Nikodimos Abreham Gebrekirstos', v_class_id, 15, '910593196', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nikodimos Abreham Gebrekirstos');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-210', 'Obsan Milki Fekadu', v_class_id, 16, '913444068', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Obsan Milki Fekadu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-211', 'Rizaph Ismael Fekadu', v_class_id, 17, '911411662', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rizaph Ismael Fekadu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-212', 'Yemariam Fasil Moges', v_class_id, 18, '911820823', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yemariam Fasil Moges');
    END IF;

    -- ── Year 4 - Yellow (21 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Yellow';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Yellow not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-213', 'Yam Getahun', v_class_id, 1, '902576466', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yam Getahun');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-214', 'Robel Mulugeta', v_class_id, 2, '930073595', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Robel Mulugeta');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-215', 'Yemariam Kassahun', v_class_id, 3, '910349272', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yemariam Kassahun');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-216', 'Humera Abduselam', v_class_id, 4, '976704070', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Humera Abduselam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-217', 'Azariya Teshale', v_class_id, 5, '922859900', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Azariya Teshale');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-218', 'Meba Henok', v_class_id, 6, '913428306', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Meba Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-219', 'Milto Melkamu', v_class_id, 7, '942722847', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Milto Melkamu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-220', 'Eva Dagmawi', v_class_id, 8, '988523660', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eva Dagmawi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-221', 'Sara Eltijani', v_class_id, 9, '912625793', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Sara Eltijani');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-222', 'Keamlak Abebayehu', v_class_id, 10, '911767986', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Keamlak Abebayehu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-223', 'Hawinet Solomon', v_class_id, 11, '911896078', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hawinet Solomon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-224', 'Joshua Aleleng', v_class_id, 12, '913112333', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Joshua Aleleng');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-225', 'Delina Gebremicheal', v_class_id, 13, '910172344', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Delina Gebremicheal');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-226', 'Hebrew Mesfin', v_class_id, 14, '911870940', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hebrew Mesfin');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-227', 'Nathaniem Dawit', v_class_id, 15, '911340290', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathaniem Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-228', 'Leul Solomon', v_class_id, 16, '922079618', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leul Solomon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-229', 'Darik Micheal', v_class_id, 17, '924405311', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Darik Micheal');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-230', 'Fikir Tewodros', v_class_id, 18, '911232963', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Fikir Tewodros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-231', 'Romhay Abinet', v_class_id, 19, '911513900', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Romhay Abinet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-232', 'Esrom Belay', v_class_id, 20, '911257260', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Esrom Belay');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-233', 'Leul Efrem', v_class_id, 21, '911367645', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leul Efrem');
    END IF;

    -- ── Year 4 - Magenta (23 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Magenta';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Magenta not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-234', 'Bekir Aklilu', v_class_id, 1, '911138677', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bekir Aklilu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-235', 'Rami Sami', v_class_id, 2, '911221425', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rami Sami');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-236', 'Yohannes Ayele', v_class_id, 3, '911523024', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yohannes Ayele');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-237', 'Maedot Tewodros', v_class_id, 4, '912121007', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maedot Tewodros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-238', 'Kaleb Alazear', v_class_id, 5, '911410621', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Kaleb Alazear');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-239', 'Bemnet Zelalem', v_class_id, 6, '913513930', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bemnet Zelalem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-240', 'Neriah Daniel', v_class_id, 7, '0911049595/0911384994', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Neriah Daniel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-241', 'Ruftalem Robel', v_class_id, 8, '940210021', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ruftalem Robel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-242', 'Basleal Fitsum', v_class_id, 9, '0911219731
 0911208126', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Basleal Fitsum');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-243', 'Daric', v_class_id, 10, '924405311', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Daric');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-244', 'David Yenealem', v_class_id, 11, '965175163', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'David Yenealem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-245', 'Elmar Solomon', v_class_id, 12, '925660981', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elmar Solomon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-246', 'Luna Shimels', v_class_id, 13, '913566725', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Luna Shimels');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-247', 'Michalel Abera', v_class_id, 14, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Michalel Abera');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-248', 'Christian Fithanegest', v_class_id, 15, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Fithanegest');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-249', 'Mena Hiruy', v_class_id, 16, '911603070', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mena Hiruy');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-250', 'Armani Samuel', v_class_id, 17, '911268394', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Armani Samuel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-251', 'Solen Gadisa', v_class_id, 18, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Solen Gadisa');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-252', 'Gelila Tatek', v_class_id, 19, '911836285', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gelila Tatek');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-253', 'Liyat Tsega', v_class_id, 20, '911726292', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Liyat Tsega');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-254', 'Melona Yared', v_class_id, 21, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Melona Yared');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-255', 'Labsil Eba', v_class_id, 22, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Labsil Eba');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-256', 'Caleb Fasika', v_class_id, 23, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Caleb Fasika');
    END IF;

    -- ── Year 4 - Red (23 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Red';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Red not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-257', 'Eliab Abebe', v_class_id, 1, '911636789', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eliab Abebe');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-258', 'Anna Abraham', v_class_id, 2, '911391712', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Anna Abraham');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-259', 'Heran Amilu', v_class_id, 3, '911458211', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Heran Amilu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-260', 'Tiyame Anduamlak', v_class_id, 4, '0911106505 0911515524', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Tiyame Anduamlak');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-261', 'Eyoab Zena', v_class_id, 5, '0920331814 0911635198', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyoab Zena');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-262', 'Hanamel Beniyam', v_class_id, 6, '0911834981 0911603383', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hanamel Beniyam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-263', 'Nehemia Ashenafi', v_class_id, 7, '911345047', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nehemia Ashenafi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-264', 'Hanna Yetimwork', v_class_id, 8, '991023912', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hanna Yetimwork');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-265', 'Anna Yetimwork', v_class_id, 9, '991023912', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Anna Yetimwork');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-266', 'Azahel Zinaw', v_class_id, 10, '0911183504 0913096200', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Azahel Zinaw');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-267', 'Liyat Mohammed', v_class_id, 11, '911968533', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Liyat Mohammed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-268', 'Amnen Amanuel', v_class_id, 12, '0911225653 0913380031', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amnen Amanuel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-269', 'Hiyam Seid', v_class_id, 13, '911854111', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hiyam Seid');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-270', 'Sifen Yohannes', v_class_id, 14, '905856639', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Sifen Yohannes');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-271', 'Yeab Fitsum', v_class_id, 15, '911232590', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yeab Fitsum');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-272', 'Kidus Ephrem', v_class_id, 16, '912085728', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Kidus Ephrem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-273', 'Yemaryam Biruk', v_class_id, 17, '911413588', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yemaryam Biruk');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-274', 'Debi Gutu', v_class_id, 18, '0913979969 0910048144', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Debi Gutu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-275', 'Gahada Elthayeb', v_class_id, 19, '967561097', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gahada Elthayeb');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-276', 'Solomon Nigus', v_class_id, 20, '933064444', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Solomon Nigus');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-277', 'Sherya Summit', v_class_id, 21, '944096639', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Sherya Summit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-278', 'Elnathan Habtamu', v_class_id, 22, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elnathan Habtamu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-279', 'Eyosias Kelemework', v_class_id, 23, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyosias Kelemework');
    END IF;

    -- ── Year 4 - Violet (22 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Violet';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Violet not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-280', 'Ahadu Kokeb', v_class_id, 1, '914314150', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ahadu Kokeb');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-281', 'Amen Sofoniyas', v_class_id, 2, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amen Sofoniyas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-282', 'Amnen Mulualem', v_class_id, 3, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amnen Mulualem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-283', 'Benias Tewodros', v_class_id, 4, '911124461', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Benias Tewodros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-284', 'Eliyana Esayas', v_class_id, 5, '911969790', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eliyana Esayas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-285', 'Elsur Aschalew', v_class_id, 6, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elsur Aschalew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-286', 'Eyoab Yirgalem', v_class_id, 7, '987024139', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyoab Yirgalem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-287', 'Gabriel Miliyon', v_class_id, 8, '911718866', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gabriel Miliyon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-288', 'Heaven Tewodros', v_class_id, 9, '911124461', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Heaven Tewodros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-289', 'Henos H/Michael', v_class_id, 10, '911973496', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Henos H/Michael');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-290', 'Hyab Nega', v_class_id, 11, '923953909', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hyab Nega');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-291', 'Lyna Melke', v_class_id, 12, '911142745', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Lyna Melke');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-292', 'Mahtot Yosef', v_class_id, 13, '911649207', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mahtot Yosef');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-293', 'Marcon Mohammed', v_class_id, 14, '983960018', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Marcon Mohammed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-294', 'Mati Tamiru', v_class_id, 15, '974014444', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mati Tamiru');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-295', 'Matteo Yishak', v_class_id, 16, '912505252', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Matteo Yishak');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-296', 'Nael Tsegeab', v_class_id, 17, '911558271', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nael Tsegeab');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-297', 'Nahilet Sisay', v_class_id, 18, '913957113', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nahilet Sisay');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-298', 'Natnael Temesgen', v_class_id, 19, '911449414', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Natnael Temesgen');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-299', 'Omna Solomon', v_class_id, 20, '983035423', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Omna Solomon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-300', 'Samuel Abrham', v_class_id, 21, '973084958', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Samuel Abrham');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-301', 'Yorane Biniyam', v_class_id, 22, '911715351', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yorane Biniyam');
    END IF;

    -- ── Year 4 - Orange (14 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 4 - Orange';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 4 - Orange not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-302', 'Aviel Henok', v_class_id, 1, '911257264', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Aviel Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-303', 'Bemnet Alemayehu', v_class_id, 2, '985471471', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bemnet Alemayehu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-304', 'Christian Ephrem', v_class_id, 3, '913023724', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Ephrem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-305', 'Daniel Raphael', v_class_id, 4, '922114720', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Daniel Raphael');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-306', 'Diana Sam', v_class_id, 5, '947330864', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Diana Sam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-307', 'Havish Hariharasundarang', v_class_id, 6, '911218946', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Havish Hariharasundarang');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-308', 'Ibrahim Esmael', v_class_id, 7, '984066168', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ibrahim Esmael');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-309', 'Leoul Dawit', v_class_id, 8, '921308946', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leoul Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-310', 'Murti Telile', v_class_id, 9, '911722572', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Murti Telile');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-311', 'Nathan Alemayehu', v_class_id, 10, '913709450', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Alemayehu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-312', 'Noah Melkamu', v_class_id, 11, '911232604', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Noah Melkamu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-313', 'Salem Endale', v_class_id, 12, '911447031', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Salem Endale');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-314', 'Sador Ashenafi', v_class_id, 13, '911217872', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Sador Ashenafi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-315', 'Veronica Tigistu', v_class_id, 14, '913743992', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Veronica Tigistu');
    END IF;

    RAISE NOTICE 'Total active students now: %',
        (SELECT count(*) FROM students WHERE school_id = v_school_id AND is_active = TRUE);
END $$;

-- Verification: students per class (whole school)
SELECT c.name AS class, count(s.id) AS students,
       count(s.guardian_phone) AS with_phone,
       min(s.admission_no) AS first_adm, max(s.admission_no) AS last_adm
FROM classes c
LEFT JOIN students s ON s.class_id = c.id AND s.is_active = TRUE
GROUP BY c.name ORDER BY c.name;
