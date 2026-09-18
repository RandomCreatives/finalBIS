/**
 * One-off 2026/27 restructure (admin changes of 2026-09-18).
 *
 *   1. English drops from 4 to 3 teachers, balanced 28/28/28:
 *        T1: ENG Y3 Blue/Green + Y4 Blue/Purple/Lavender (25)
 *            + SPL Y4 Blue/Purple/Lavender (3)
 *        T2: ENG Y3 Yellow/Red + Y4 Crimson/Green/Yellow (25)
 *            + SPL Y4 Crimson/Green/Yellow (3)
 *        T3: ENG Y4 Magenta/Red/Violet/Orange (20)
 *            + SPL Y4 Magenta/Red/Violet/Orange (4)
 *            + SPL ALL Year 3 classes (4)          <- admin decision
 *
 *   2. Paired subjects (Amharic, Music, Art, PE): Year 3 split flips —
 *      Blue+Yellow move to Teacher 2, Green+Red move to Teacher 1.
 *      (Year 4 already matches the admin's wish.)
 *
 *   3. Deactivates the 'English Teacher 4' placeholder account.
 *
 * Strategy: the six affected subjects (ENG, SPL, AMH, MUS, ART, PE) are
 * fully regenerated — all their slots are deleted, the 84 assignments are
 * re-pointed, and the 196 sessions are placed from scratch around the
 * untouched subjects (REG, MAT, SCI, GCT, GEO, HIS, FRA, ICT). A full
 * in-memory simulation runs BEFORE any write; if every session cannot be
 * placed clash-free, the script aborts without touching the database.
 *
 * Usage:
 *   node scripts/restructure-timetable-2026-27.js --dry-run
 *   node scripts/restructure-timetable-2026-27.js
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

const cn = (year, color) => `Year ${year} - ${color}`;

// ── Target staffing (mirrors setup-timetable-2026-27.js) ───────────────────
const ENGLISH_MAP = {
    [cn(3, 'Blue')]: 'English Teacher 1',
    [cn(3, 'Green')]: 'English Teacher 1',
    [cn(4, 'Blue')]: 'English Teacher 1',
    [cn(4, 'Purple')]: 'English Teacher 1',
    [cn(4, 'Lavender')]: 'English Teacher 1',
    [cn(3, 'Yellow')]: 'English Teacher 2',
    [cn(3, 'Red')]: 'English Teacher 2',
    [cn(4, 'Crimson')]: 'English Teacher 2',
    [cn(4, 'Green')]: 'English Teacher 2',
    [cn(4, 'Yellow')]: 'English Teacher 2',
    [cn(4, 'Magenta')]: 'English Teacher 3',
    [cn(4, 'Red')]: 'English Teacher 3',
    [cn(4, 'Violet')]: 'English Teacher 3',
    [cn(4, 'Orange')]: 'English Teacher 3',
};
const SPELLING_MAP = Object.fromEntries(
    Object.entries(ENGLISH_MAP).map(([name, t]) => [name, name.startsWith('Year 3') ? 'English Teacher 3' : t])
);
const PAIRED_T1_Y3 = ['Green', 'Red'];
const PAIRED_T1_Y4 = ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green'];

const AFFECTED = ['ENG', 'SPL', 'AMH', 'MUS', 'ART', 'PE'];
const PAIRED_STEM = { AMH: 'Amharic', MUS: 'Music', ART: 'Art', PE: 'Physical Education' };

const targetTeacherFor = (code, className_) => {
    if (code === 'ENG') return ENGLISH_MAP[className_];
    if (code === 'SPL') return SPELLING_MAP[className_];
    const color = className_.split(' - ')[1];
    const isY3 = className_.startsWith('Year 3');
    const inT1 = (isY3 ? PAIRED_T1_Y3 : PAIRED_T1_Y4).includes(color);
    return `${PAIRED_STEM[code]} Teacher ${inT1 ? 1 : 2}`;
};

const fail = (msg) => { console.error(`FAILED: ${msg}`); process.exit(1); };

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) fail('No school found');
    const { data: year } = await supabase.from('academic_years')
        .select('id, name').eq('school_id', school.id).eq('name', YEAR_NAME).maybeSingle();
    if (!year) fail(`Academic year ${YEAR_NAME} not found`);

    const { data: subjects } = await supabase.from('subjects').select('id, code').eq('school_id', school.id);
    const subjectCode = Object.fromEntries(subjects.map((s) => [s.id, s.code]));
    const subjectId = Object.fromEntries(subjects.map((s) => [s.code, s.id]));

    const { data: users } = await supabase.from('users').select('id, name, is_active').eq('school_id', school.id);
    const userByName = Object.fromEntries(users.map((u) => [u.name, u.id]));
    const userName = Object.fromEntries(users.map((u) => [u.id, u.name]));

    const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', school.id);
    const classByName = Object.fromEntries(classes.map((c) => [c.name, c.id]));
    const className = Object.fromEntries(classes.map((c) => [c.id, c.name]));

    // ── Current assignments for the six affected subjects ────────────────
    const { data: assignments, error: asgErr } = await supabase.from('class_subjects')
        .select('id, class_id, subject_id, teacher_id, sessions_per_week')
        .eq('academic_year_id', year.id);
    if (asgErr) throw asgErr;

    const affected = (assignments || []).filter((a) => AFFECTED.includes(subjectCode[a.subject_id]));
    if (affected.length !== 84) fail(`Expected 84 affected assignments, found ${affected.length} — aborting`);

    // Re-point plan (only where the teacher actually changes).
    const moves = affected
        .map((a) => ({
            ...a,
            code: subjectCode[a.subject_id],
            name: className[a.class_id],
            target: targetTeacherFor(subjectCode[a.subject_id], className[a.class_id]),
        }))
        .filter((a) => userName[a.teacher_id] !== a.target);

    console.log(`${DRY_RUN ? '(dry) ' : ''}Restructure 2026/27`);
    console.log(`Affected assignments: ${affected.length} (6 subjects x 14 classes)`);
    console.log(`Assignments re-pointed: ${moves.length}`);
    for (const m of moves.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))) {
        console.log(`  ${m.name} · ${m.code}: ${userName[m.teacher_id]} -> ${m.target}`);
    }
    const unknown = moves.filter((m) => !userByName[m.target]);
    if (unknown.length > 0) fail(`Unknown target teachers: ${[...new Set(unknown.map((u) => u.target))].join(', ')}`);

    // ── Split current slots: regenerate the six subjects, keep the rest ──
    const { data: allSlots, error: sErr } = await supabase.from('timetable_slots')
        .select('id, class_id, teacher_id, day_of_week, starts_at, class_subject_id')
        .eq('academic_year_id', year.id);
    if (sErr) throw sErr;

    const affectedIds = new Set(affected.map((a) => a.id));
    const regenerating = (allSlots || []).filter((s) => affectedIds.has(s.class_subject_id));
    const keeping = (allSlots || []).filter((s) => !affectedIds.has(s.class_subject_id));
    const sessionsToPlace = affected.reduce((n, a) => n + a.sessions_per_week, 0);
    console.log(`\nSlots: ${allSlots.length} total -> keeping ${keeping.length}, regenerating ${regenerating.length}, target ${sessionsToPlace} sessions`);

    // ── Simulate the placement around the kept slots ─────────────────────
    const occupied = new Set();
    const teacherBusy = new Set();
    for (const s of keeping) {
        const period = LESSON_PERIODS.findIndex(([start]) => s.starts_at.startsWith(start));
        if (period < 0) continue; // registration etc. are not lesson periods
        occupied.add(`${s.class_id}|${s.day_of_week}|${period}`);
        if (s.teacher_id) teacherBusy.add(`${s.teacher_id}|${s.day_of_week}|${period}`);
    }

    // Deterministic canonical order: by class, then subject code.
    const ordered = [...affected].sort((a, b) => {
        const byClass = className[a.class_id].localeCompare(className[b.class_id]);
        return byClass || subjectCode[a.subject_id].localeCompare(subjectCode[b.subject_id]);
    });
    const buildInput = (list) => list.map((a) => ({
        classId: a.class_id,
        className: className[a.class_id],
        subjectCode: subjectCode[a.subject_id],
        teacherId: userByName[targetTeacherFor(subjectCode[a.subject_id], className[a.class_id])],
        sessions: a.sessions_per_week,
    }));

    const missingT = buildInput(ordered).filter((i) => !i.teacherId);
    if (missingT.length > 0) fail(`Unresolved teacher for: ${missingT.map((i) => `${i.className}/${i.subjectCode}`).join(', ')}`);

    // Greedy placement is order-sensitive; try the canonical order and a
    // fixed list of class-order rotations, take the first variant that
    // places every session. The variant list is fixed, so results stay
    // fully reproducible.
    const classGroups = [];
    for (const a of ordered) {
        const last = classGroups[classGroups.length - 1];
        if (last && last[0].class_id === a.class_id) last.push(a);
        else classGroups.push([a]);
    }
    const variants = [
        { label: 'canonical', list: ordered },
        ...classGroups.map((_, r) => ({
            label: `rotation-${r}`,
            list: [...classGroups.slice(r), ...classGroups.slice(0, r)].flat(),
        })),
    ];

    let sim = null;
    let variantUsed = null;
    for (const v of variants) {
        const attempt = generateWeek(buildInput(v.list), occupied, true, teacherBusy);
        if (!attempt.ok) continue;
        if (attempt.unplaced.length === 0) { sim = attempt; variantUsed = v.label; break; }
        if (!sim || attempt.unplaced.length < sim.unplaced.length) sim = attempt;
    }
    if (!sim) fail('generation failed in simulation');
    console.log(`\nSimulation: placed ${sim.slots.length}/${sessionsToPlace} sessions, ${sim.unplaced.length} unplaced (variant: ${variantUsed || 'none fully placed'})`);
    if (sim.unplaced.length > 0) {
        for (const u of sim.unplaced) console.log(`  UNPLACED: ${u.className} ${u.subjectCode} x${u.sessions} (${userName[u.teacherId]})`);
        fail(`${sim.unplaced.length} session(s) could not be placed — aborting before ANY write`);
    }

    // Verify the simulated afternoon: no class/teacher double-booking.
    const seenClass = new Set(keeping.map((s) => `${s.class_id}|${s.day_of_week}|${s.starts_at}`));
    const seenTeacher = new Set(keeping.filter((s) => s.teacher_id).map((s) => `${s.teacher_id}|${s.day_of_week}|${s.starts_at}`));
    let simClashes = 0;
    for (const sl of sim.slots) {
        const [start] = LESSON_PERIODS[sl.period];
        const ck = `${sl.assignment.classId}|${sl.day}|${start}`;
        const tk = `${sl.assignment.teacherId}|${sl.day}|${start}`;
        if (seenClass.has(ck) || seenTeacher.has(tk)) simClashes += 1;
        seenClass.add(ck);
        seenTeacher.add(tk);
    }
    if (simClashes > 0) fail(`simulation produced ${simClashes} clash(es) — aborting`);
    console.log('Simulation: 0 clashes');

    if (DRY_RUN) {
        const loads = {};
        for (const sl of sim.slots) {
            const t = userName[sl.assignment.teacherId];
            loads[t] = (loads[t] || 0) + 1;
        }
        console.log('\n(dry) resulting weekly loads for the affected teachers:');
        Object.entries(loads).sort().forEach(([t, n]) => console.log(`  ${t}: ${n}`));
        console.log('(dry) no writes performed');
        return;
    }

    // ── 1. Delete the regenerated subjects' slots ─────────────────────────
    if (regenerating.length > 0) {
        const BATCH = 200;
        const ids = regenerating.map((s) => s.id);
        for (let i = 0; i < ids.length; i += BATCH) {
            const { error } = await supabase.from('timetable_slots').delete().in('id', ids.slice(i, i + BATCH));
            if (error) fail(`slot delete failed: ${error.message}`);
        }
    }
    console.log(`\nDeleted ${regenerating.length} slot(s) for ENG/SPL/AMH/MUS/ART/PE`);

    // ── 2. Re-point the assignments (no linked slots -> cascade is safe) ─
    let repointed = 0;
    for (const m of moves) {
        const { error } = await supabase.from('class_subjects')
            .update({ teacher_id: userByName[m.target] }).eq('id', m.id);
        if (error) fail(`assignment update failed for ${m.name} ${m.code}: ${error.message}`);
        repointed += 1;
    }
    console.log(`Re-pointed ${repointed} assignment(s)`);

    // ── 3. Insert the regenerated slots (identical to the simulation) ────
    const csByKey = Object.fromEntries(affected.map((a) => [`${a.class_id}|${a.subject_id}`, a.id]));
    const slotRows = sim.slots.map((sl) => {
        const classId = sl.assignment.classId;
        const subjId = subjectId[sl.assignment.subjectCode];
        const csId = csByKey[`${classId}|${subjId}`];
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
    let inserted = 0;
    const BATCH = 100;
    for (let i = 0; i < slotRows.length; i += BATCH) {
        const { error } = await supabase.from('timetable_slots').insert(slotRows.slice(i, i + BATCH));
        if (error) fail(`slot insert failed (DB constraint rejected it): ${error.message}`);
        inserted += Math.min(BATCH, slotRows.length - i);
    }
    console.log(`Regenerated ${inserted} slot(s)`);

    // ── 4. Deactivate English Teacher 4 ───────────────────────────────────
    const et4 = userByName['English Teacher 4'];
    if (et4) {
        const { count: asgLeft } = await supabase.from('class_subjects')
            .select('id', { count: 'exact', head: true }).eq('academic_year_id', year.id).eq('teacher_id', et4);
        const { count: slotLeft } = await supabase.from('timetable_slots')
            .select('id', { count: 'exact', head: true }).eq('academic_year_id', year.id).eq('teacher_id', et4);
        if ((asgLeft || 0) > 0 || (slotLeft || 0) > 0) {
            fail(`English Teacher 4 still referenced (${asgLeft} assignments, ${slotLeft} slots) — not deactivated`);
        }
        const { error } = await supabase.from('users').update({ is_active: false }).eq('id', et4);
        if (error) throw error;
        console.log('Deactivated English Teacher 4 (no references remain)');
    }

    // ── 5. Live verification ─────────────────────────────────────────────
    const { data: finalSlots, error: fErr } = await supabase.from('timetable_slots')
        .select('id, class_id, teacher_id, day_of_week, starts_at, cs:class_subjects(subject:subjects(code))')
        .eq('academic_year_id', year.id);
    if (fErr) throw fErr;

    const seenC = new Set();
    const seenT = new Set();
    let clashes = 0;
    for (const s of finalSlots || []) {
        const ck = `${s.class_id}|${s.day_of_week}|${s.starts_at}`;
        const tk = s.teacher_id ? `${s.teacher_id}|${s.day_of_week}|${s.starts_at}` : null;
        if (seenC.has(ck) || (tk && seenT.has(tk))) clashes += 1;
        seenC.add(ck);
        if (tk) seenT.add(tk);
    }

    const engLoads = {};
    const pairedLoads = {};
    for (const s of finalSlots || []) {
        const code = s.cs?.subject?.code;
        const t = userName[s.teacher_id];
        if (!t) continue;
        if (['ENG', 'SPL'].includes(code)) engLoads[t] = (engLoads[t] || 0) + 1;
        else if (AFFECTED.includes(code)) pairedLoads[t] = (pairedLoads[t] || 0) + 1;
    }
    const perClass = {};
    for (const s of finalSlots || []) perClass[className[s.class_id]] = (perClass[className[s.class_id]] || 0) + 1;

    console.log('\n── Live verification ────────────────────────────────────────');
    console.log(`Total slots: ${finalSlots.length} · double-bookings: ${clashes}`);
    console.log('English loads (ENG+SPL):');
    Object.entries(engLoads).sort().forEach(([t, n]) => console.log(`  ${t}: ${n}`));
    console.log('Paired-subject loads:');
    Object.entries(pairedLoads).sort().forEach(([t, n]) => console.log(`  ${t}: ${n}`));
    console.log('Slots per class:');
    Object.entries(perClass).sort().forEach(([c, n]) => console.log(`  ${c}: ${n}`));
    if (clashes > 0) fail('double-bookings detected after insert — investigate immediately');
    console.log('\nRestructure complete.');
}

main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
