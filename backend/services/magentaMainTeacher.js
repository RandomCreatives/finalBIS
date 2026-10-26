const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

/**
 * Year 4 - Magenta main-teacher reconciliation (Ms. Bethelhem Girma),
 * school-wide main-teacher class-password rollout, and shared class-teacher
 * subject handover helpers.
 *
 * Every main teacher's basic credential is their class card password
 * (e.g. "Year 4 - Magenta" -> "year 4 magenta", "Year 3 - Blue" -> "year 3 blue"),
 * matching resetUserPassword and the class-card / PWA sign-in screens.
 */

// Legacy placeholder hash (BisNoc2026!) used by older provisioning scripts.
const BASIC_PASSWORD_HASH = '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';

// Precomputed cost-12 bcrypt hashes for the 14 homeroom class passwords so
// deployment reconciliation runs in O(1) without blocking serverless cold starts.
const CLASS_CARD_PASSWORD_HASHES = Object.freeze({
    'year 3 blue': '$2a$12$buxlkbo673ZpUWkqcsJjPuBh2hpUSUVzTx3HPe/z08aMvMrGFLI9a',
    'year 3 yellow': '$2a$12$sHkwhj6J/Rypb8MdYlvgb.05lcBYOO4UETVsrW2FxgkFKwVZqF0iK',
    'year 3 red': '$2a$12$O//lepp3wrg4tu83QV4XrusgEsmEV24PU9MxMHm3naiKIGapU1hmy',
    'year 3 green': '$2a$12$YXUrIEdZZnyhpjctJPJ6TuZnvvOZIaqhecT6V6zRcRPmZzMzD9Op2',
    'year 4 blue': '$2a$12$X40sN3lJNNM7CIiN2Ri6mOdU2rbIK4So6/pio4tT3urPyWOO1IWnG',
    'year 4 purple': '$2a$12$pkT1GiJOl9RmQ7yECtTVyOz9scJcULJQXiQF9VhsHsB6stO4IBbWK',
    'year 4 lavender': '$2a$12$JK/UH0apYGCQ87MlyxliOe0skQm8q0yV05g1EwvYtPjg9hC6.1/WC',
    'year 4 crimson': '$2a$12$LRh.tt6fWqzA4FEu6Z9UYen2tFkbkFglf5qK/lgNW/0jAlHgDeNNq',
    'year 4 green': '$2a$12$EF523UoZLgXlfy4DEHYGJODascdp/RPqs5bPJiu479/VZlbROqgKi',
    'year 4 yellow': '$2a$12$Z0nzpo8x1UyZNt1nPEwCFOgyRGJaIlyjCH1ySw/WzzKJ0013PEn4S',
    'year 4 magenta': '$2a$12$.gPYAFdP7YCuzg4dnVPfqeBQHmmzDaHemVfUdQ6SEeESqP10mFO9u',
    'year 4 red': '$2a$12$70tQen8ber4.KECfPx7vguWtKtgQsmFfj9YYy2mqxEXvpmjRC/zA2',
    'year 4 violet': '$2a$12$gviAb99MixXSVsPZuSALVu5D2vFlnYWZm/jgHgDMKgsZltGE64/JW',
    'year 4 orange': '$2a$12$Sk/z85dVFBgOG1KeIj3Utu/4.VU7lpK.7irRxyzGXrV3cyjqdveAe',
});

const MAGENTA_CLASS_NAME = 'Year 4 - Magenta';
const MAGENTA_PASSWORD_HASH = CLASS_CARD_PASSWORD_HASHES['year 4 magenta'];
const BETHELHEM_NAME = 'Bethelhem Girma';
const BETHELHEM_EMAIL = 'bethelhem.girma@bisnoc.local';
const TARGET_ACADEMIC_YEAR = '2026/2027';

const PROMOTABLE_ROLES = new Set(['subject_teacher', 'assistant_teacher']);
const ELIGIBLE_CLASS_ROLES = new Set(['main_teacher', 'admin']);

/** 'Year 4 - Magenta' -> 'year 4 magenta' */
const classCardPasswordFor = (className) =>
    String(className || '')
        .toLowerCase()
        .replace(/\s*-\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const classCardPasswordHashFor = async (className) => {
    const basic = classCardPasswordFor(className);
    if (!basic) return null;
    if (CLASS_CARD_PASSWORD_HASHES[basic]) return CLASS_CARD_PASSWORD_HASHES[basic];
    return bcrypt.hash(basic, 12);
};

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
 * Sets seated `main_teacher` accounts' passwords to their class card password
 * (e.g. `year 3 blue`, `year 4 magenta`).
 *
 * - When `forceAll` is true (during the one-time rollout when Ms. Bethelhem's
 *   account transitions off the legacy placeholder or on explicit admin request),
 *   every seated `main_teacher` gets their class card password hash.
 * - When `forceAll` is false (subsequent cold starts), only `main_teacher`s
 *   still carrying the legacy `BisNoc2026!` placeholder hash are upgraded, so
 *   personal passwords changed later under Settings are never overwritten.
 */
async function syncMainTeacherClassPasswords({
    client = supabase,
    schoolId,
    yearId,
    forceAll = false,
}) {
    const [{ data: seats, error: seatErr }, { data: classes, error: classErr }, { data: teachers, error: userErr }] =
        await Promise.all([
            client
                .from('class_staff')
                .select('class_id, user_id')
                .eq('school_id', schoolId)
                .eq('academic_year_id', yearId)
                .eq('position', 'main'),
            client
                .from('classes')
                .select('id, name')
                .eq('school_id', schoolId),
            client
                .from('users')
                .select('id, name, role, password_hash')
                .eq('school_id', schoolId)
                .eq('role', 'main_teacher'),
        ]);

    if (seatErr) throw seatErr;
    if (classErr) throw classErr;
    if (userErr) throw userErr;

    const classById = new Map((classes || []).map((c) => [c.id, c]));
    const teacherById = new Map((teachers || []).map((u) => [u.id, u]));

    let passwordsUpdated = 0;
    for (const seat of seats || []) {
        const klass = classById.get(seat.class_id);
        const teacher = teacherById.get(seat.user_id);
        if (!klass || !teacher || teacher.role !== 'main_teacher') continue;

        const targetHash = await classCardPasswordHashFor(klass.name);
        if (!targetHash || teacher.password_hash === targetHash) continue;

        const needsUpdate = forceAll || teacher.password_hash === BASIC_PASSWORD_HASH;
        if (!needsUpdate) continue;

        const { error: updErr } = await client
            .from('users')
            .update({ password_hash: targetHash })
            .eq('id', teacher.id);
        if (updErr) throw updErr;
        passwordsUpdated += 1;
    }

    return { passwordsUpdated };
}

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
 * Ensures Ms. Bethelhem Girma has an active `main_teacher` staff account with
 * password `year 4 magenta`, holds Year 4 - Magenta's main-teacher seat +
 * class-teacher subjects, and reconciles seated main-teacher class passwords.
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
        .select('id, name, email, role, is_active, school_id, password_hash')
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
            .select('id, name, email, role, is_active, school_id, password_hash')
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

    // Trigger the one-time school-wide main-teacher class-password rollout when
    // Ms. Bethelhem is created or upgraded off the legacy BisNoc2026! hash, or
    // when an admin invokes explicit reconciliation.
    const shouldForceSyncAllPasswords = Boolean(
        isExplicit || !bethelhem || bethelhem.password_hash === BASIC_PASSWORD_HASH
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

    // 5. Create or activate, promote & set class password on Ms. Bethelhem's account
    let accountAction = 'unchanged';
    if (!bethelhem) {
        const { data: created, error: createErr } = await client
            .from('users')
            .insert({
                school_id: schoolId,
                name: BETHELHEM_NAME,
                email: BETHELHEM_EMAIL,
                password_hash: MAGENTA_PASSWORD_HASH,
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
        if (
            bethelhem.password_hash !== MAGENTA_PASSWORD_HASH &&
            (isExplicit || bethelhem.password_hash === BASIC_PASSWORD_HASH)
        ) {
            patch.password_hash = MAGENTA_PASSWORD_HASH;
        }

        if (Object.keys(patch).length > 0) {
            const { data: updated, error: updateErr } = await client
                .from('users')
                .update(patch)
                .eq('id', bethelhem.id)
                .select('id, name, email, role, is_active, school_id')
                .single();
            if (updateErr) throw updateErr;
            bethelhem = updated;
            accountAction = patch.is_active
                ? 'activated'
                : patch.role
                    ? 'promoted'
                    : 'password_updated';
        }
    }

    // 6. Seat her as Year 4 - Magenta's main teacher (if not already)
    let homeroomChanged = false;
    if (!alreadySeated) {
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

    // 8. Align all seated main teachers' passwords with their class card password
    const { passwordsUpdated } = await syncMainTeacherClassPasswords({
        client,
        schoolId,
        yearId: year.id,
        forceAll: shouldForceSyncAllPasswords,
    });

    const changed =
        accountAction !== 'unchanged' ||
        homeroomChanged ||
        seatsTransferred > 0 ||
        passwordsUpdated > 0;

    return {
        status: changed ? 'applied' : 'already_applied',
        accountAction,
        homeroomChanged,
        passwordsUpdated,
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
                        `(account: ${result.accountAction}, seats: ${result.seatsTransferred}, ` +
                        `lessons: ${result.lessonsPlaced}, main passwords synced: ${result.passwordsUpdated})`
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
    MAGENTA_PASSWORD_HASH,
    CLASS_CARD_PASSWORD_HASHES,
    MAGENTA_CLASS_NAME,
    BETHELHEM_NAME,
    BETHELHEM_EMAIL,
    TARGET_ACADEMIC_YEAR,
    classCardPasswordFor,
    classCardPasswordHashFor,
    syncMainTeacherClassPasswords,
    prepareMainTeacherSeatHandover,
    applyMainTeacherSeatHandover,
    ensureMagentaMainTeacher,
    ensureMagentaMainTeacherOnce,
    resetMagentaEnsureCache,
    markMagentaEnsureSettled,
};
