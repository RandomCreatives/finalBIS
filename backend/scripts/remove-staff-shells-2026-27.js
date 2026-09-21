/**
 * Staff-list cleanup (admin decision, 2026-09-21).
 *
 * After the named teachers took their seats, the placeholder and early-setup
 * shells are clutter in the Admin staff list. Mike's call: delete the listed
 * accounts outright; they hold no classes, no lessons, no documents.
 *
 * Removed (27):
 *   Placeholders emptied by the seat assignment — Amharic Teacher 1/2,
 *   Art Teacher 1/2, English Teacher 1/2/4, French Teacher 1, ICT Teacher 1,
 *   Music Teacher 2, Physical Education Teacher 1/2.
 *   Early legacy shells — Amharic Teacher, Arts Teacher, English Teacher,
 *   French Teacher, Music Teacher, PE Teacher.
 *   Early admin/test accounts — Master Admin, System Administrator ×4,
 *   Deputy Administrator (confirmed separately), Teacher Test, Test Teacher ×2.
 *
 * KEPT, deliberately: English Teacher 3 and Music Teacher 1 — both still
 * teach real classes (12 + 7 seats) and signed in today; they go when their
 * hires confirm. The working admins (Mr. Leul, Mr. Mike) are never in scope.
 *
 * Method: verify-before-write. Each candidate is matched by exact email,
 * must be inactive, and its footprints are swept across every user-
 * referencing column in the schema. Attribution-only footprints (created_by
 * and friends, which Postgres itself would just SET NULL) are reported and
 * the account goes; any footprint that would DELETE data (the CASCADE
 * columns) keeps the account and reports instead. Safe to re-run: missing
 * accounts are reported as already removed.
 *
 * Usage:
 *   node scripts/remove-staff-shells-2026-27.js --dry-run
 *   node scripts/remove-staff-shells-2026-27.js
 */

require('dotenv').config({ path: './.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

const REMOVALS = [
    { name: 'Amharic Teacher',              email: 'amharic@bisnoc.local' },
    { name: 'Amharic Teacher 1',            email: 'amharic.teacher.1@bisnocgerji.local' },
    { name: 'Amharic Teacher 2',            email: 'amharic.teacher.2@bisnocgerji.local' },
    { name: 'Art Teacher 1',                email: 'art.teacher.1@bisnocgerji.local' },
    { name: 'Art Teacher 2',                email: 'art.teacher.2@bisnocgerji.local' },
    { name: 'Arts Teacher',                 email: 'arts@bisnoc.local' },
    { name: 'English Teacher',              email: 'english@bisnoc.local' },
    { name: 'English Teacher 1',            email: 'english.teacher.1@bisnocgerji.local' },
    { name: 'English Teacher 2',            email: 'english.teacher.2@bisnocgerji.local' },
    { name: 'English Teacher 4',            email: 'english.teacher.4@bisnocgerji.local' },
    { name: 'French Teacher',               email: 'french@bisnoc.local' },
    { name: 'French Teacher 1',             email: 'french.teacher.1@bisnocgerji.local' },
    { name: 'ICT Teacher 1',                email: 'ict.teacher.1@bisnocgerji.local' },
    { name: 'Music Teacher',                email: 'music@bisnoc.local' },
    { name: 'Music Teacher 2',              email: 'music.teacher.2@bisnocgerji.local' },
    { name: 'PE Teacher',                   email: 'pe@bisnoc.local' },
    { name: 'Physical Education Teacher 1', email: 'physical.education.teacher.1@bisnocgerji.local' },
    { name: 'Physical Education Teacher 2', email: 'physical.education.teacher.2@bisnocgerji.local' },
    { name: 'Master Admin',                 email: 'master@bisnoc.test' },
    { name: 'System Administrator',         email: 'admin@bisnoc.local' },
    { name: 'System Administrator',         email: 'admin@school.et' },
    { name: 'System Administrator',         email: 'admin@bisgerji.edu.et' },
    { name: 'System Administrator',         email: 'admin1@bisnoc.local' },
    { name: 'Deputy Administrator',         email: 'admin2@bisnoc.local' },
    { name: 'Teacher Test',                 email: 'teacher@bisnoc.test' },
    { name: 'Test Teacher',                 email: 'teacherbisnoc@gmail.com' },
    { name: 'Test Teacher',                 email: 'teacher.bisnoc@gmail.com' },
];

/** Tripwire: these accounts must never appear in a removal batch. */
const NEVER = ['leul@bisnoc.local', 'mike@bisnoc.local', 'english.teacher.3@bisnocgerji.local', 'music.teacher.1@bisnocgerji.local'];

/** Every users(id)-referencing column in the schema, with its delete action. */
const REFERENCES = {
    assessment_marks: [{ col: 'entered_by', action: 'SET NULL' }],
    assessments: [{ col: 'created_by', action: 'SET NULL' }],
    attendance: [{ col: 'marked_by', action: 'SET NULL' }],
    attendance_submissions: [{ col: 'submitted_by', action: 'SET NULL' }],
    calendar_events: [{ col: 'created_by', action: 'SET NULL' }],
    class_staff: [{ col: 'user_id', action: 'CASCADE' }],
    class_subjects: [{ col: 'teacher_id', action: 'SET NULL' }],
    clinic_visits: [{ col: 'attended_by', action: 'SET NULL' }, { col: 'leave_reviewed_by', action: 'SET NULL' }],
    conduct_reports: [{ col: 'handled_by', action: 'SET NULL' }, { col: 'reporter_id', action: 'CASCADE' }],
    file_records: [{ col: 'uploaded_by', action: 'SET NULL' }],
    lesson_plans: [{ col: 'author_id', action: 'SET NULL' }, { col: 'reviewed_by', action: 'SET NULL' }],
    library_loans: [{ col: 'issued_by', action: 'SET NULL' }],
    marksheets: [{ col: 'entered_by', action: 'SET NULL' }],
    messages: [{ col: 'sender_id', action: 'SET NULL' }],
    notice_receipts: [{ col: 'user_id', action: 'CASCADE' }],
    notices: [{ col: 'created_by', action: 'SET NULL' }],
    permission_requests: [{ col: 'requester_id', action: 'CASCADE' }, { col: 'reviewed_by', action: 'SET NULL' }],
    schemes_of_work: [{ col: 'author_id', action: 'SET NULL' }, { col: 'reviewed_by', action: 'SET NULL' }],
    store_requests: [{ col: 'admin_reviewed_by', action: 'SET NULL' }, { col: 'requester_id', action: 'CASCADE' }, { col: 'store_reviewed_by', action: 'SET NULL' }],
    student_transfers: [{ col: 'transferred_by', action: 'SET NULL' }],
    tasks: [{ col: 'assigned_by', action: 'SET NULL' }, { col: 'assigned_to', action: 'CASCADE' }],
    thread_participants: [{ col: 'user_id', action: 'CASCADE' }],
    threads: [{ col: 'created_by', action: 'SET NULL' }, { col: 'resolved_by', action: 'SET NULL' }],
    timetable_slots: [{ col: 'teacher_id', action: 'SET NULL' }],
};

const fail = (msg) => { console.error(`\nABORT: ${msg}`); process.exit(1); };

const main = async () => {
    if (REMOVALS.some((r) => NEVER.includes(r.email)))
        fail('a protected account is in the removal list — edit the script, not the school');

    const { data: school } = await supabase.from('schools').select('id').maybeSingle();
    if (!school) fail('school not found');

    const { data: users } = await supabase
        .from('users').select('id, name, email, is_active').eq('school_id', school.id);
    if (!users) fail('failed to load users');
    const byEmail = new Map(users.map((u) => [u.email, u]));

    // ── Verify every candidate before any write ───────────────────────────
    const candidates = [];
    const alreadyGone = [];
    for (const r of REMOVALS) {
        const u = byEmail.get(r.email);
        if (!u) { alreadyGone.push(r); continue; }
        if (u.name !== r.name) fail(`${r.email}: expected name "${r.name}", found "${u.name}" — review by hand`);
        if (u.is_active) fail(`${r.name} (${r.email}) is ACTIVE — refusing to remove a working account`);
        candidates.push(u);
    }
    const ids = candidates.map((u) => u.id);

    // Reference sweep: CASCADE footprints keep the account (deleting it would
    // delete data with it); SET NULL footprints just blank an attribution —
    // Postgres does that itself, so the account goes and we note it.
    const keepReasons = new Map(); // userId -> [reasons]
    const notes = new Map();       // userId -> [attribution notes]
    for (const [table, refs] of Object.entries(REFERENCES)) {
        for (const { col, action } of refs) {
            if (ids.length === 0) break;
            const { data, error } = await supabase.from(table).select(col).in(col, ids).limit(50);
            if (error) { console.log(`  (skipping ${table}.${col}: ${error.message})`); continue; }
            const bucket = action === 'CASCADE' ? keepReasons : notes;
            for (const row of data || []) {
                const uid = row[col];
                if (!bucket.has(uid)) bucket.set(uid, []);
                bucket.get(uid).push(`${table}.${col}`);
            }
        }
    }

    const deletions = candidates.filter((u) => !keepReasons.has(u.id));
    const kept = candidates.filter((u) => keepReasons.has(u.id));

    console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}Staff-shell removal`);
    for (const u of deletions) {
        const noted = notes.has(u.id) ? ` (attribution on ${[...new Set(notes.get(u.id))].join(', ')} becomes blank)` : '';
        console.log(`  ✗ delete  ${u.name} <${u.email}>${noted}`);
    }
    for (const u of kept)
        console.log(`  ⚠ keep    ${u.name} <${u.email}> — would delete data via ${[...new Set(keepReasons.get(u.id))].join(', ')}`);
    for (const r of alreadyGone) console.log(`  ✓ gone    ${r.name} <${r.email}> (already removed)`);

    // Tripwires: never touch an active account, a teacher with seats, or the keep-list.
    const { data: seats } = await supabase.from('class_subjects').select('teacher_id').in('teacher_id', deletions.map((u) => u.id));
    if (seats?.length) fail('one of the deletion candidates still holds class seats — refusing');
    if (kept.some((u) => NEVER.includes(u.email))) fail('protected account ended up in the keep/report path oddly');

    console.log(`\n  deleting ${deletions.length}, keeping ${kept.length} with history, already gone ${alreadyGone.length}`);
    if (DRY_RUN) { console.log('\n(dry run — no database changes)'); return; }
    if (deletions.length === 0) { console.log('\nNothing to do.'); return; }

    // ── Apply ─────────────────────────────────────────────────────────────
    const deleteIds = deletions.map((u) => u.id);
    const { error: delErr } = await supabase.from('users').delete().in('id', deleteIds);
    if (delErr) fail(`delete failed — ${delErr.message}`);

    const { data: check } = await supabase.from('users').select('id').in('id', deleteIds);
    if (check?.length) fail(`${check.length} account(s) still present after delete`);

    console.log(`\nDone. ${deletions.length} accounts removed; the staff list now shows only real people.`);
    if (kept.length) console.log('Review the kept accounts above — history exists; removing it needs a decision.');
};

main().catch((e) => fail(e.message));
