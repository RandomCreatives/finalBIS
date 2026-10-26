const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

/**
 * Year 4 - Magenta main-teacher reconciliation (Ms. Bethelhem Girma) and
 * shared class-teacher subject handover helpers.
 *
 * Mirrors supabase/migrations/032_magenta_main_teacher_bethelhem.sql using
 * the backend's service-role Supabase client so deployments create/activate
 * Ms. Bethelhem Girma's account and hand over Year 4 - Magenta automatically
 * without needing a manual run in the Supabase SQL Editor.
 */

// bcrypt hash of BisNoc2026! — standard initial credential matching migrations 012, 030 and 032.
const BASIC_PASSWORD_HASH = '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';
const MAGENTA_CLASS_NAME = 'Year 4 - Magenta';
const BETHELHEM_NAME = 'Bethelhem Girma';
const BETHELHEM_EMAIL = 'bethelhem.girma@bisnoc.local';
const TARGET_ACADEMIC_YEAR = '2026/2027';

const PROMOTABLE_ROLES = new Set(['subject_teacher', 'assistant_teacher']);
const ELIGIBLE_CLASS_ROLES = new Set(['main_teacher', 'admin']);

const normalizePersonName = (value) =>
    String(value || '')
        .trim()
        .replace(/^(?:ms|mrs|miss|mr)\.?\s+/i, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();

const isPre032MagentaTeacher = (name) =>
    /^abig(?:ia|ail)\b/i.test(normalizePersonName(name));

const parseTimeSeconds = (value) => {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(value || '').trim());
    if (!m) return null;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
};

const timesOverlap = (startA, endA, startB, endB) => {
    const sA = parseTimeSeconds(startA);
    const eA = parseTimeSeconds(endA);
    const sB = parseTimeSeconds(startB);
    const eB = parseTimeSeconds(endB);
    if (sA === null || eA === null || sB === null || eB === null) return false;
    return sA < eB && sB < eA;
};

/**
 * Inspects a class's `main_teacher` subject seats before a main-teacher change
 * and verifies that handing them to `newTeacherId` will not double-book them
 * on the timetable. Throws ConflictError before any writes happen on a clash.
 */
async function prepareMainTeacherSeatHandover({
    client = supabase,
    schoolId,
    yearId,
    classId,
    className,
    newTeacherId,
    newTeacherName,
    oldTeacherId = null,
}) {
    const { data: subjects, error: subjError } = await client
        .from('subjects')
        .select('id, code, name')
        .eq('school_id', schoolId)
        .eq('taught_by', 'main_teacher');
    if (subjError) throw subjError;

    const mainSubjectIds = (subjects || []).map((s) => s.id);
    if (mainSubjectIds.length === 0) {
        return { mainSubjectIds: [], seatsToMove: [] };
    }

    const { data: classSeats, error: seatError } = await client
        .from('class_subjects')
        .select('id, subject_id, teacher_id, sessions_per_week')
        .eq('class_id', classId)
        .eq('academic_year_id', yearId)
        .in('subject_id', mainSubjectIds);
    if (seatError) throw seatError;

    const seatsToMove = (classSeats || []).filter((seat) => {
        if (newTeacherId && seat.teacher_id === newTeacherId) return false;
        if (seat.teacher_id === null || seat.teacher_id === undefined) return true;
        if (oldTeacherId && seat.teacher_id === oldTeacherId) return true;
        return false;
    });

    if (seatsToMove.length > 0 && newTeacherId) {
        const movingSeatIds = seatsToMove.map((s) => s.id);
        const movingSeatSet = new Set(movingSeatIds);

        const { data: movingSlots, error: movingErr } = await client
            .from('timetable_slots')
            .select('id, class_subject_id, day_of_week, starts_at, ends_at')
            .eq('academic_year_id', yearId)
            .in('class_subject_id', movingSeatIds);
        if (movingErr) throw movingErr;

        if ((movingSlots || []).length > 0) {
            const { data: teacherSlots, error: teacherSlotsErr } = await client
                .from('timetable_slots')
                .select('id, class_subject_id, day_of_week, starts_at, ends_at')
                .eq('academic_year_id', yearId)
                .eq('teacher_id', newTeacherId);
            if (teacherSlotsErr) throw teacherSlotsErr;

            const otherSlots = (teacherSlots || []).filter(
                (slot) => !movingSeatSet.has(slot.class_subject_id)
            );

            let clashes = 0;
            for (const moving of movingSlots) {
                for (const hers of otherSlots) {
                    if (
                        Number(hers.day_of_week) === Number(moving.day_of_week) &&
                        timesOverlap(hers.starts_at, hers.ends_at, moving.starts_at, moving.ends_at)
                    ) {
                        clashes += 1;
                    }
                }
            }

            if (clashes > 0) {
                const label = newTeacherName || 'This teacher';
                const targetClass = className || 'this class';
                throw new ConflictError(
                    `"${label}" already teaches ${clashes} lesson(s) at times "${targetClass}" needs them. ` +
                    'Move those lessons first (Timetable page), then try again.'
                );
            }
        }
    }

    return { mainSubjectIds, seatsToMove };
}

/**
 * Transfers the prepared `main_teacher` subject seats (and their placed
 * timetable lessons) to `newTeacherId`.
 */
async function applyMainTeacherSeatHandover({
    client = supabase,
    yearId,
    classId,
    newTeacherId,
    mainSubjectIds,
    seatsToMove,
}) {
    if (seatsToMove.length > 0) {
        const seatIds = seatsToMove.map((s) => s.id);

        const { error: updateSeatsErr } = await client
            .from('class_subjects')
            .update({ teacher_id: newTeacherId })
            .in('id', seatIds);
        if (updateSeatsErr) {
            if (updateSeatsErr.code === '23P01') {
                throw new ConflictError(
                    'Reassigning these class subjects would double-book the teacher on the timetable.'
                );
            }
            throw updateSeatsErr;
        }

        // Real PostgreSQL cascades via trg_cascade_teacher; updating explicitly
        // keeps stubbed/non-trigger stores consistent and is a no-op otherwise.
        const { error: updateSlotsErr } = await client
            .from('timetable_slots')
            .update({ teacher_id: newTeacherId })
            .in('class_subject_id', seatIds);
        if (updateSlotsErr) {
            if (updateSlotsErr.code === '23P01') {
                throw new ConflictError(
                    'Reassigning these lessons would double-book the teacher on the timetable.'
                );
            }
            throw updateSlotsErr;
        }
    }

    let lessonsPlaced = 0;
    if (mainSubjectIds.length > 0) {
        const { data: ownedSeats, error: ownedErr } = await client
            .from('class_subjects')
            .select('id')
            .eq('class_id', classId)
            .eq('academic_year_id', yearId)
            .eq('teacher_id', newTeacherId)
            .in('subject_id', mainSubjectIds);
        if (ownedErr) throw ownedErr;

        const ownedIds = (ownedSeats || []).map((s) => s.id);
        if (ownedIds.length > 0) {
            const { data: slots, error: slotsErr } = await client
                .from('timetable_slots')
                .select('id')
                .in('class_subject_id', ownedIds);
            if (slotsErr) throw slotsErr;
            lessonsPlaced = (slots || []).length;
        }
    }

    return { seatsTransferred: seatsToMove.length, lessonsPlaced };
}

/**
 * Ensures Ms. Bethelhem Girma has an active `main_teacher` staff account and
 * holds Year 4 - Magenta's main-teacher seat + class-teacher subjects.
 *
 * @param {object} [options]
 * @param {object} [options.client] - Supabase-compatible client
 * @param {'auto'|'explicit'} [options.mode='auto']
 *   - 'auto': runs safely on startup/request for 2026/2027 when Magenta is
 *     unassigned, still held by the pre-032 teacher (Abigia), or already held
 *     by Bethelhem; skips quietly if the schema/class/year isn't present or
 *     Magenta was later reassigned to a different teacher.
 *   - 'explicit': admin-triggered; applies on the current academic year even
 *     if Magenta is held by another teacher, throwing descriptive 4xx errors
 *     if any safety invariant fails.
 */
async function ensureMagentaMainTeacher({ client = supabase, mode = 'auto' } = {}) {
    const isExplicit = mode === 'explicit';

    // 1. School, academic year, and Year 4 - Magenta class
    const { data: schools, error: schoolErr } = await client.from('schools').select('id');
    if (schoolErr) throw schoolErr;
    if (!schools || schools.length !== 1) {
        if (!isExplicit) return { status: 'skipped', reason: 'school_count' };
        throw new ConflictError(
            `Expected exactly one school in the database, found ${schools ? schools.length : 0}.`
        );
    }
    const schoolId = schools[0].id;

    const { data: year, error: yearErr } = await client
        .from('academic_years')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    if (yearErr) throw yearErr;
    if (!year) {
        if (!isExplicit) return { status: 'skipped', reason: 'no_current_year' };
        throw new NotFoundError('No current academic year is configured.');
    }
    if (!isExplicit && year.name !== TARGET_ACADEMIC_YEAR) {
        return { status: 'skipped', reason: 'not_2026_2027' };
    }

    const { data: magenta, error: classErr } = await client
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('name', MAGENTA_CLASS_NAME)
        .maybeSingle();
    if (classErr) throw classErr;
    if (!magenta) {
        if (!isExplicit) return { status: 'skipped', reason: 'class_not_found' };
        throw new NotFoundError(`Class "${MAGENTA_CLASS_NAME}" not found.`);
    }

    // 2. Inspect current main-teacher seat(s) on Year 4 - Magenta
    const { data: mainSeats, error: mainSeatsErr } = await client
        .from('class_staff')
        .select('id, user_id')
        .eq('class_id', magenta.id)
        .eq('academic_year_id', year.id)
        .eq('position', 'main');
    if (mainSeatsErr) throw mainSeatsErr;

    if ((mainSeats || []).length > 1) {
        throw new ConflictError(
            `"${MAGENTA_CLASS_NAME}" has ${mainSeats.length} main teachers on record. ` +
            'Fix that on the Staff Assignment page first.'
        );
    }

    const currentMainSeat = mainSeats?.[0] || null;
    let outgoingUser = null;
    if (currentMainSeat) {
        const { data: holder, error: holderErr } = await client
            .from('users')
            .select('id, name, email, role, is_active')
            .eq('id', currentMainSeat.user_id)
            .maybeSingle();
        if (holderErr) throw holderErr;
        outgoingUser = holder;
    }

    // 3. Locate Ms. Bethelhem Girma's staff account (if one already exists)
    const { data: schoolUsers, error: usersErr } = await client
        .from('users')
        .select('id, name, email, role, is_active, school_id')
        .eq('school_id', schoolId);
    if (usersErr) throw usersErr;

    const targetNorm = normalizePersonName(BETHELHEM_NAME);
    const nameMatches = (schoolUsers || []).filter(
        (u) => normalizePersonName(u.name) === targetNorm
    );

    if (nameMatches.length > 1) {
        throw new ConflictError(
            `There are ${nameMatches.length} staff accounts named "${BETHELHEM_NAME}". ` +
            'Rename or remove the duplicate on the Staff page first.'
        );
    }

    let bethelhem = nameMatches[0] || null;

    if (!bethelhem) {
        const { data: emailMatch, error: emailErr } = await client
            .from('users')
            .select('id, name, email, role, is_active, school_id')
            .ilike('email', BETHELHEM_EMAIL)
            .maybeSingle();
        if (emailErr) throw emailErr;

        if (emailMatch) {
            if (
                emailMatch.school_id !== schoolId ||
                normalizePersonName(emailMatch.name) !== targetNorm
            ) {
                throw new ConflictError(
                    `The address ${BETHELHEM_EMAIL} already belongs to "${emailMatch.name}", not "${BETHELHEM_NAME}". ` +
                    'Fix the address on the Staff page first.'
                );
            }
            bethelhem = emailMatch;
        }
    }

    const alreadySeated = Boolean(
        bethelhem && currentMainSeat && currentMainSeat.user_id === bethelhem.id
    );

    // In 'auto' mode, never clobber a later assignment to a different teacher.
    if (
        !isExplicit &&
        !alreadySeated &&
        outgoingUser &&
        !isPre032MagentaTeacher(outgoingUser.name)
    ) {
        return {
            status: 'skipped',
            reason: 'reassigned_to_other_teacher',
            currentTeacher: outgoingUser.name,
        };
    }

    // 4. Validate role, other homerooms, and timetable clashes BEFORE any writes
    if (bethelhem) {
        if (!ELIGIBLE_CLASS_ROLES.has(bethelhem.role) && !PROMOTABLE_ROLES.has(bethelhem.role)) {
            throw new BadRequestError(
                `"${BETHELHEM_NAME}" has the role ${bethelhem.role}, which cannot take a class. ` +
                'Change the role on the Staff page first.'
            );
        }

        const { data: otherMainSeats, error: otherSeatsErr } = await client
            .from('class_staff')
            .select('class_id, class:classes(name)')
            .eq('user_id', bethelhem.id)
            .eq('academic_year_id', year.id)
            .eq('position', 'main')
            .neq('class_id', magenta.id);
        if (otherSeatsErr) throw otherSeatsErr;

        if ((otherMainSeats || []).length > 0) {
            let names = otherMainSeats.map((s) => s.class?.name).filter(Boolean);
            if (names.length !== otherMainSeats.length) {
                const { data: otherClasses, error: ocErr } = await client
                    .from('classes')
                    .select('name')
                    .in('id', otherMainSeats.map((s) => s.class_id));
                if (ocErr) throw ocErr;
                names = (otherClasses || []).map((c) => c.name);
            }
            const list = names.sort().join(', ');
            throw new ConflictError(
                `"${BETHELHEM_NAME}" is already the main teacher of ${list} this year. ` +
                'Remove her there first (Staff Assignment page), then try again.'
            );
        }
    }

    const handoverPlan = await prepareMainTeacherSeatHandover({
        client,
        schoolId,
        yearId: year.id,
        classId: magenta.id,
        className: MAGENTA_CLASS_NAME,
        newTeacherId: bethelhem?.id || null,
        newTeacherName: BETHELHEM_NAME,
        oldTeacherId: alreadySeated ? null : (outgoingUser?.id || null),
    });

    // 5. Create or activate & promote Ms. Bethelhem Girma's account
    let accountAction = 'unchanged';
    if (!bethelhem) {
        const { data: created, error: createErr } = await client
            .from('users')
            .insert({
                school_id: schoolId,
                name: BETHELHEM_NAME,
                email: BETHELHEM_EMAIL,
                password_hash: BASIC_PASSWORD_HASH,
                role: 'main_teacher',
                is_active: true,
            })
            .select('id, name, email, role, is_active, school_id')
            .single();
        if (createErr) throw createErr;
        bethelhem = created;
        accountAction = 'created';
    } else {
        const patch = {};
        if (!bethelhem.is_active) patch.is_active = true;
        if (PROMOTABLE_ROLES.has(bethelhem.role)) patch.role = 'main_teacher';

        if (Object.keys(patch).length > 0) {
            const { data: updated, error: updateErr } = await client
                .from('users')
                .update(patch)
                .eq('id', bethelhem.id)
                .select('id, name, email, role, is_active, school_id')
                .single();
            if (updateErr) throw updateErr;
            bethelhem = updated;
            accountAction = patch.is_active ? 'activated' : 'promoted';
        }
    }

    // 6. Seat her as Year 4 - Magenta's main teacher (if not already)
    let homeroomChanged = false;
    if (!alreadySeated) {
        // Clear any assistant seat on Magenta so UNIQUE(class_id, user_id, academic_year_id) holds.
        const { error: delAsstErr } = await client
            .from('class_staff')
            .delete()
            .eq('class_id', magenta.id)
            .eq('academic_year_id', year.id)
            .eq('user_id', bethelhem.id)
            .eq('position', 'assistant');
        if (delAsstErr) throw delAsstErr;

        if (currentMainSeat) {
            const { error: swapErr } = await client
                .from('class_staff')
                .update({ user_id: bethelhem.id })
                .eq('id', currentMainSeat.id);
            if (swapErr) throw swapErr;
        } else {
            const { error: insertSeatErr } = await client
                .from('class_staff')
                .insert({
                    school_id: schoolId,
                    academic_year_id: year.id,
                    class_id: magenta.id,
                    user_id: bethelhem.id,
                    position: 'main',
                });
            if (insertSeatErr) throw insertSeatErr;
        }
        homeroomChanged = true;
    }

    // 7. Hand over class-teacher subject seats (MAT, SCI, GLS, REG) + timetable slots
    const { seatsTransferred, lessonsPlaced } = await applyMainTeacherSeatHandover({
        client,
        yearId: year.id,
        classId: magenta.id,
        newTeacherId: bethelhem.id,
        mainSubjectIds: handoverPlan.mainSubjectIds,
        seatsToMove: handoverPlan.seatsToMove,
    });

    const changed = accountAction !== 'unchanged' || homeroomChanged || seatsTransferred > 0;

    return {
        status: changed ? 'applied' : 'already_applied',
        accountAction,
        homeroomChanged,
        previousMainTeacher: alreadySeated ? null : (outgoingUser?.name || null),
        user: {
            id: bethelhem.id,
            name: bethelhem.name,
            email: bethelhem.email,
            role: bethelhem.role,
            isActive: bethelhem.is_active,
        },
        class: { id: magenta.id, name: magenta.name },
        academicYear: { id: year.id, name: year.name },
        seatsTransferred,
        lessonsPlaced,
    };
}

let oncePromise = null;
let onceSettled = false;

function ensureMagentaMainTeacherOnce({ client = supabase } = {}) {
    if (onceSettled) return Promise.resolve({ status: 'cached' });
    if (!oncePromise) {
        oncePromise = ensureMagentaMainTeacher({ client, mode: 'auto' })
            .then((result) => {
                onceSettled = true;
                if (result.status === 'applied') {
                    console.log(
                        `[staffing] ${MAGENTA_CLASS_NAME} main teacher -> ${BETHELHEM_NAME} ` +
                        `(account: ${result.accountAction}, seats: ${result.seatsTransferred}, lessons: ${result.lessonsPlaced})`
                    );
                }
                return result;
            })
            .catch((err) => {
                if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
                    onceSettled = true;
                } else {
                    oncePromise = null;
                }
                throw err;
            });
    }
    return oncePromise;
}

function resetMagentaEnsureCache() {
    oncePromise = null;
    onceSettled = false;
}

function markMagentaEnsureSettled() {
    onceSettled = true;
}

module.exports = {
    BASIC_PASSWORD_HASH,
    MAGENTA_CLASS_NAME,
    BETHELHEM_NAME,
    BETHELHEM_EMAIL,
    TARGET_ACADEMIC_YEAR,
    prepareMainTeacherSeatHandover,
    applyMainTeacherSeatHandover,
    ensureMagentaMainTeacher,
    ensureMagentaMainTeacherOnce,
    resetMagentaEnsureCache,
    markMagentaEnsureSettled,
};
