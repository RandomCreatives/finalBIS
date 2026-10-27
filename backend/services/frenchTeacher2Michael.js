const supabase = require('../config/supabase');

/**
 * Staffs the "French, Teacher 2" placeholder (`French Teacher 2` /
 * `french.teacher.2@bisnocgerji.local`, created in 030_timetable_update_2026_10)
 * as **Mr. Michael** (`mr.michael@bisnoc.local`).
 *
 * Distinct from `Michael Okwara Okwara` ("Mr. Mike", English & Spelling), who
 * teaches simultaneous periods in other classes.
 *
 * Updating the placeholder row in place preserves its UUID so all 7 French
 * `class_subjects` seats (Year 3 Blue & Yellow; Year 4 Yellow, Magenta, Red,
 * Violet & Orange), all 14 weekly `timetable_slots`, marksheets, assessments,
 * and any linked Telegram account carry over immediately.
 */

// Standard subject-teacher basic password (`BisNoc2026!`).
const BASIC_PASSWORD_HASH = '$2a$12$jVvHpVG5qszwKEk8k0suCea/J50mLYP071GLFkw9/NmQwOl.9ppQe';

const PLACEHOLDER_EMAIL = 'french.teacher.2@bisnocgerji.local';
const TARGET_NAME = 'Mr. Michael';
const TARGET_EMAIL = 'mr.michael@bisnoc.local';

const isFrenchPlaceholderName = (name) =>
    /^french\s+teacher(?:\s+2|\s*\(tbc\))?$/i.test(String(name || '').trim());

const isTargetMichaelName = (name) =>
    /^mr\.?\s+michael$/i.test(String(name || '').trim());

async function ensureFrenchTeacher2Michael({ client = supabase } = {}) {
    const { data: schools, error: schoolErr } = await client
        .from('schools')
        .select('id');
    if (schoolErr) throw schoolErr;
    if (!schools || schools.length !== 1) {
        return { status: 'skipped', reason: 'school_not_unique' };
    }
    const schoolId = schools[0].id;

    const { data: users, error: usersErr } = await client
        .from('users')
        .select('id, name, email, role, is_active, school_id, password_hash')
        .eq('school_id', schoolId);
    if (usersErr) throw usersErr;

    const allUsers = users || [];

    const placeholder = allUsers.find(
        (u) =>
            String(u.email || '').trim().toLowerCase() === PLACEHOLDER_EMAIL ||
            isFrenchPlaceholderName(u.name)
    );

    const existingMichael = allUsers.find(
        (u) =>
            (!placeholder || u.id !== placeholder.id) &&
            (isTargetMichaelName(u.name) ||
                String(u.email || '').trim().toLowerCase() === TARGET_EMAIL)
    );

    // Nothing left to migrate if no placeholder exists.
    if (!placeholder) {
        return {
            status: 'already_applied',
            user: existingMichael
                ? {
                    id: existingMichael.id,
                    name: existingMichael.name,
                    email: existingMichael.email,
                    role: existingMichael.role,
                    isActive: existingMichael.is_active,
                }
                : null,
        };
    }

    // Edge case: an admin already created a separate "Mr. Michael" account
    // while `French Teacher 2` still existed. Hand over seats and deactivate
    // the placeholder.
    if (existingMichael) {
        const michaelPatch = {};
        if (!existingMichael.is_active) michaelPatch.is_active = true;
        if (existingMichael.role !== 'subject_teacher') michaelPatch.role = 'subject_teacher';
        if (!existingMichael.password_hash) michaelPatch.password_hash = BASIC_PASSWORD_HASH;

        let targetUser = existingMichael;
        if (Object.keys(michaelPatch).length > 0) {
            const { data: updatedMichael, error: updErr } = await client
                .from('users')
                .update(michaelPatch)
                .eq('id', existingMichael.id)
                .select('id, name, email, role, is_active, school_id')
                .single();
            if (updErr) throw updErr;
            targetUser = updatedMichael;
        }

        const { data: movedSeats, error: seatErr } = await client
            .from('class_subjects')
            .update({ teacher_id: targetUser.id })
            .eq('teacher_id', placeholder.id)
            .select('id');
        if (seatErr) throw seatErr;

        // Keep timetable_slots in sync in environments without the DB trigger.
        const { error: slotErr } = await client
            .from('timetable_slots')
            .update({ teacher_id: targetUser.id })
            .eq('teacher_id', placeholder.id);
        if (slotErr) throw slotErr;

        if (placeholder.is_active) {
            const { error: deactErr } = await client
                .from('users')
                .update({ is_active: false })
                .eq('id', placeholder.id);
            if (deactErr) throw deactErr;
        }

        return {
            status: 'applied',
            action: 'merged_into_existing',
            seatsMoved: (movedSeats || []).length,
            user: {
                id: targetUser.id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                isActive: targetUser.is_active,
            },
        };
    }

    // Normal path: rename `French Teacher 2` in place to `Mr. Michael`.
    const emailTakenByOther = allUsers.some(
        (u) =>
            u.id !== placeholder.id &&
            String(u.email || '').trim().toLowerCase() === TARGET_EMAIL
    );

    const patch = {};
    if (placeholder.name !== TARGET_NAME) patch.name = TARGET_NAME;
    if (
        !emailTakenByOther &&
        String(placeholder.email || '').trim().toLowerCase() === PLACEHOLDER_EMAIL
    ) {
        patch.email = TARGET_EMAIL;
    }
    if (placeholder.role !== 'subject_teacher') patch.role = 'subject_teacher';
    if (!placeholder.is_active) patch.is_active = true;
    if (!placeholder.password_hash) patch.password_hash = BASIC_PASSWORD_HASH;

    if (Object.keys(patch).length === 0) {
        return {
            status: 'already_applied',
            user: {
                id: placeholder.id,
                name: placeholder.name,
                email: placeholder.email,
                role: placeholder.role,
                isActive: placeholder.is_active,
            },
        };
    }

    const { data: updated, error: updateErr } = await client
        .from('users')
        .update(patch)
        .eq('id', placeholder.id)
        .select('id, name, email, role, is_active, school_id')
        .single();
    if (updateErr) throw updateErr;

    return {
        status: 'applied',
        action: 'renamed_in_place',
        user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            isActive: updated.is_active,
        },
    };
}

let oncePromise = null;
let onceSettled = false;

function ensureFrenchTeacher2MichaelOnce({ client = supabase } = {}) {
    if (onceSettled) return Promise.resolve({ status: 'cached' });
    if (!oncePromise) {
        oncePromise = ensureFrenchTeacher2Michael({ client })
            .then((result) => {
                onceSettled = true;
                if (result.status === 'applied') {
                    console.log(
                        `[staffing] French Teacher 2 -> ${TARGET_NAME} (${result.action})`
                    );
                }
                return result;
            })
            .catch((err) => {
                oncePromise = null;
                throw err;
            });
    }
    return oncePromise;
}

function resetFrenchTeacher2EnsureCache() {
    oncePromise = null;
    onceSettled = false;
}

module.exports = {
    PLACEHOLDER_EMAIL,
    TARGET_NAME,
    TARGET_EMAIL,
    BASIC_PASSWORD_HASH,
    ensureFrenchTeacher2Michael,
    ensureFrenchTeacher2MichaelOnce,
    resetFrenchTeacher2EnsureCache,
};
