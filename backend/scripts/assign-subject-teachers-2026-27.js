/**
 * Subject-teacher seat assignment (admin decision, 2026-09-21).
 *
 * The subject seats for 2026/27 sat on numbered placeholder accounts
 * ("Amharic Teacher 1" … "Physical Education Teacher 2") while staffing was
 * confirmed. The named teachers are now known; this hands each placeholder's
 * seats — and with them, via the `class_subjects` → `timetable_slots`
 * teacher-sync trigger, its lesson slots — to the real person, then
 * deactivates the emptied placeholder account so it leaves the sign-in wall.
 *
 *   Amharic Teacher 1   → Mihiret Moges H/Mariam         (7 seats)
 *   Amharic Teacher 2   → Fremnet Mamo Esubalew          (7 seats)
 *   Art Teacher 1       → Kalab Bizueinh Mekonen         (7 seats)
 *   Art Teacher 2       → Andu Getachew Tulu             (7 seats)
 *   English Teacher 1   → Dihurwe Desire                 (8 seats: 5 ENG + 3 SPL)
 *   English Teacher 2   → Michael Okwara Okwara          (8 seats: 5 ENG + 3 SPL)
 *   French Teacher 1    → Thomas Asmelash Gebray         (14 seats)
 *   ICT Teacher 1       → Amanuel Teamu Tsegaye          (14 seats)
 *   Music Teacher 2     → Sena Elias Tasisa              (7 seats)
 *   Physical Education Teacher 1 → Gebremariam Yismaw Fanthahun (7 seats)
 *   Physical Education Teacher 2 → Yalew Endale Gossaye         (7 seats)
 *
 * English Teacher 3 and Music Teacher 1 keep their seats and stay active as
 * placeholders until those hires are confirmed.
 *
 * Nothing is renamed or deleted: each seat (class_subjects row) keeps its id,
 * only teacher_id changes, so schemes of work and weekly plans stay attached
 * to the seat and simply follow it to the new teacher (today: none exist).
 *
 * Method: verify-before-write. Accounts, roles, activity flags and exact seat
 * counts are checked in memory first; per pair the write is one UPDATE on
 * class_subjects (the trigger moves the timetable with it), verified, then
 * the emptied placeholder is deactivated. Safe to re-run: pairs that already
 * moved are reported and skipped.
 *
 * Usage:
 *   node scripts/assign-subject-teachers-2026-27.js --dry-run
 *   node scripts/assign-subject-teachers-2026-27.js
 */

require('dotenv').config({ path: './.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const PLACEHOLDER_RE = /\s+teacher\s+\d+$/i;

const ASSIGNMENTS = [
    { placeholder: 'Amharic Teacher 1',            teacher: 'Mihiret Moges H/Mariam',        seats: 7 },
    { placeholder: 'Amharic Teacher 2',            teacher: 'Fremnet Mamo Esubalew',         seats: 7 },
    { placeholder: 'Art Teacher 1',                teacher: 'Kalab Bizueinh Mekonen',        seats: 7 },
    { placeholder: 'Art Teacher 2',                teacher: 'Andu Getachew Tulu',            seats: 7 },
    { placeholder: 'English Teacher 1',            teacher: 'Dihurwe Desire',                seats: 8 },
    { placeholder: 'English Teacher 2',            teacher: 'Michael Okwara Okwara',         seats: 8 },
    { placeholder: 'French Teacher 1',             teacher: 'Thomas Asmelash Gebray',        seats: 14 },
    { placeholder: 'ICT Teacher 1',                teacher: 'Amanuel Teamu Tsegaye',         seats: 14 },
    { placeholder: 'Music Teacher 2',              teacher: 'Sena Elias Tasisa',             seats: 7 },
    { placeholder: 'Physical Education Teacher 1', teacher: 'Gebremariam Yismaw Fanthahun',  seats: 7 },
    { placeholder: 'Physical Education Teacher 2', teacher: 'Yalew Endale Gossaye',          seats: 7 },
];

const fail = (msg) => { console.error(`\nABORT: ${msg}`); process.exit(1); };

const main = async () => {
    const { data: year } = await supabase
        .from('academic_years').select('id, school_id, name').eq('is_current', true).single();
    if (!year) fail('no current academic year');

    const [{ data: users }, { data: seats }] = await Promise.all([
        supabase.from('users').select('id, name, role, is_active')
            .eq('school_id', year.school_id).eq('role', 'subject_teacher'),
        supabase.from('class_subjects')
            .select('id, class_id, teacher_id, sessions_per_week, subject:subjects(code, name)')
            .eq('academic_year_id', year.id),
    ]);
    if (!users || !seats) fail('failed to load users or seats');

    const byName = new Map();
    for (const u of users) {
        if (byName.has(u.name)) fail(`duplicate user name "${u.name}" — resolve by hand first`);
        byName.set(u.name, u);
    }
    const seatsOf = (userId) => seats.filter((s) => s.teacher_id === userId);

    // ── Verify everything before any write ────────────────────────────────
    const named = new Set(ASSIGNMENTS.map((a) => a.teacher));
    if (named.size !== ASSIGNMENTS.length) fail('a named teacher appears twice in the mapping');

    const plan = [];
    for (const a of ASSIGNMENTS) {
        const p = byName.get(a.placeholder);
        const t = byName.get(a.teacher);
        if (!p) fail(`placeholder account "${a.placeholder}" not found`);
        if (!t) fail(`teacher account "${a.teacher}" not found`);
        if (!PLACEHOLDER_RE.test(p.name)) fail(`"${p.name}" is not a numbered placeholder name`);
        if (PLACEHOLDER_RE.test(t.name)) fail(`"${t.name}" is itself a placeholder name`);
        if (p.role !== 'subject_teacher' || t.role !== 'subject_teacher')
            fail(`${a.placeholder} → ${a.teacher}: both accounts must be subject teachers`);
        if (!t.is_active) fail(`${a.teacher}: account is inactive — activate it first`);

        const pSeats = seatsOf(p.id);
        const tSeats = seatsOf(t.id);
        const codes = (list) => {
            const m = {};
            for (const s of list) m[s.subject?.code] = (m[s.subject?.code] || 0) + 1;
            return Object.entries(m).map(([k, v]) => `${k}:${v}`).sort().join(' ');
        };

        if (pSeats.length === 0) {
            // Already-handled path (idempotent re-run).
            if (p.is_active) fail(`${a.placeholder}: has no seats but is still active — deactivate by hand?`);
            if (tSeats.length !== a.seats)
                fail(`${a.teacher}: expected ${a.seats} seats after an earlier run, found ${tSeats.length}`);
            plan.push({ ...a, status: 'already done', seatIds: [], detail: codes(tSeats) });
            continue;
        }
        if (pSeats.length !== a.seats)
            fail(`${a.placeholder}: expected ${a.seats} seats, found ${pSeats.length} (${codes(pSeats)})`);
        if (tSeats.length !== 0)
            fail(`${a.teacher}: already holds ${tSeats.length} seat(s) (${codes(tSeats)}) — refusing to merge workloads`);
        if (!p.is_active) fail(`${a.placeholder}: still holds seats but is already deactivated`);
        plan.push({ ...a, status: 'assign', seatIds: pSeats.map((s) => s.id), from: p, to: t, detail: codes(pSeats) });
    }

    // The remaining placeholders keep their seats — list them, never touch them.
    const keepers = users
        .filter((u) => u.is_active && u.role === 'subject_teacher' && PLACEHOLDER_RE.test(u.name)
            && !ASSIGNMENTS.some((a) => a.placeholder === u.name))
        .map((u) => `${u.name} (${seatsOf(u.id).length} seats)`);

    console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}Subject-teacher seat assignment, ${year.name}`);
    for (const p of plan)
        console.log(`  ${p.status === 'assign' ? '→' : '✓'} ${p.placeholder} → ${p.teacher}  [${p.detail}]${p.status === 'already done' ? ' (already done)' : ''}`);
    console.log(`  staying as placeholders: ${keepers.join(', ') || 'none'}`);

    const todo = plan.filter((p) => p.status === 'assign');
    if (todo.length === 0) { console.log('\nNothing to do.'); return; }
    if (DRY_RUN) { console.log('\n(dry run — no database changes)'); return; }

    // ── Apply ─────────────────────────────────────────────────────────────
    for (const p of todo) {
        // 1. Move the seats. The timetable_slots teacher-sync trigger follows.
        const { error: moveErr } = await supabase
            .from('class_subjects').update({ teacher_id: p.to.id }).in('id', p.seatIds);
        if (moveErr) fail(`${p.placeholder}: seat move failed — ${moveErr.message}`);

        const { data: check } = await supabase
            .from('class_subjects').select('id, teacher_id, sessions_per_week').in('id', p.seatIds);
        if (!check || check.length !== p.seats || check.some((s) => s.teacher_id !== p.to.id))
            fail(`${p.placeholder}: seat move verification failed`);

        // 2. Prove the timetable followed the seats to the new teacher.
        const { data: slots } = await supabase
            .from('timetable_slots')
            .select('id, teacher_id, class_subject_id, day_of_week, starts_at')
            .in('class_subject_id', p.seatIds);
        if (!slots) fail(`${p.placeholder}: could not re-read timetable slots`);
        const stray = slots.filter((s) => s.teacher_id !== p.to.id);
        if (stray.length > 0)
            fail(`${p.placeholder}: ${stray.length} timetable slot(s) did not follow to ${p.teacher}`);

        // Grid must still equal seats (slot count == sessions_per_week per seat).
        const bySeatId = new Map(check.map((s) => [s.id, s.sessions_per_week]));
        for (const s of check) {
            const actual = slots.filter((x) => x.class_subject_id === s.id).length;
            if (actual !== bySeatId.get(s.id))
                fail(`${p.placeholder}: seat ${s.id} has ${actual} slots on the grid, expected ${bySeatId.get(s.id)}`);
        }

        // 3. The new teacher's week must be clash-free (he inherited a
        //    clash-free placeholder grid, so this must hold by construction).
        const { data: allSlots } = await supabase
            .from('timetable_slots').select('day_of_week, starts_at')
            .eq('academic_year_id', year.id).eq('teacher_id', p.to.id);
        const seen = new Set();
        for (const s of allSlots || []) {
            const key = `${s.day_of_week}|${s.starts_at}`;
            if (seen.has(key)) fail(`${p.teacher}: timetable clash at ${key} after the move`);
            seen.add(key);
        }

        // 4. Deactivate the emptied placeholder so it leaves the sign-in wall.
        const { error: offErr } = await supabase
            .from('users').update({ is_active: false }).eq('id', p.from.id);
        if (offErr) fail(`${p.placeholder}: deactivation failed — ${offErr.message}`);

        console.log(`  ✓ ${p.placeholder} → ${p.teacher}: ${p.seats} seats + ${slots.length} lessons moved, placeholder deactivated`);
    }

    console.log('\nDone. Sign-in wall and the public teacher directory now show the named teachers.');
};

main().catch((e) => fail(e.message));
