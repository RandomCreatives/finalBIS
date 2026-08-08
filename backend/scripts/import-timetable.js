/**
 * Import the timetable into the database WITHOUT the HTTP API, so the
 * 300 requests / 15 min rate limiter can never abort a run.
 *
 * Inputs:
 *   - The CSV supplies the FORMAT: which first-column cell starts a class
 *     block (the colour labels only exist in the CSV), which columns are the
 *     six lessons, and the Mon–Fri row order.
 *   - The JSON supplies the DATA: the per-cell values the CSV→JSON converter
 *     produced by treating the colour-label row as its header row, so
 *     JSON row i == CSV row i+1 and the columns map to FIELD2..FIELD11.
 *
 * Every write goes straight to Supabase with the service key — a single bulk
 * upsert covers all class_subjects assignments and each slot is inserted
 * directly, so the timetable's double-booking EXCLUDE constraints still apply
 * (class_id/teacher_id are filled by the DB trigger).
 *
 * Usage:
 *   node scripts/import-timetable.js [--dry-run] [--csv=path] [--json=path]
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
// Remove every existing timetable_slots row for the current year first, so a
// stale or partial previous import cannot block the fresh one with overlapping
// slots. Safe: nothing references timetable_slots.
const WIPE = process.argv.includes('--wipe');
const flag = (name) => {
    const hit = process.argv.find((a) => a.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : null;
};
const CSV = flag('--csv') || path.join(__dirname, '..', '..', 'timetable_sample.csv');
const JSON_FILE = flag('--json') || path.join(__dirname, '..', '..', '..', 'timetable_sample.json');

// CSV subject label -> system subject name
const SUBJECT_MAP = {
    Amharic: 'Amharic',
    Art: 'Arts',
    English: 'English',
    French: 'French',
    Geography: 'Geography',
    History: 'History',
    ICT: 'ICT',
    Math: 'Mathematics',
    Music: 'Music',
    PE: 'Physical Education',
    Science: 'Science',
    Spelling: 'Spelling',
};

// Default system code for each subject name (used only when a referenced
// subject is missing and has to be created on the fly).
const SUBJECT_CODE = {
    Amharic: 'AMH', Arts: 'ART', English: 'ENG', French: 'FRA',
    Geography: 'GEO', History: 'HIS', ICT: 'ICT', Mathematics: 'MAT',
    Music: 'MUS', 'Physical Education': 'PE', Science: 'SCI', Spelling: 'SPL',
};

// Subjects always taught by the class main teacher (per the CSV).
const MAIN_TAUGHT = new Set(['Mathematics', 'Science', 'Geography', 'History', 'Spelling']);

// Lesson index -> start/end times (same periods as the CSV header row).
const LESSON_TIMES = [
    { startsAt: '08:30', endsAt: '09:20' },
    { startsAt: '09:20', endsAt: '10:10' },
    { startsAt: '10:40', endsAt: '11:30' },
    { startsAt: '11:30', endsAt: '12:20' },
    { startsAt: '13:10', endsAt: '14:00' },
    { startsAt: '14:10', endsAt: '15:00' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MAP = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

const bestFuzzy = (base, candidates) => {
    let best = null, bestScore = Infinity;
    for (const c of candidates) {
        const score = levenshtein(base, c.key);
        if (score < bestScore) { bestScore = score; best = c; }
    }
    // Accept if edit distance is small relative to the name length.
    return best && bestScore <= 2 ? best : null;
};

// ---------------------------------------------------------------------------
// FORMAT — read from the CSV: which columns are lessons, and the class/day
// structure. A first-column cell that is not a weekday starts a class block;
// the colour labels live only in the CSV (the JSON converter ate that row).
// ---------------------------------------------------------------------------

function parseHeader(row) {
    const map = new Map(); // column index -> lesson index (0-based)
    (row || []).forEach((cell, col) => {
        const m = /^Lesson\s*(\d+)/.exec(String(cell || ''));
        if (m) map.set(col, Number(m[1]) - 1);
    });
    return map;
}

function parseFormat(rows) {
    const fmt = []; // { row, role: 'class'|'header'|'day'|'blank', ... }
    let klass = null;
    let lessonCols = null;
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r] || [];
        const col0 = String(row[0] || '').trim();
        if (DAYS.includes(col0)) {
            fmt.push({ row: r, role: 'day', classColor: klass, day: col0, lessonCols });
        } else if (col0) {
            klass = col0;
            lessonCols = null;
            fmt.push({ row: r, role: 'class', classColor: col0 });
        } else if ((row || []).some((c) => /^Lesson\s*\d/.test(String(c)))) {
            lessonCols = parseHeader(row);
            fmt.push({ row: r, role: 'header', classColor: klass, lessonCols });
        } else {
            fmt.push({ row: r, role: 'blank' });
        }
    }
    return fmt;
}

// ---------------------------------------------------------------------------
// DATA — read from the JSON. The converter dropped the CSV colour-label row,
// so JSON row i holds CSV row i+1; a day row's "Blue" key must match the day.
// ---------------------------------------------------------------------------

function parseGrid(fmt, json) {
    const grid = {}; // classColor -> day -> [{ lesson, subject, teacher }]
    for (const f of fmt) {
        if (f.role !== 'day') continue;
        const obj = json[f.row - 1];
        if (!obj) throw new Error(`No JSON row for CSV row ${f.row} (${f.day})`);
        if (String(obj.Blue || '').trim() !== f.day) {
            throw new Error(
                `JSON row ${f.row - 1} says "${obj.Blue}" but CSV row ${f.row} says "${f.day}"`
            );
        }
        if (!f.lessonCols) continue;
        for (const [col, lesson] of f.lessonCols) {
            const key = col === 0 ? 'Blue' : `FIELD${col + 1}`;
            const cell = String(obj[key] || '').trim();
            if (!cell) continue;
            const lines = cell.split('\n').map((l) => l.trim()).filter(Boolean);
            const subject = SUBJECT_MAP[lines[0]];
            if (!subject) {
                throw new Error(`Unknown subject label in ${f.classColor} ${f.day}: "${lines[0]}"`);
            }
            const rawTeacher = lines[1] && lines[1] !== 'N/A' ? lines[1] : null;
            if (!grid[f.classColor]) grid[f.classColor] = {};
            if (!grid[f.classColor][f.day]) grid[f.classColor][f.day] = [];
            grid[f.classColor][f.day].push({ lesson, subject, teacher: rawTeacher });
        }
    }
    return grid;
}

// ---------------------------------------------------------------------------

function resolveTeacher(shortName, classId, { users, mainOfClass }) {
    if (!shortName) return null;
    const base = norm(shortName.replace(/^(mr|ms|mrs|miss)\.?\s*/i, '').trim());

    // Prefer the class main teacher (handles "Ms. Mekdelawit" ambiguity +
    // main-taught subjects like Math/Science).
    const main = mainOfClass[classId];
    if (main && (norm(main.name.split(' ')[0]) === base || norm(main.name).includes(base))) {
        return main.id;
    }

    const nameCandidates = users.map((u) => ({
        id: u.id, name: u.name,
        firstKey: norm(u.name.split(' ')[0]),
        fullKey: norm(u.name),
    }));

    let exact = nameCandidates.filter((c) => c.firstKey === base);
    if (exact.length === 1) return exact[0].id;

    let prefix = nameCandidates.filter((c) => c.firstKey.startsWith(base) || base.startsWith(c.firstKey));
    if (prefix.length === 1) return prefix[0].id;

    const fuzzy = bestFuzzy(base, nameCandidates.map((c) => ({ ...c, key: c.firstKey })));
    if (fuzzy) return fuzzy.id;

    const fullExact = nameCandidates.filter((c) => c.fullKey === base);
    if (fullExact.length === 1) return fullExact[0].id;

    const fullPrefix = nameCandidates.filter((c) => c.fullKey.startsWith(base));
    if (fullPrefix.length === 1) return fullPrefix[0].id;

    const fullFuzzy = bestFuzzy(base, nameCandidates.map((c) => ({ ...c, key: c.fullKey })));
    if (fullFuzzy) return fullFuzzy.id;

    console.warn(`  !! cannot resolve teacher "${shortName}" (base "${base}") — leaving null`);
    return null;
}

async function main() {
    if (!fs.existsSync(CSV)) throw new Error(`CSV not found: ${CSV}`);
    if (!fs.existsSync(JSON_FILE)) throw new Error(`JSON not found: ${JSON_FILE}`);

    // ---- Resolve school + current academic year ----
    const { data: adminUser } = await supabase
        .from('users')
        .select('school_id')
        .eq('email', 'admin@bisnoc.local')
        .maybeSingle();
    const schoolId = adminUser?.school_id;
    if (!schoolId) throw new Error('Could not resolve school_id — has the school been seeded?');

    const { data: curYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    const yearId = curYear?.id;
    if (!yearId) throw new Error('No current academic year configured');

    if (WIPE) {
        const { error } = await supabase
            .from('timetable_slots')
            .delete()
            .eq('school_id', schoolId)
            .eq('academic_year_id', yearId);
        if (error) throw error;
        console.log(`Cleared existing timetable slots (year ${curYear.name})`);
    }

    // ---- Load reference data directly from Supabase (no API) ----
    const [classesRes, usersRes, subjectsRes, staffRes, assignRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId),
        supabase.from('users').select('id, name, email, role').eq('school_id', schoolId).eq('is_active', true),
        supabase.from('subjects').select('id, name, code, taught_by').eq('school_id', schoolId),
        supabase.from('class_staff').select('class_id, position, user:users(id, name)')
            .eq('school_id', schoolId).eq('academic_year_id', yearId),
        supabase.from('class_subjects')
            .select('id, class_id, teacher_id, subject:subjects(name)')
            .eq('school_id', schoolId).eq('academic_year_id', yearId),
    ]);
    for (const r of [classesRes, usersRes, subjectsRes, staffRes, assignRes]) {
        if (r.error) throw r.error;
    }

    const users = usersRes.data || [];
    const classes = classesRes.data || [];
    const subjects = subjectsRes.data || [];
    const staff = staffRes.data || [];
    const assignments = assignRes.data || [];

    const classById = {};
    classes.forEach((c) => { classById[c.id] = c; });
    const classNameToId = {};
    classes.forEach((c) => {
        classNameToId[c.name] = c.id;
        // CSV uses short names like "Blue"; system uses "Year 3 - Blue".
        const short = c.name.split('-').pop().trim();
        classNameToId[short] = c.id;
    });

    const subjectByName = {};
    subjects.forEach((s) => { subjectByName[s.name] = s; });

    // main teacher per class id
    const mainOfClass = {};
    staff.forEach((s) => { if (s.position === 'main') mainOfClass[s.class_id] = s.user; });

    // Existing assignment lookup by classId + subjectName
    const assignByClassSubject = {};
    assignments.forEach((a) => {
        assignByClassSubject[`${a.class_id}|${a.subject?.name}`] = {
            id: a.id,
            teacherId: a.teacher_id,
        };
    });

    // ---- Parse format (CSV) + data (JSON) ----
    const wb = XLSX.readFile(CSV);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const json = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

    const fmt = parseFormat(rows);
    const grid = parseGrid(fmt, json);
    const classNames = Object.keys(grid).sort();
    const lessonCount = Object.values(grid)
        .reduce((n, d) => n + Object.values(d).reduce((m, a) => m + a.length, 0), 0);
    console.log(`Parsed ${lessonCount} lessons across ${classNames.length} classes (${json.length} JSON rows, ${rows.length} CSV rows)\n`);

    // ---- Ensure every referenced subject exists ----
    const referenced = new Set();
    Object.values(grid).forEach((days) =>
        Object.values(days).forEach((cells) => cells.forEach((c) => referenced.add(c.subject)))
    );
    for (const name of referenced) {
        if (subjectByName[name]) continue;
        if (DRY_RUN) {
            console.log(`[dry-run] would create subject ${name}`);
            subjectByName[name] = { id: `dry-${name}`, name };
            continue;
        }
        const { data, error } = await supabase
            .from('subjects')
            .insert({
                school_id: schoolId,
                name,
                code: SUBJECT_CODE[name] || name.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase(),
                taught_by: MAIN_TAUGHT.has(name) ? 'main_teacher' : 'subject_teacher',
                is_semester: false,
            })
            .select('id, name, code, taught_by')
            .single();
        if (error) {
            if (error.code !== '23505') throw error;
            const { data: got } = await supabase
                .from('subjects').select('id, name, code, taught_by')
                .eq('school_id', schoolId).eq('name', name).single();
            subjectByName[name] = got;
            continue;
        }
        subjectByName[name] = data;
        console.log(`Created subject ${name} (${data.code})`);
    }

    // ---- Plan assignments + slots ----
    const plan = []; // { classId, className, subject, teacherId, sessionsPerWeek }
    const slots = []; // { classId, className, subject, dayOfWeek, lesson, finalTeacherId }

    for (const className of classNames) {
        const classId = classNameToId[className];
        if (!classId) throw new Error(`No class row for "${className}"`);

        const days = grid[className];
        const perSubject = {}; // subject -> { teacherId, count, specified }

        for (const day of Object.keys(days)) {
            for (const cell of days[day]) {
                const { lesson, subject, teacher } = cell;
                const rec = (perSubject[subject] = perSubject[subject] || { teacherId: null, count: 0, specified: null });
                rec.count++;
                const tid = resolveTeacher(teacher, classId, { users, mainOfClass });
                if (tid) {
                    rec.teacherId = tid;
                    rec.specified = teacher;
                }
                slots.push({
                    classId, className, subject,
                    dayOfWeek: DAY_MAP[day], lesson,
                    finalTeacherId: tid ?? assignByClassSubject[`${classId}|${subject}`]?.teacherId ?? null,
                });
            }
        }

        for (const subject of Object.keys(perSubject)) {
            const rec = perSubject[subject];
            const existing = assignByClassSubject[`${classId}|${subject}`];
            let teacherId = rec.teacherId;
            if (MAIN_TAUGHT.has(subject) && !teacherId) teacherId = mainOfClass[classId]?.id ?? null;
            if (!teacherId && existing) teacherId = existing.teacherId;
            plan.push({ classId, className, subject, teacherId: teacherId ?? null, sessionsPerWeek: rec.count });
        }
    }

    // ---- Apply assignments in ONE bulk upsert (direct, no API) ----
    console.log('--- Subject assignments ---');
    for (const p of plan) {
        const subj = subjectByName[p.subject];
        if (!subj) throw new Error(`Subject "${p.subject}" not found after creation`);
        const existing = assignByClassSubject[`${p.classId}|${p.subject}`];
        console.log(
            `${p.className}: ${p.subject} -> ${p.teacherId ?? 'none'} ` +
            `(${existing ? 'update' : 'create'}, ${p.sessionsPerWeek}/wk)`
        );
    }

    if (DRY_RUN) {
        console.log(`\n[dry-run] would create ${slots.length} timetable slots`);
        return;
    }

    const { error: upsertError } = await supabase
        .from('class_subjects')
        .upsert(
            plan.map((p) => ({
                school_id: schoolId,
                academic_year_id: yearId,
                class_id: p.classId,
                subject_id: subjectByName[p.subject].id,
                teacher_id: p.teacherId ?? null,
                sessions_per_week: p.sessionsPerWeek,
            })),
            { onConflict: 'class_id,subject_id,academic_year_id' }
        );
    if (upsertError) throw upsertError;

    // Re-read assignments so slots can point at the real ids.
    const { data: fresh, error: freshError } = await supabase
        .from('class_subjects')
        .select('id, class_id, teacher_id, subject:subjects(name)')
        .eq('school_id', schoolId).eq('academic_year_id', yearId);
    if (freshError) throw freshError;
    const freshByClassSubject = {};
    (fresh || []).forEach((a) => {
        freshByClassSubject[`${a.class_id}|${a.subject?.name}`] = a.id;
    });

    // ---- Detect slots that already exist (idempotent re-runs) ----
    const { data: existingSlots } = await supabase
        .from('timetable_slots')
        .select('id, class_id, day_of_week, starts_at')
        .eq('school_id', schoolId)
        .eq('academic_year_id', yearId);
    const existingKeys = new Set((existingSlots || []).map((s) => `${s.class_id}|${s.day_of_week}|${s.starts_at}`));
    let skippedExisting = 0;
    const toCreate = slots.filter((s) => {
        if (existingKeys.has(`${s.classId}|${s.dayOfWeek}|${LESSON_TIMES[s.lesson].startsAt}`)) {
            skippedExisting++;
            return false;
        }
        return true;
    });
    console.log(`${skippedExisting} slots already exist, ${toCreate.length} to create`);

    // ---- Create slots directly (bypasses the HTTP rate limit entirely;
    //      DB triggers fill class_id/teacher_id, EXCLUDE constraints still
    //      prevent double-booking). ----
    console.log(`\n--- Creating ${toCreate.length} timetable slots ---`);
    let created = 0;
    let failed = 0;
    const errors = [];

    for (const s of toCreate) {
        const assignId = freshByClassSubject[`${s.classId}|${s.subject}`];
        if (!assignId) {
            failed++;
            errors.push(`${s.className} ${s.dayOfWeek}/${s.lesson} ${s.subject}: no assignment id`);
            continue;
        }
        const { error } = await supabase.from('timetable_slots').insert({
            school_id: schoolId,
            academic_year_id: yearId,
            class_subject_id: assignId,
            class_id: '00000000-0000-0000-0000-000000000000',
            day_of_week: s.dayOfWeek,
            starts_at: LESSON_TIMES[s.lesson].startsAt,
            ends_at: LESSON_TIMES[s.lesson].endsAt,
        });
        if (error) {
            failed++;
            errors.push(`${s.className} ${s.dayOfWeek}/${s.lesson} ${s.subject}: ${error.code} ${(error.message || '').split('\n')[0]}`);
        } else {
            created++;
        }
    }

    console.log(`\nDone: ${created} slots created, ${failed} failed.`);
    if (errors.length) {
        console.log('\n--- Failures ---');
        errors.forEach((e) => console.log(' ', e));
    }
}

if (require.main === module) {
    main().catch((e) => {
        console.error('\nFATAL:', e.message);
        process.exit(1);
    });
}

module.exports = { parseFormat, parseGrid, SUBJECT_MAP, MAIN_TAUGHT, LESSON_TIMES, DAY_MAP, DAYS };
