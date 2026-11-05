-- ============================================================================
-- Year 3 student import 2026/27 — names + guardian phones only
-- Generated from the four class CSVs. Run in Supabase SQL Editor.
-- Idempotent: students with the same name already in the class are skipped.
--
-- Admission numbers: admission_no is required by the schema, so this
-- import assigns BIS2026-001 … BIS2026-098 (year + sequence). The admin
-- can renumber them later once official admission numbers are issued.
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

    -- ── Year 3 - Red (25 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 3 - Red';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 3 - Red not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-001', 'Bersabeh Bitweded', v_class_id, 1, '930033262', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bersabeh Bitweded');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-002', 'Christian Ayesheshem', v_class_id, 2, '966269291', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christian Ayesheshem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-003', 'Christy Samuel', v_class_id, 3, '933904665', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christy Samuel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-004', 'Daniel Kalkidan', v_class_id, 4, '903950280', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Daniel Kalkidan');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-005', 'Eliakim Gethachew', v_class_id, 5, '911537790', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eliakim Gethachew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-006', 'Elphaz Baruda', v_class_id, 6, '977099892', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elphaz Baruda');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-007', 'Fenet Seblu', v_class_id, 7, '940842886', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Fenet Seblu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-008', 'Filomina Daniel', v_class_id, 8, '922023119', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Filomina Daniel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-009', 'Gabrielaa Dagem', v_class_id, 9, '911457151', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Gabrielaa Dagem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-010', 'Hasset Natan', v_class_id, 10, '947349447', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hasset Natan');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-011', 'Ian Tedros', v_class_id, 11, '966005588', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ian Tedros');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-012', 'Kaeb Kokeb', v_class_id, 12, '914314150', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Kaeb Kokeb');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-013', 'Laya Mohammed', v_class_id, 13, '907100001', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Laya Mohammed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-014', 'Leyora Getnet', v_class_id, 14, '913673999', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leyora Getnet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-015', 'Maramawit Birhanu', v_class_id, 15, '980633633', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maramawit Birhanu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-016', 'Maria Getnet', v_class_id, 16, '913673999', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maria Getnet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-017', 'Naomi Amha', v_class_id, 17, '947454515', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Naomi Amha');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-018', 'Noah Mehari', v_class_id, 18, '914725874', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Noah Mehari');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-019', 'Raphel Henok', v_class_id, 19, '912020970', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Raphel Henok');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-020', 'Teodra H/Gebreal', v_class_id, 20, '911887122', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Teodra H/Gebreal');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-021', 'Theophilos kelemwork', v_class_id, 21, '944142674', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Theophilos kelemwork');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-022', 'Weyzer Ahmedin', v_class_id, 22, '911269355', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Weyzer Ahmedin');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-023', 'Yeamanuel Bereket', v_class_id, 23, '911633732', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yeamanuel Bereket');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-024', 'Yohannan Yohannes', v_class_id, 24, '913101927', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yohannan Yohannes');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-025', 'Yonael Yared', v_class_id, 25, '926788798', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yonael Yared');
    END IF;

    -- ── Year 3 - Yellow (24 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 3 - Yellow';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 3 - Yellow not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-026', 'Elnathan Abebe', v_class_id, 1, '911636789', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elnathan Abebe');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-027', 'Tiyobista Haileab', v_class_id, 2, '911766257', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Tiyobista Haileab');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-028', 'Nathanem Ephrem', v_class_id, 3, '911537032', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathanem Ephrem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-029', 'Amelia Robel', v_class_id, 4, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amelia Robel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-030', 'Maya Endalkachew', v_class_id, 5, '912757523', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Maya Endalkachew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-031', 'Christiana Asregedew', v_class_id, 6, '941616582', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Christiana Asregedew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-032', 'Cassiopeia Wondwosen', v_class_id, 7, '923771692', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Cassiopeia Wondwosen');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-033', 'Eyosias Enyew', v_class_id, 8, '911252240', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyosias Enyew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-034', 'Kebron Dawit', v_class_id, 9, '930071524', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Kebron Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-035', 'Noah Melaku', v_class_id, 10, NULL, TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Noah Melaku');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-036', 'Nathan Nebiyu', v_class_id, 11, '912912469', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Nebiyu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-037', 'Mercy Seife', v_class_id, 12, '904169979', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mercy Seife');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-038', 'Emmnet Abiy', v_class_id, 13, '930100480', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Emmnet Abiy');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-039', 'Nathan Yohannes', v_class_id, 14, '911713911', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nathan Yohannes');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-040', 'Wisam Seid', v_class_id, 15, '911872556', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Wisam Seid');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-041', 'Nahom Hailemariam', v_class_id, 16, '911464035', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nahom Hailemariam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-042', 'Lewi Baye', v_class_id, 17, '900938408', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Lewi Baye');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-043', 'Liya Daniel', v_class_id, 18, '911342840', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Liya Daniel');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-044', 'Yonatan Esayas', v_class_id, 19, '911163240', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yonatan Esayas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-045', 'Lucas Fitsum', v_class_id, 20, '911251569', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Lucas Fitsum');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-046', 'Barok Aliwa', v_class_id, 21, '913213088', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Barok Aliwa');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-047', 'Saron Dagnachew', v_class_id, 22, '911753851', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Saron Dagnachew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-048', 'Nuhamin Tsegaye', v_class_id, 23, '928710355', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nuhamin Tsegaye');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-049', 'Jaden Matiyas', v_class_id, 24, '911383315', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Jaden Matiyas');
    END IF;

    -- ── Year 3 - Blue (24 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 3 - Blue';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 3 - Blue not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-050', 'Ablakat Tolosa', v_class_id, 1, '921112135', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Ablakat Tolosa');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-051', 'Abyalat Sisay', v_class_id, 2, '912499786', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abyalat Sisay');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-052', 'Aelaf Mesfin', v_class_id, 3, '911317682', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Aelaf Mesfin');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-053', 'Aman Jemil', v_class_id, 4, '912199958', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Aman Jemil');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-054', 'Bahran Biryam', v_class_id, 5, '911517720', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Bahran Biryam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-055', 'Barok Hayal', v_class_id, 6, '911266669', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Barok Hayal');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-056', 'Elshalom Tamirat', v_class_id, 7, '911803473', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Elshalom Tamirat');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-057', 'Hemen Ghion', v_class_id, 8, '912067448', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hemen Ghion');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-058', 'Heran Ashenafi', v_class_id, 9, '915579918', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Heran Ashenafi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-059', 'Huzeyfa Abdi', v_class_id, 10, '911190064', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Huzeyfa Abdi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-060', 'Leul Fistum', v_class_id, 11, '924909030', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Leul Fistum');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-061', 'Meba Aytenew', v_class_id, 12, '913832960', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Meba Aytenew');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-062', 'Milki Kidane', v_class_id, 13, '913583431', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Milki Kidane');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-063', 'Nafiba Gebru', v_class_id, 14, '930011064', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nafiba Gebru');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-064', 'Naomi Ephrem', v_class_id, 15, '945474747', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Naomi Ephrem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-065', 'Naomi Tomas', v_class_id, 16, '913688129', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Naomi Tomas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-066', 'Natherawit Gardie', v_class_id, 17, '916898563', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Natherawit Gardie');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-067', 'Rashid Kaise', v_class_id, 18, '963374329', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rashid Kaise');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-068', 'Rimna Yonas', v_class_id, 19, '9930025024', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Rimna Yonas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-069', 'Singitan Legese', v_class_id, 20, '911556316', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Singitan Legese');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-070', 'Yoadan Biruk', v_class_id, 21, '995301000', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yoadan Biruk');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-071', 'Yohana Solomon', v_class_id, 22, '921401133', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yohana Solomon');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-072', 'Yonan Michael', v_class_id, 23, '911067240', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yonan Michael');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-073', 'Yosef Israel', v_class_id, 24, '911728113', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Yosef Israel');
    END IF;

    -- ── Year 3 - Green (25 students) ──
    SELECT id INTO v_class_id FROM classes
    WHERE school_id = v_school_id AND name = 'Year 3 - Green';
    IF v_class_id IS NULL THEN
        RAISE WARNING 'Class Year 3 - Green not found — skipping its students.';
    ELSE
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-074', 'Abigail Teramas', v_class_id, 1, '911415125', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abigail Teramas');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-075', 'Abrak Kinfe', v_class_id, 2, '917051158', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Abrak Kinfe');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-076', 'Adonis Tedi', v_class_id, 3, '913021915', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Adonis Tedi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-077', 'Amal Ibrahim', v_class_id, 4, '938383688', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amal Ibrahim');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-078', 'Amen Fikremariam', v_class_id, 5, '911440854', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amen Fikremariam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-079', 'Amensias Endale', v_class_id, 6, '911555869', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amensias Endale');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-080', 'Amnen Ephrem', v_class_id, 7, '911927923', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Amnen Ephrem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-081', 'Barkel Alemayehu', v_class_id, 8, '911451554', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Barkel Alemayehu');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-082', 'Beaman Merha', v_class_id, 9, '913633917', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Beaman Merha');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-083', 'Besam Yimam', v_class_id, 10, '915354011', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Besam Yimam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-084', 'Blen Beidemariam', v_class_id, 11, '911120394', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Blen Beidemariam');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-085', 'Charis Fasika', v_class_id, 12, '939150919', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Charis Fasika');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-086', 'Eyoas Belay', v_class_id, 13, '912010005', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Eyoas Belay');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-087', 'Hafsa Hussen', v_class_id, 14, '912981724', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hafsa Hussen');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-088', 'Hiyabel Gosa', v_class_id, 15, '911364596', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Hiyabel Gosa');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-089', 'Isabella Sirak', v_class_id, 16, '911906910', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Isabella Sirak');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-090', 'Markon Andualem', v_class_id, 17, '911108251', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Markon Andualem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-091', 'Micah Mulualem', v_class_id, 18, '911734994', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Micah Mulualem');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-092', 'Michael Netsanet', v_class_id, 19, '903878090', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Michael Netsanet');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-093', 'Muniir Muhydin', v_class_id, 20, '912670120', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Muniir Muhydin');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-094', 'Naod Tedi', v_class_id, 21, '913773473', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Naod Tedi');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-095', 'Nola Sophoniass', v_class_id, 22, '911463838', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nola Sophoniass');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-096', 'Nolawi Dawit', v_class_id, 23, '944052899', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Nolawi Dawit');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-097', 'Umulker Mohammed', v_class_id, 24, '911993982', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Umulker Mohammed');
        INSERT INTO students (school_id, admission_no, name, class_id, roll_num, guardian_phone, is_active)
        SELECT v_school_id, 'BIS2026-098', 'Mahir Mifta', v_class_id, 25, '911417600', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.school_id = v_school_id AND s.class_id = v_class_id AND s.name = 'Mahir Mifta');
    END IF;

    RAISE NOTICE 'Total active students now: %',
        (SELECT count(*) FROM students WHERE school_id = v_school_id AND is_active = TRUE);
END $$;

-- Verification: students per class
SELECT c.name AS class, count(s.id) AS students,
       count(s.guardian_phone) AS with_phone,
       min(s.admission_no) AS first_adm, max(s.admission_no) AS last_adm
FROM classes c
LEFT JOIN students s ON s.class_id = c.id AND s.is_active = TRUE
WHERE c.name LIKE 'Year 3%'
GROUP BY c.name ORDER BY c.name;
