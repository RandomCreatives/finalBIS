/**
 * Staffing: add Mr. Binyam as Music Teacher (Teacher 1).
 *
 * Creates a subject-teacher account for Mr. Binyam (binyam@bisnoc.local),
 * finds all Music subject seats currently held by the "Music Teacher" /
 * "Music Teacher 1" placeholder accounts, transfers those seats to Mr. Binyam,
 * then deactivates the emptied placeholders.
 *
 * Verify-before-write: checks accounts, roles, activity flags and seat counts
 * in memory first; per seat-group the write is one UPDATE on class_subjects
 * (the trigger moves the timetable with it), verified, then placeholders are
 * deactivated. Safe to re-run: pairs already moved are reported and skipped.
 *
 * Usage:
 *   node scripts/staffing/add-music-teacher-binyam.js --dry-run
 *   node scripts/staffing/add-music-teacher-binyam.js
 */

require('dotenv').config({ path: './.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const PLACEHOLDER_RE = /^Music\s+Teacher\s*\d*$/i;

const NEW_TEACHER_NAME = 'Mr. Binyam';
const NEW_TEACHER_EMAIL = 'binyam@bisnoc.local';
const NEW_TEACHER_PASSWORD_HASH =
    '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe'; // BisNoc2026!

const fail = (msg) => { console.error(`\nABORT: ${msg}`); process.exit(1); };

const main = async () => {
    const { data: year } = await supabase
        .from('academic_years').select('id, school_id, name').eq('is_current', true).single();
    if (!year) fail('no current academic year');

    const schoolId = year.school_id;

    // 1. Check if Mr. Binyam already exists
    const { data: existing } = await supabase
        .from('users')
        .select('id, name, email, role, is_active, school_id')
        .eq('email', NEW_TEACHER_EMAIL)
        .eq('school_id', schoolId);

    let binyam;
    if (existing && existing.length > 0) {
        binyam = existing[0];
        console.log(`Mr. Binyam already exists: ${binyam.name} (${binyam.email}), role=${binyam.role}, active=${binyam.is_active}`);
        if (binyam.role !== 'subject_teacher') {
            // Activate and set role if needed
            const patch = {};
            if (binyam.role !== 'subject_teacher') patch.role = 'subject_teacher';
            if (!binyam.is_active) patch.is_active = true;
            if (Object.keys(patch).length > 0) {
                const { data: updated, error: updErr } = await supabase
                    .from('users').update(patch).eq('id', binyam.id).select().single();
                if (updErr) throw updErr;
                binyam = updated;
                console.log(`Updated Mr. Binyam: role=${binyam.role}, active=${binyam.is_active}`);
            }
        }
    } else {
        // 2. Create Mr. Binyam's account
        const { data: created, error: createErr } = await supabase
            .from('users')
            .insert({
                name: NEW_TEACHER_NAME,
                email: NEW_TEACHER_EMAIL,
                role: 'subject_teacher',
                is_active: true,
                school_id: schoolId,
                password_hash: NEW_TEACHER_PASSWORD_HASH,
            })
            .select().single();
        if (createErr) fail(`create Mr. Binyam failed: ${createErr.message}`);
        binyam = created;
        console.log(`Created Mr. Binyam: ${created.name} (${created.email}), id=${created.id}`);
    }

    // 3. Find Music subject seats held by Music Teacher placeholders
    const { data: musicSubject } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('school_id', schoolId)
        .ilike('name', 'music')
        .maybeSingle();
    if (!musicSubject) fail('Music subject not found');

    console.log(`\nFound Music subject: ${musicSubject.name} (id: ${musicSubject.id}, code: ${musicSubject.code})`);

    // 4. Find placeholder accounts named "Music Teacher" or "Music Teacher N"
    const { data: placeholderUsers } = await supabase
        .from('users')
        .select('id, name, email, is_active')
        .eq('school_id', schoolId)
        .eq('role', 'subject_teacher')
        .ilike('name', 'music teacher%');

    if (!placeholderUsers || placeholderUsers.length === 0) {
        console.log('No "Music Teacher" placeholder accounts found. Nothing to transfer.');
        return;
    }

    console.log(`\nFound Music Teacher placeholder(s):`);
    for (const p of placeholderUsers) {
        const pSeats = await supabase
            .from('class_subjects')
            .select('id, class_id, subject_id, sessions_per_week')
            .eq('school_id', schoolId)
            .eq('teacher_id', p.id)
            .eq('subject_id', musicSubject.id);
        console.log(`  - ${p.name} (${p.email}): ${pSeats.data?.length || 0} Music seat(s), active=${p.is_active}`);
    }

    // 5. Verify Mr. Binyam doesn't already hold Music seats in these classes
    const { data: binyamSeats } = await supabase
        .from('class_subjects')
        .select('id, class_id, sessions_per_week')
        .eq('school_id', schoolId)
        .eq('teacher_id', binyam.id)
        .eq('subject_id', musicSubject.id);
    if (binyamSeats && binyamSeats.length > 0) {
        console.log(`\nMr. Binyam already holds ${binyamSeats.length} Music seat(s):`);
        for (const s of binyamSeats) console.log(`    class_id=${s.class_id}, sessions=${s.sessions_per_week}`);
    }

    // 6. Collect all Music seats from placeholders
    const seatsToMove = [];
    const placeholdersToDeactivate = [];
    for (const p of placeholderUsers) {
        const { data: pSeats, error: pErr } = await supabase
            .from('class_subjects')
            .select('id, class_id, subject_id, sessions_per_week')
            .eq('school_id', schoolId)
            .eq('teacher_id', p.id)
            .eq('subject_id', musicSubject.id);
        if (pErr) throw pErr;
        if (pSeats && pSeats.length > 0) {
            seatsToMove.push(...pSeats.map((s) => ({ ...s, fromPlaceholder: p })));
            placeholdersToDeactivate.push(p);
        }
    }

    if (seatsToMove.length === 0) {
        console.log('\nNo Music seats held by Music Teacher placeholders. Nothing to transfer.');
        return;
    }

    console.log(`\nTotal Music seats to transfer: ${seatsToMove.length}`);
    for (const s of seatsToMove) {
        console.log(`  - class_id=${s.class_id}, sessions=${s.sessions_per_week}, from=${s.fromPlaceholder.name}`);
    }

    // 7. Verify Mr. Binyam doesn't already hold seats in any of these classes
    const binyamClassIds = new Set((binyamSeats || []).map((s) => s.class_id));
    const conflicts = seatsToMove.filter((s) => binyamClassIds.has(s.class_id));
    if (conflicts.length > 0) {
        const conflictClasses = conflicts.map((c) => c.class_id).join(', ');
        fail(`Mr. Binyam already holds Music seats in class(es): ${conflictClasses} — refusing to merge workloads`);
    }

    // 8. Apply: move seats
    if (DRY_RUN) {
        console.log('\n(dry run — no database changes)');
        return;
    }

    const seatIds = seatsToMove.map((s) => s.id);
    const { error: moveErr } = await supabase
        .from('class_subjects')
        .update({ teacher_id: binyam.id })
        .in('id', seatIds);
    if (moveErr) fail(`seat move failed: ${moveErr.message}`);

    // Verify the move
    const { data: check } = await supabase
        .from('class_subjects')
        .select('id, teacher_id').in('id', seatIds);
    if (!check || check.length !== seatIds.length || check.some((s) => s.teacher_id !== binyam.id)) {
        fail('seat move verification failed');
    }

    // 9. Deactivate emptied placeholders (only if they hold no more seats)
    for (const p of placeholdersToDeactivate) {
        const { data: remaining } = await supabase
            .from('class_subjects')
            .select('id')
            .eq('school_id', schoolId)
            .eq('teacher_id', p.id);
        if (remaining && remaining.length === 0 && p.is_active) {
            const { error: offErr } = await supabase
                .from('users')
                .update({ is_active: false })
                .eq('id', p.id);
            if (offErr) fail(`deactivate ${p.name} failed: ${offErr.message}`);
            console.log(`  Deactivated placeholder: ${p.name} (${p.email})`);
        }
    }

    console.log(`\nDone. Mr. Binyam now holds ${seatsToMove.length} Music seat(s).`);
};

main().catch((e) => fail(e.message));
