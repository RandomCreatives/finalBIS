/**
 * Sets up the 2026/27 teaching assignments and generates the weekly
 * timetable for all 14 classes.
 *
 *   node scripts/setup-timetable-2026-27.js [--dry-run] [--wipe]
 *
 * What it does (idempotent):
 *   1. Renames Global Studies -> Global Citizenship, Arts -> Art
 *   2. Creates the Spelling and Registration subjects if missing
 *   3. Creates placeholder subject-teacher accounts (English Teacher 1..3,
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

// supabase-js v2 needs a WebSocket implementation; Node >= 22 ships one
// natively, older runtimes (CI/dev boxes) fall back to the ws package.
if (typeof globalThis.WebSocket === 'undefined') {
    // eslint-disable-next-line global-require
    globalThis.WebSocket = require('ws');
}

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

// English: 3 teachers (reduced from 4 on 2026-09-18 by admin decision).
// Year 4 splits 3+3+4; Year 3 splits 2+2+0. Admin decision 2026-09-18:
// English Teacher 3 takes ALL Year 3 Spelling, landing every teacher on
// exactly 28 sessions/week:
//   T1: ENG Y3 Blue/Green + Y4 Blue/Purple/Lavender (25) + SPL Y4 B/P/L (3) = 28
//   T2: ENG Y3 Yellow/Red + Y4 Crimson/Green/Yellow (25) + SPL Y4 C/G/Y (3) = 28
//   T3: ENG Y4 Magenta/Red/Violet/Orange (20) + SPL Y4 M/R/V/O (4)
//       + SPL all Year 3 (4) = 28
const ENGLISH_MAP = {
    [className(3, 'Blue')]: 'English Teacher 1',
    [className(3, 'Green')]: 'English Teacher 1',
    [className(4, 'Blue')]: 'English Teacher 1',
    [className(4, 'Purple')]: 'English Teacher 1',
    [className(4, 'Lavender')]: 'English Teacher 1',

    [className(3, 'Yellow')]: 'English Teacher 2',
    [className(3, 'Red')]: 'English Teacher 2',
    [className(4, 'Crimson')]: 'English Teacher 2',
    [className(4, 'Green')]: 'English Teacher 2',
    [className(4, 'Yellow')]: 'English Teacher 2',

    [className(4, 'Magenta')]: 'English Teacher 3',
    [className(4, 'Red')]: 'English Teacher 3',
    [className(4, 'Violet')]: 'English Teacher 3',
    [className(4, 'Orange')]: 'English Teacher 3',
};

// Spelling: same as English for Year 4; ALL Year 3 spelling goes to T3.
const SPELLING_MAP = Object.fromEntries(
    Object.entries(ENGLISH_MAP).map(([name, t]) => [name, name.startsWith('Year 3') ? 'English Teacher 3' : t])
);

// Two-teacher subjects: T1 takes Year 3 Green+Red (admin re-split of
// 2026-09-18) and five Year 4 classes; T2 takes the rest.
const PAIRED_T1 = {
    y3: ['Green', 'Red'],
    y4: ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green'],
};

const pairedTeacher = (subjectName, color, year) => {
    const inT1 = year === 3 ? PAIRED_T1.y3.includes(color) : PAIRED_T1.y4.includes(color);
    return `${subjectName} Teacher ${inT1 ? 1 : 2}`;
};

const PLACEHOLDER_TEACHERS = [
    'English Teacher 1', 'English Teacher 2', 'English Teacher 3',
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
        // Global Citizenship may already exist as GLS (created earlier) —
        // rename its display name; otherwise create it as GCT.
        if (!codes.has('GCT') && !codes.has('GLS')) {
            toCreate.push({ school_id: school.id, name: 'Global Citizenship', code: 'GCT', taught_by: 'main_teacher', is_semester: true });
        }
        if (toCreate.length > 0) {
            const { error } = await supabase.from('subjects').insert(toCreate);
            if (error) throw error;
            console.log(`Created subjects: ${toCreate.map((s) => s.name).join(', ')}`);
        }
        if (codes.has('GLS')) {
            await supabase.from('subjects').update({ name: 'Global Citizenship' })
                .eq('school_id', school.id).eq('code', 'GLS');
        }
    } else {
        console.log('(dry) would rename Arts -> Art; ensure Spelling, Registration and Global Citizenship exist');
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
            { className: name, code: 'SPL', teacherName: SPELLING_MAP[name], sessions: LOAD.SPL },
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
        // In dry-run the placeholders haven't been created — use the name
        // itself as a stable synthetic id so the plan can still be validated.
        return userByName.get(name)?.id ?? (DRY_RUN ? name : undefined);
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
    // Global Citizenship may live under the older GLS code.
    if (!subjectByCode.has('GCT') && subjectByCode.has('GLS')) {
        subjectByCode.set('GCT', subjectByCode.get('GLS'));
    }
    // In dry-run, not-yet-created subjects resolve to synthetic ids.
    const subjectIdFor = (code) => subjectByCode.get(code) ?? (DRY_RUN ? `_dry_${code}` : null);
    for (const row of assignmentRows) {
        const code = row._code;
        delete row._code;
        row.subject_id = subjectIdFor(code);
        if (!row.subject_id) throw new Error(`Subject missing for code ${code}`);
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
    // Gap-fill by default: slots an admin already entered by hand are kept;
    // the generator only places what's missing around them. --wipe regenerates
    // everything from scratch instead.
    const occupied = new Set();      // `${classId}|${day}|${period}`
    const teacherBusyExisting = new Set(); // `${teacherId}|${day}|${period}`
    const existingCount = new Map(); // `${classId}|${subjectCode}` -> count
    const regDays = new Map();       // classId -> Set(day)

    if (!DRY_RUN && !WIPE) {
        const { data: existingSlots, error: exErr } = await supabase
            .from('timetable_slots')
            .select('class_id, teacher_id, day_of_week, starts_at, cs:class_subjects(subject:subjects(code))')
            .eq('academic_year_id', year.id);
        if (exErr) throw exErr;

        for (const s of existingSlots || []) {
            const period = LESSON_PERIODS.findIndex(([start]) => s.starts_at.startsWith(start));
            if (period >= 0) {
                occupied.add(`${s.class_id}|${s.day_of_week}|${period}`);
                if (s.teacher_id) teacherBusyExisting.add(`${s.teacher_id}|${s.day_of_week}|${period}`);
            }
            const code = s.cs?.subject?.code;
            if (code) {
                const key = `${s.class_id}|${code}`;
                existingCount.set(key, (existingCount.get(key) || 0) + 1);
                if (code === 'REG') {
                    if (!regDays.has(s.class_id)) regDays.set(s.class_id, new Set());
                    regDays.get(s.class_id).add(s.day_of_week);
                }
            }
        }
        if (occupied.size > 0) {
            console.log(`Found ${occupied.size} existing slots — filling gaps around them (use --wipe to regenerate all)`);
        }
    }

    const generatorInput = plan
        .filter((p) => p.code !== 'REG')
        .map((p) => ({
            classId: classByName.get(p.className).id,
            className: p.className,
            subjectCode: p.code,
            teacherId: teacherIdFor(p.teacherName, p.className),
            sessions: Math.max(
                0,
                p.sessions - (existingCount.get(`${classByName.get(p.className).id}|${p.code}`) || 0)
            ),
        }))
        .filter((p) => p.sessions > 0);

    // Gap-fill is best-effort: a class already (nearly) full from manual
    // entries simply gets fewer generated sessions rather than aborting.
    const gapFilling = !DRY_RUN && !WIPE;
    const result = generateWeek(generatorInput, occupied, gapFilling, teacherBusyExisting);
    if (!result.ok) throw new Error(`Timetable generation failed: ${result.reason}`);
    if (result.unplaced && result.unplaced.length > 0) {
        console.log(`Note: ${result.unplaced.length} session(s) had no free slot (class already nearly full from manual entries) — skipped:`);
        const byClass = {};
        result.unplaced.forEach((i) => { byClass[i.className] = (byClass[i.className] || 0) + 1; });
        Object.entries(byClass).forEach(([cn, n]) => console.log(`   ${cn}: ${n}`));
    }

    // Load the class_subject ids we need for slot rows.
    const csKey = (classId, subjectId) => `${classId}|${subjectId}`;
    let csByKey;
    if (DRY_RUN) {
        // Nothing was written — synthesize ids so the plan can be validated.
        csByKey = new Map(assignmentRows.map((r) => (
            [csKey(r.class_id, r.subject_id), { id: `_dry_${r.class_id}_${r.subject_id}` }]
        )));
    } else {
        const { data: assignmentIds } = await supabase.from('class_subjects')
            .select('id, class_id, subject_id, teacher_id')
            .eq('academic_year_id', year.id);
        csByKey = new Map((assignmentIds || []).map((r) => [csKey(r.class_id, r.subject_id), r]));
    }

    const slotRows = [];

    // Registration: 08:10–08:30 every day, main teacher — except days that
    // already have one.
    for (const name of allClassNames) {
        const classId = classByName.get(name).id;
        const cs = csByKey.get(csKey(classId, subjectIdFor('REG')));
        if (!cs) throw new Error(`Registration assignment missing for ${name}`);
        const done = regDays.get(classId) || new Set();
        for (const day of DAYS) {
            if (!WIPE && done.has(day)) continue;
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
        const cs = csByKey.get(csKey(slot.assignment.classId, subjectIdFor(slot.assignment.subjectCode)));
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

    console.log(`Prepared ${slotRows.length} new timetable slots (gap-fill mode${WIPE ? ' DISABLED — full regeneration' : ''})`);

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
