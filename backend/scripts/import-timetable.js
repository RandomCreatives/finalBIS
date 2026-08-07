/**
 * Import the timetable from timetable_sample.csv.
 *
 * Strategy:
 *   1. Parse the CSV with the xlsx library (handles multi-line cells).
 *   2. Create any subjects the CSV references that do not exist yet.
 *   3. For each class, upsert a class_subjects assignment per subject so that
 *      the teacher matches the CSV (English keeps its existing teacher when the
 *      CSV names none).
 *   4. Create one timetable_slots row per lesson, using the API so the
 *      double-booking EXCLUDE constraints still apply.
 *
 * Usage: node scripts/import-timetable.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const API = 'http://localhost:5000/api';
const CSV = 'D:/DEV_TRIAL/BISFINAL/timetable_sample.csv';
const DRY_RUN = process.argv.includes('--dry-run');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

// Subjects always taught by the class main teacher (per the CSV).
const MAIN_TAUGHT = new Set(['Mathematics', 'Science', 'Geography', 'History', 'Spelling']);

// Lesson columns -> start/end times.
const LESSONS = [
    { col: 2, startsAt: '08:30', endsAt: '09:20' },
    { col: 3, startsAt: '09:20', endsAt: '10:10' },
    { col: 5, startsAt: '10:40', endsAt: '11:30' },
    { col: 6, startsAt: '11:30', endsAt: '12:20' },
    { col: 8, startsAt: '13:10', endsAt: '14:00' },
    { col: 10, startsAt: '14:10', endsAt: '15:00' },
];

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

async function api(endpoint, options = {}, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`API ${options.method || 'GET'} ${endpoint} -> ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return data;
}

function parseCsv() {
    const wb = XLSX.readFile(CSV);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // class -> day -> lessonIndex -> { subject, teacher }
    // Layout: a class name in column 0 starts a block of 5 day-rows (Mon-Fri).
    const grid = {};
    let klass = null;
    for (const row of rows) {
        const col0 = String(row[0] || '').trim();
        const day = DAY_MAP[col0] ? col0 : null;
        if (!day) {
            if (col0) klass = col0; // new class block
            continue;
        }
        if (!klass) continue;
        for (let i = 0; i < LESSONS.length; i++) {
            const cell = String(row[LESSONS[i].col] || '').trim();
            if (!cell) continue;
            const lines = cell.split('\n').map((l) => l.trim()).filter(Boolean);
            const subject = SUBJECT_MAP[lines[0]];
            if (!subject) throw new Error(`Unknown subject label in ${klass} ${day} cell: "${lines[0]}"`);
            const rawTeacher = lines[1] && lines[1] !== 'N/A' ? lines[1] : null;
            if (!grid[klass]) grid[klass] = {};
            if (!grid[klass][day]) grid[klass][day] = [];
            grid[klass][day].push({ lesson: i, subject, teacher: rawTeacher });
        }
    }
    return grid;
}

async function main() {
    const login = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@bisnoc.local', password: 'changeme123' }),
    });
    const token = login.token;

    const [usersRes, classesRes, subjectsRes, staffRes, assignRes] = await Promise.all([
        api('/users', {}, token),
        api('/classes', {}, token),
        api('/subjects', {}, token),
        api('/assignments/class-staff', {}, token),
        api('/assignments/subjects', {}, token),
    ]);

    const users = usersRes.users;
    const classes = classesRes.classes;
    const subjects = subjectsRes.subjects;
    const staff = staffRes.staff;
    const assignments = assignRes.assignments || [];

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

    // main / assistant per class id
    const mainOfClass = {};
    const asstOfClass = {};
    staff.forEach((s) => {
        if (s.position === 'main') mainOfClass[s.classId] = s.user;
        if (s.position === 'assistant') asstOfClass[s.classId] = s.user;
    });

    // Existing assignment lookup by classId+subjectName
    const assignByClassSubject = {};
    assignments.forEach((a) => {
        const key = `${a.classId}|${a.subject?.name}`;
        assignByClassSubject[key] = a;
    });

    // ---- Create missing subjects ----
    const wanted = [
        { name: 'ICT', code: 'ICT', taughtBy: 'subject_teacher' },
        { name: 'Geography', code: 'GEO', taughtBy: 'main_teacher' },
        { name: 'History', code: 'HIS', taughtBy: 'main_teacher' },
        { name: 'Spelling', code: 'SPL', taughtBy: 'main_teacher' },
    ];
    for (const w of wanted) {
        if (!subjectByName[w.name]) {
            if (DRY_RUN) {
                console.log(`[dry-run] would create subject ${w.name}`);
                subjectByName[w.name] = { id: `dry-${w.name}`, name: w.name };
                continue;
            }
            const res = await api('/subjects', {
                method: 'POST',
                body: JSON.stringify(w),
            }, token);
            const created = res.subject || res;
            subjectByName[w.name] = created;
            console.log(`Created subject ${w.name} (${created.id})`);
        }
    }

    // ---- Teacher resolver ----
    const firstNameCount = {};
    users.forEach((u) => {
        const first = norm(u.name.split(' ')[0]);
        firstNameCount[first] = (firstNameCount[first] || 0) + 1;
    });
    const nameCandidates = users.map((u) => ({
        id: u.id, name: u.name,
        firstKey: norm(u.name.split(' ')[0]),
        fullKey: norm(u.name),
    }));

    const resolveTeacher = (shortName, classId) => {
        if (!shortName) return null;
        const base = norm(shortName.replace(/^(mr|ms|mrs|miss)\.?\s*/i, '').trim());

        // Prefer the class main teacher (handles "Ms. Mekdelawit" ambiguity +
        // main-taught subjects like Math/Science).
        const main = mainOfClass[classId];
        if (main && (norm(main.name.split(' ')[0]) === base || norm(main.name).includes(base))) {
            return main.id;
        }

        // Exact first-name match; fall back to fuzzy (e.g. Kaleab ~ Kalab,
        // Deginet ~ Degnet) and prefix (Gebre ~ Gebremariam).
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
    };

    // ---- Parse CSV ----
    const grid = parseCsv();
    const classNames = Object.keys(grid).sort();
    console.log(`Parsed ${Object.values(grid).reduce((n, d) => n + Object.values(d).reduce((m, a) => m + a.length, 0), 0)} lessons across ${classNames.length} classes\n`);

    // ---- Plan assignments + slots ----
    const plan = []; // { classId, className, subject, teacherId, sessionsPerWeek }
    const slots = []; // { classId, className, subject, classSubjectId, dayOfWeek, startsAt, endsAt, teacherSpecified }

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
                const tid = resolveTeacher(teacher, classId);
                if (tid) {
                    rec.teacherId = tid;
                    rec.specified = teacher;
                }
                const existing = assignByClassSubject[`${classId}|${subject}`];
                const finalTeacherId = tid ?? existing?.teacherId ?? null;
                slots.push({
                    classId, className, subject, classSubjectId: existing?.id ?? null,
                    dayOfWeek: DAY_MAP[day], lesson, finalTeacherId,
                });
            }
        }

        for (const subject of Object.keys(perSubject)) {
            const rec = perSubject[subject];
            const existing = assignByClassSubject[`${classId}|${subject}`];
            let teacherId = rec.teacherId;
            if (MAIN_TAUGHT.has(subject) && !teacherId) teacherId = mainOfClass[classId]?.id ?? null;
            if (!teacherId && existing) teacherId = existing.teacherId;
            plan.push({ classId, className, subject, teacherId: teacherId ?? null, sessionsPerWeek: rec.count, existingId: existing?.id });
        }
    }

    // ---- Apply assignments ----
    console.log('--- Subject assignments ---');
    for (const p of plan) {
        const subj = subjectByName[p.subject];
        if (!subj) throw new Error(`Subject "${p.subject}" not found after creation`);
        const existing = assignByClassSubject[`${p.classId}|${p.subject}`];
        const action =
            existing && existing.teacherId === p.teacherId
                ? 'keep'
                : existing
                    ? 'update'
                    : 'create';
        if (DRY_RUN) {
            console.log(`[dry-run] ${p.className}: ${p.subject} -> ${p.teacherId ?? 'none'} (${action}, ${p.sessionsPerWeek}/wk)`);
            continue;
        }
        if (action === 'keep') {
            console.log(`${p.className}: ${p.subject} = ${p.teacherId ?? 'none'} (unchanged)`);
        } else {
            const res = await api('/assignments/subjects', {
                method: 'PUT',
                body: JSON.stringify({
                    classId: p.classId,
                    subjectId: subj.id,
                    teacherId: p.teacherId,
                    sessionsPerWeek: p.sessionsPerWeek,
                }),
            }, token);
            const created = res.assignment || res;
            assignByClassSubject[`${p.classId}|${p.subject}`] = {
                id: created.id,
                classId: p.classId,
                subject: subj,
                teacherId: created.teacherId ?? p.teacherId,
            };
            console.log(`${p.className}: ${p.subject} -> ${p.teacherId ?? 'none'} (${action})`);
        }
    }

    if (DRY_RUN) {
        console.log(`\n[dry-run] would create ${slots.length} timetable slots`);
        return;
    }

    // ---- Resolve school + current academic year for direct inserts ----
    const { data: adminUser } = await supabase
        .from('users')
        .select('school_id')
        .eq('email', 'admin@bisnoc.local')
        .maybeSingle();
    const schoolId = adminUser?.school_id;
    const { data: curYear } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    const yearId = curYear?.id;
    if (!schoolId || !yearId) throw new Error('Could not resolve school_id / academic_year_id');

    // ---- Detect slots that already exist (idempotent re-runs) ----
    const { data: existingSlots } = await supabase
        .from('timetable_slots')
        .select('id, class_id, day_of_week, starts_at')
        .eq('school_id', schoolId)
        .eq('academic_year_id', yearId);
    const existingKeys = new Set((existingSlots || []).map((s) => `${s.class_id}|${s.day_of_week}|${s.starts_at}`));
    let skippedExisting = 0;
    const toCreate = slots.filter((s) => {
        if (existingKeys.has(`${s.classId}|${s.dayOfWeek}|${LESSONS[s.lesson].startsAt}`)) {
            skippedExisting++;
            return false;
        }
        return true;
    });
    console.log(`${skippedExisting} slots already exist, ${toCreate.length} to create`);

    // ---- Create slots directly via Supabase (bypasses HTTP rate limit;
    //      DB triggers still fill class_id/teacher_id, EXCLUDE constraints
    //      still prevent double-booking). ----
    console.log(`\n--- Creating ${toCreate.length} timetable slots ---`);
    let created = 0;
    let failed = 0;
    const errors = [];

    for (const s of toCreate) {
        const assign = assignByClassSubject[`${s.classId}|${s.subject}`];
        if (!assign?.id) {
            failed++;
            errors.push(`${s.className} ${s.dayOfWeek}/${s.lesson} ${s.subject}: no assignment id`);
            continue;
        }
        const { error } = await supabase.from('timetable_slots').insert({
            school_id: schoolId,
            academic_year_id: yearId,
            class_subject_id: assign.id,
            class_id: '00000000-0000-0000-0000-000000000000',
            day_of_week: s.dayOfWeek,
            starts_at: LESSONS[s.lesson].startsAt,
            ends_at: LESSONS[s.lesson].endsAt,
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

main().catch((e) => {
    console.error('\nFATAL:', e.message);
    process.exit(1);
});
