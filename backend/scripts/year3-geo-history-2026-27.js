/**
 * One-off 2026/27 Year 3 curriculum alignment (coordinator decision 2026-09-18).
 *
 * Year 3 main teachers teach Math, Science, Geography and History in their
 * own classes. Year 3 - Green already carries GEO x2 + HIS x2; this script
 * brings Blue / Yellow / Red in line:
 *
 *   - removes the Global Citizenship x2 slots from Blue / Yellow / Red
 *     (the GLS assignment row is kept, unscheduled, for a possible Term 2
 *     return — same as Green's existing dormant GLS assignment),
 *   - creates GEO x2 + HIS x2 assignments per class (main teacher),
 *   - places the 12 new sessions around everything else, clash-free.
 *
 * Fully simulated before any write; aborts without touching the database
 * unless every session can be placed.
 *
 * Usage:
 *   node scripts/year3-geo-history-2026-27.js --dry-run
 *   node scripts/year3-geo-history-2026-27.js
 */

require('dotenv').config({ path: './.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const { generateWeek, LESSON_PERIODS } = require('../utils/timetableGenerator');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const YEAR_NAME = process.env.ACADEMIC_YEAR || '2026/2027';
const TARGET_CLASSES = ['Year 3 - Blue', 'Year 3 - Yellow', 'Year 3 - Red'];
const GLOBAL_CODES = ['GCT', 'GLS']; // subject may live under either code

const fail = (msg) => { console.error(`FAILED: ${msg}`); process.exit(1); };

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) fail('No school found');
    const { data: year } = await supabase.from('academic_years')
        .select('id').eq('school_id', school.id).eq('name', YEAR_NAME).maybeSingle();
    if (!year) fail(`Academic year ${YEAR_NAME} not found`);

    const { data: subjects } = await supabase.from('subjects').select('id, code').eq('school_id', school.id);
    const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code, s.id]));
    const subjectCode = Object.fromEntries(subjects.map((s) => [s.id, s.code]));
    for (const code of ['GEO', 'HIS']) {
        if (!subjectByCode[code]) fail(`Subject ${code} not found in the database`);
    }
    const globalCode = GLOBAL_CODES.find((c) => subjectByCode[c]);
    if (!globalCode) fail('Global Citizenship subject (GCT/GLS) not found');

    const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', school.id);
    const classByName = Object.fromEntries(classes.map((c) => [c.name, c.id]));
    for (const name of TARGET_CLASSES) if (!classByName[name]) fail(`Class not found: ${name}`);

    const { data: users } = await supabase.from('users').select('id, name').eq('school_id', school.id);
    const userName = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const targetIds = TARGET_CLASSES.map((n) => classByName[n]);
    const { data: staff } = await supabase.from('class_staff')
        .select('class_id, user_id').in('class_id', targetIds).eq('position', 'main');
    const mainOf = Object.fromEntries((staff || []).map((s) => [s.class_id, s.user_id]));
    for (const name of TARGET_CLASSES) {
        if (!mainOf[classByName[name]]) fail(`No main teacher for ${name}`);
    }

    // Current assignments for the target classes.
    const { data: assignments } = await supabase.from('class_subjects')
        .select('id, class_id, subject_id, teacher_id, sessions_per_week')
        .eq('academic_year_id', year.id).in('class_id', targetIds);
    const globalAsg = (assignments || []).filter((a) => GLOBAL_CODES.includes(subjectCode[a.subject_id]));
    const missingGlobal = TARGET_CLASSES.filter((n) => !globalAsg.find((a) => a.class_id === classByName[n]));
    if (missingGlobal.length > 0) fail(`Global Citizenship assignment missing for: ${missingGlobal.join(', ')} — is this already applied?`);

    // Already-correct GEO/HIS assignments (idempotency guard).
    const geoHis = (assignments || []).filter((a) => ['GEO', 'HIS'].includes(subjectCode[a.subject_id]));
    if (geoHis.length > 0) {
        fail(`GEO/HIS assignments already exist for: ${[...new Set(geoHis.map((a) => a.class_id))].map((id) => classes.find((c) => c.id === id)?.name).join(', ')} — aborting, looks applied already`);
    }

    const { data: globalSlots } = await supabase.from('timetable_slots')
        .select('id, class_id, teacher_id, day_of_week, starts_at')
        .in('class_subject_id', globalAsg.map((a) => a.id));
    console.log(`${DRY_RUN ? '(dry) ' : ''}Year 3 curriculum alignment`);
    console.log(`Removing ${globalSlots.length} Global Citizenship slots from ${TARGET_CLASSES.join(', ')}`);
    console.log('Adding GEO x2 + HIS x2 per class (main teacher, own class) = 12 sessions');

    // ── Simulate placement around the remaining week ──────────────────────
    const { data: allSlots } = await supabase.from('timetable_slots')
        .select('id, class_id, teacher_id, day_of_week, starts_at, class_subject_id')
        .eq('academic_year_id', year.id);
    const doomed = new Set((globalSlots || []).map((s) => s.id));
    const keeping = (allSlots || []).filter((s) => !doomed.has(s.id));

    const occupied = new Set();
    const teacherBusy = new Set();
    for (const s of keeping) {
        const period = LESSON_PERIODS.findIndex(([start]) => s.starts_at.startsWith(start));
        if (period < 0) continue;
        occupied.add(`${s.class_id}|${s.day_of_week}|${period}`);
        if (s.teacher_id) teacherBusy.add(`${s.teacher_id}|${s.day_of_week}|${period}`);
    }

    const input = [];
    for (const name of TARGET_CLASSES) {
        const cid = classByName[name];
        for (const code of ['GEO', 'HIS']) {
            input.push({ classId: cid, className: name, subjectCode: code, teacherId: mainOf[cid], sessions: 2 });
        }
    }
    const sim = generateWeek(input, occupied, true, teacherBusy);
    if (!sim.ok) fail(`generation failed in simulation: ${sim.reason}`);
    console.log(`Simulation: placed ${sim.slots.length}/12 sessions, ${sim.unplaced.length} unplaced`);
    if (sim.unplaced.length > 0) {
        sim.unplaced.forEach((u) => console.log(`  UNPLACED: ${u.className} ${u.subjectCode} (${userName[u.teacherId]})`));
        fail('not all sessions can be placed — aborting before ANY write');
    }

    if (DRY_RUN) {
        console.log('\n(dry) planned slots:');
        sim.slots
            .sort((a, b) => a.assignment.className.localeCompare(b.assignment.className) || a.day - b.day || a.period - b.period)
            .forEach((s) => console.log(`  ${s.assignment.className} · ${s.assignment.subjectCode}: day ${s.day}, ${LESSON_PERIODS[s.period].join('-')}`));
        console.log('(dry) no writes performed');
        return;
    }

    // ── 1. Delete Global Citizenship slots from the target classes ───────
    if (globalSlots.length > 0) {
        const { error } = await supabase.from('timetable_slots')
            .delete().in('id', globalSlots.map((s) => s.id));
        if (error) fail(`delete failed: ${error.message}`);
    }
    console.log(`Deleted ${globalSlots.length} Global Citizenship slot(s)`);

    // ── 2. Create the GEO/HIS assignments ─────────────────────────────────
    const rows = [];
    for (const name of TARGET_CLASSES) {
        for (const code of ['GEO', 'HIS']) {
            rows.push({
                school_id: school.id,
                academic_year_id: year.id,
                class_id: classByName[name],
                subject_id: subjectByCode[code],
                teacher_id: mainOf[classByName[name]],
                sessions_per_week: 2,
            });
        }
    }
    const { data: created, error: cErr } = await supabase.from('class_subjects')
        .upsert(rows, { onConflict: 'class_id,subject_id,academic_year_id' })
        .select('id, class_id, subject_id');
    if (cErr) fail(`assignment upsert failed: ${cErr.message}`);
    console.log(`Upserted ${created.length} GEO/HIS assignments`);

    const csByKey = Object.fromEntries(created.map((r) => [`${r.class_id}|${r.subject_id}`, r.id]));
    const slotRows = sim.slots.map((sl) => {
        const csId = csByKey[`${sl.assignment.classId}|${subjectByCode[sl.assignment.subjectCode]}`];
        if (!csId) throw new Error('assignment lookup failed for a generated slot');
        const [start, end] = LESSON_PERIODS[sl.period];
        return {
            school_id: school.id,
            academic_year_id: year.id,
            class_subject_id: csId,
            day_of_week: sl.day,
            starts_at: start,
            ends_at: end,
        };
    });
    const { error: iErr } = await supabase.from('timetable_slots').insert(slotRows);
    if (iErr) fail(`slot insert failed (DB constraint rejected it): ${iErr.message}`);
    console.log(`Inserted ${slotRows.length} GEO/HIS slot(s)`);

    // ── 3. Verify ─────────────────────────────────────────────────────────
    const { data: y3classes } = await supabase.from('classes').select('id, name').ilike('name', 'Year 3%');
    const { data: finalSlots } = await supabase.from('timetable_slots')
        .select('class_id, day_of_week, starts_at, teacher_id, cs:class_subjects(subject:subjects(code))')
        .eq('academic_year_id', year.id).in('class_id', y3classes.map((c) => c.id));

    const seenC = new Set();
    let clashes = 0;
    for (const s of finalSlots || []) {
        const k = `${s.class_id}|${s.day_of_week}|${s.starts_at}`;
        if (seenC.has(k)) clashes += 1;
        seenC.add(k);
    }
    console.log('\n── Live verification (Year 3) ───────────────────────────────');
    for (const c of y3classes) {
        const mine = (finalSlots || []).filter((s) => s.class_id === c.id);
        const tally = {};
        mine.forEach((s) => { const cd = s.cs?.subject?.code || '?'; tally[cd] = (tally[cd] || 0) + 1; });
        console.log(`  ${c.name}: ${mine.length} slots — MAT ${tally.MAT || 0} SCI ${tally.SCI || 0} GEO ${tally.GEO || 0} HIS ${tally.HIS || 0} GLS ${tally.GLS || tally.GCT || 0}`);
    }
    console.log(`Double-bookings: ${clashes}`);
    if (clashes > 0) fail('double-bookings detected — investigate immediately');
    console.log('\nYear 3 alignment complete.');
}

main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
