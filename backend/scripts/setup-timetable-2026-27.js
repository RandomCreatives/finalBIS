/**
 * Sets up the 2026/27 teaching assignments and generates the weekly
 * timetable for all 14 classes.
 *
 *   node scripts/setup-timetable-2026-27.js [--dry-run] [--wipe]
 *
 * What it does (idempotent):
 *   1. Renames Global Studies -> Global Citizenship, Arts -> Art
 *   2. Creates the Spelling and Registration subjects if missing
 *   3. Creates placeholder subject-teacher accounts (English Teacher 1..4,
 *      Amharic/Music/Art/PE Teacher 1-2, French Teacher 1, ICT Teacher 1)
 *      if they don't exist yet — rename them later when names are decided
 *   4. Upserts class_subjects assignments (sessions per week included)
 *   5. Regenerates the week's timetable slots (Registration at 08:10 daily,
 *      then 26 lesson sessions placed clash-free). --wipe removes existing
 *      slots for the year first; without it, generation only fills gaps.
 *
 * The DB's exclusion constraints remain the final arbiter: any
 * double-booking attempt fails loudly instead of entering the data.
 */
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { generateWeek, DAYS, LESSON_PERIODS, REGISTRATION } = require('../utils/timetableGenerator');

const DRY_RUN = process.argv.includes('--dry-run');
const WIPE = process.argv.includes('--wipe');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const YEAR_NAME = process.env.ACADEMIC_YEAR || '2026/2027';
const TEMP_PASSWORD = 'BisNoc2026!';

// ---------------------------------------------------------------------------
// The 2026/27 staffing plan
// ---------------------------------------------------------------------------

const YEAR3_CLASSES = ['Blue', 'Yellow', 'Red', 'Green'];
const YEAR4_CLASSES = ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green', 'Yellow', 'Magenta', 'Red', 'Violet', 'Orange'];

const className = (year, color) => `Year ${year} - ${color}`;

// English: 4 teachers. Each takes one Year 3 class; Year 4 splits 3+3+2+2.
// With the (future, admin-approved) spelling swap, all four land at 21
// sessions/week; the swap itself is just re-pointing the Spelling rows.
const ENGLISH_MAP = {
    [className(3, 'Blue')]: 'English Teacher 1',
    [className(4, 'Blue')]: 'English Teacher 1',
    [className(4, 'Purple')]: 'English Teacher 1',
    [className(4, 'Lavender')]: 'English Teacher 1',

    [className(3, 'Yellow')]: 'English Teacher 2',
    [className(4, 'Crimson')]: 'English Teacher 2',
    [className(4, 'Green')]: 'English Teacher 2',
    [className(4, 'Yellow')]: 'English Teacher 2',

    [className(3, 'Red')]: 'English Teacher 3',
    [className(4, 'Magenta')]: 'English Teacher 3',
    [className(4, 'Red')]: 'English Teacher 3',

    [className(3, 'Green')]: 'English Teacher 4',
    [className(4, 'Violet')]: 'English Teacher 4',
    [className(4, 'Orange')]: 'English Teacher 4',
};

// Two-teacher subjects: T1 takes Year 3 Blue+Yellow and five Year 4 classes;
// T2 takes the rest.
const PAIRED_T1 = {
    y3: ['Blue', 'Yellow'],
    y4: ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green'],
};

const pairedTeacher = (subjectName, color, year) => {
    const inT1 = year === 3 ? PAIRED_T1.y3.includes(color) : PAIRED_T1.y4.includes(color);
    return `${subjectName} Teacher ${inT1 ? 1 : 2}`;
};

const PLACEHOLDER_TEACHERS = [
    'English Teacher 1', 'English Teacher 2', 'English Teacher 3', 'English Teacher 4',
    'Amharic Teacher 1', 'Amharic Teacher 2',
    'Music Teacher 1', 'Music Teacher 2',
    'Art Teacher 1', 'Art Teacher 2',
    'Physical Education Teacher 1', 'Physical Education Teacher 2',
    'French Teacher 1',
    'ICT Teacher 1',
];

// Sessions per week per class.
const LOAD = {
    MAT: 5, SCI: 3, GCT: 2,           // main teacher
    ENG: 5, SPL: 1,                    // English teacher (5 English + 1 Spelling)
    AMH: 2, MUS: 2, ART: 2, PE: 2,     // paired subject teachers
    FRA: 1, ICT: 1,                    // single subject teachers
};

const SUBJECT_BY_CODE = {
    MAT: 'Mathematics', SCI: 'Science', GCT: 'Global Citizenship',
    ENG: 'English', SPL: 'Spelling',
    AMH: 'Amharic', MUS: 'Music', ART: 'Art', PE: 'Physical Education',
    FRA: 'French', ICT: 'ICT',
};

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '.');

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) throw new Error('No school found — run the seed script first.');

    const { data: year } = await supabase.from('academic_years')
        .select('id').eq('school_id', school.id).eq('name', YEAR_NAME).maybeSingle();
    if (!year) throw new Error(`Academic year ${YEAR_NAME} not found — run setup:year first.`);

    console.log(`School ${school.id} · year ${YEAR_NAME}${DRY_RUN ? ' · DRY RUN' : ''}\n`);

    // ── 1. Subjects: renames + Spelling + Registration ────────────────────
    if (!DRY_RUN) {
        await supabase.from('subjects').update({ name: 'Global Citizenship' })
            .eq('school_id', school.id).eq('name', 'Global Studies');
        await supabase.from('subjects').update({ name: 'Art' })
            .eq('school_id', school.id).eq('name', 'Arts');

        const { data: existingSubjects } = await supabase.from('subjects')
            .select('code').eq('school_id', school.id);
        const codes = new Set((existingSubjects || []).map((s) => s.code));

        const toCreate = [];
        if (!codes.has('SPL')) {
            toCreate.push({ school_id: school.id, name: 'Spelling', code: 'SPL', taught_by: 'subject_teacher', is_semester: false });
        }
        if (!codes.has('REG')) {
            toCreate.push({ school_id: school.id, name: 'Registration', code: 'REG', taught_by: 'main_teacher', is_semester: false });
        }
        if (toCreate.length > 0) {
            const { error } = await supabase.from('subjects').insert(toCreate);
            if (error) throw error;
            console.log(`Created subjects: ${toCreate.map((s) => s.name).join(', ')}`);
        }
    } else {
        console.log('(dry) would rename Global Studies -> Global Citizenship, Arts -> Art; ensure Spelling + Registration exist');
    }

    // ── 2. Placeholder teachers ────────────────────────────────────────────
    const { data: existingUsers } = await supabase.from('users')
        .select('id, name').eq('school_id', school.id);
    const userByName = new Map((existingUsers || []).map((u) => [u.name, u]));

    if (!DRY_RUN) {
        const hash = await bcrypt.hash(TEMP_PASSWORD, 12);
        const newTeachers = [];
        for (const name of PLACEHOLDER_TEACHERS) {
            if (!userByName.has(name)) {
                newTeachers.push({
                    school_id: school.id,
                    name,
                    email: `${slug(name)}@bisnocgerji.local`,
                    password_hash: hash,
                    role: 'subject_teacher',
                    is_active: true,
                });
            }
        }
        if (newTeachers.length > 0) {
            const { data: created, error } = await supabase.from('users')
                .insert(newTeachers).select('id, name');
            if (error) throw error;
            created.forEach((u) => userByName.set(u.name, u));
            console.log(`Created ${created.length} placeholder teachers (${created.map((u) => u.name).join(', ')})`);
        } else {
            console.log('Placeholder teachers already exist');
        }
    } else {
        console.log(`(dry) would ensure placeholder teachers: ${PLACEHOLDER_TEACHERS.join(', ')}`);
    }

    // ── 3. Classes + main teachers ────────────────────────────────────────
    const allClassNames = [
        ...YEAR3_CLASSES.map((c) => className(3, c)),
        ...YEAR4_CLASSES.map((c) => className(4, c)),
    ];
    const { data: classes } = await supabase.from('classes')
        .select('id, name').eq('school_id', school.id).in('name', allClassNames);
    const classByName = new Map((classes || []).map((c) => [c.name, c]));

    const missing = allClassNames.filter((n) => !classByName.has(n));
    if (missing.length > 0) {
        throw new Error(`Classes missing from the database: ${missing.join(', ')} — run setup:year first.`);
    }

    const { data: staff } = await supabase.from('class_staff')
        .select('class_id, user_id')
        .eq('academic_year_id', year.id)
        .eq('position', 'main');
    const mainByClass = new Map((staff || []).map((s) => [s.class_id, s.user_id]));

    const unstaffed = allClassNames.filter((n) => !mainByClass.get(classByName.get(n).id));
    if (unstaffed.length > 0) {
        throw new Error(`No main teacher assigned for: ${unstaffed.join(', ')} — assign them first (migration 012 or the admin UI).`);
    }

    // ── 4. Build the assignment plan ──────────────────────────────────────
    const plan = []; // {className, code, teacherName, sessions}
    for (const name of allClassNames) {
        const color = name.split(' - ')[1];
        const yearNum = Number(name.split(' ')[1]);
        const main = '<main>';

        plan.push(
            { className: name, code: 'MAT', teacherName: main, sessions: LOAD.MAT },
            { className: name, code: 'SCI', teacherName: main, sessions: LOAD.SCI },
            { className: name, code: 'GCT', teacherName: main, sessions: LOAD.GCT },
            { className: name, code: 'REG', teacherName: main, sessions: 5 },
            { className: name, code: 'ENG', teacherName: ENGLISH_MAP[name], sessions: LOAD.ENG },
            { className: name, code: 'SPL', teacherName: ENGLISH_MAP[name], sessions: LOAD.SPL },
            { className: name, code: 'FRA', teacherName: 'French Teacher 1', sessions: LOAD.FRA },
            { className: name, code: 'ICT', teacherName: 'ICT Teacher 1', sessions: LOAD.ICT },
        );
        for (const [code, subjName] of [['AMH', 'Amharic'], ['MUS', 'Music'], ['ART', 'Art'], ['PE', 'Physical Education']]) {
            plan.push({ className: name, code, teacherName: pairedTeacher(subjName, color, yearNum), sessions: LOAD[code] });
        }
    }

    // Resolve teacher names to ids (after placeholder creation).
    const teacherIdFor = (name, classNameForMain) => {
        if (name === '<main>') return mainByClass.get(classByName.get(classNameForMain).id);
        return userByName.get(name)?.id;
    };

    // ── 5. Upsert class_subjects ───────────────────────────────────────────
    const assignmentRows = plan.map((p) => ({
        school_id: school.id,
        academic_year_id: year.id,
        class_id: classByName.get(p.className).id,
        subject_id: null, // filled below after subject lookup
        teacher_id: teacherIdFor(p.teacherName, p.className),
        sessions_per_week: p.sessions,
        _code: p.code,
    }));

    const { data: subjects } = await supabase.from('subjects')
        .select('id, code').eq('school_id', school.id);
    const subjectByCode = new Map((subjects || []).map((s) => [s.code, s.id]));
    for (const row of assignmentRows) {
        row.subject_id = subjectByCode.get(row._code);
        delete row._code;
        if (!row.subject_id) throw new Error(`Subject missing for code ${row._code}`);
        if (!row.teacher_id) throw new Error(`Teacher not found for an assignment in ${row.className}`);
    }

    if (!DRY_RUN) {
        const { error } = await supabase.from('class_subjects').upsert(
            assignmentRows.map(({ school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week }) => (
                { school_id, academic_year_id, class_id, subject_id, teacher_id, sessions_per_week }
            )),
            { onConflict: 'class_id,subject_id,academic_year_id' }
        );
        if (error) throw error;
        console.log(`Upserted ${assignmentRows.length} teaching assignments`);
    } else {
        console.log(`(dry) would upsert ${assignmentRows.length} teaching assignments`);
    }

    // ── 6. Generate the week ───────────────────────────────────────────────
    const generatorInput = plan
        .filter((p) => p.code !== 'REG')
        .map((p) => ({
            classId: classByName.get(p.className).id,
            className: p.className,
            subjectCode: p.code,
            teacherId: teacherIdFor(p.teacherName, p.className),
            sessions: p.sessions,
        }));

    const result = generateWeek(generatorInput);
    if (!result.ok) throw new Error(`Timetable generation failed: ${result.reason}`);

    // Load the class_subject ids we need for slot rows.
    const { data: assignmentIds } = await supabase.from('class_subjects')
        .select('id, class_id, subject_id, teacher_id')
        .eq('academic_year_id', year.id);
    const csKey = (classId, subjectId) => `${classId}|${subjectId}`;
    const csByKey = new Map((assignmentIds || []).map((r) => [csKey(r.class_id, r.subject_id), r]));

    const slotRows = [];

    // Registration: 08:10–08:30 every day, main teacher.
    for (const name of allClassNames) {
        const cs = csByKey.get(csKey(classByName.get(name).id, subjectByCode.get('REG')));
        if (!cs) throw new Error(`Registration assignment missing for ${name}`);
        for (const day of DAYS) {
            slotRows.push({
                school_id: school.id,
                academic_year_id: year.id,
                class_subject_id: cs.id,
                day_of_week: day,
                starts_at: REGISTRATION.start,
                ends_at: REGISTRATION.end,
            });
        }
    }

    // Lesson sessions.
    for (const slot of result.slots) {
        const cs = csByKey.get(csKey(slot.assignment.classId, subjectByCode.get(slot.assignment.subjectCode)));
        if (!cs) throw new Error('Assignment row not found for a generated slot');
        const [start, end] = LESSON_PERIODS[slot.period];
        slotRows.push({
            school_id: school.id,
            academic_year_id: year.id,
            class_subject_id: cs.id,
            day_of_week: slot.day,
            starts_at: start,
            ends_at: end,
        });
    }

    console.log(`Generated ${slotRows.length} timetable slots (${allClassNames.length} classes × (5 registration + 26 lessons))`);

    if (DRY_RUN) {
        console.log('(dry) no writes performed');
        return;
    }

    if (WIPE) {
        const { error } = await supabase.from('timetable_slots')
            .delete().eq('academic_year_id', year.id);
        if (error) throw error;
        console.log('Wiped existing timetable slots for the year');
    }

    // Insert in batches; the GIST constraints reject any double-booking.
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < slotRows.length; i += BATCH) {
        const { error } = await supabase.from('timetable_slots').insert(slotRows.slice(i, i + BATCH));
        if (error) throw error;
        inserted += Math.min(BATCH, slotRows.length - i);
    }
    console.log(`Inserted ${inserted} timetable slots — timetable is live.`);
}

main().catch((err) => {
    console.error('\nSetup failed:', err.message || err);
    process.exit(1);
});
