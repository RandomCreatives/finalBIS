const supabase = require('../config/supabase');

/**
 * Best-effort bell nudges.
 *
 * Producers (controllers) call `notify(...)` after the real work succeeded.
 * A nudge must NEVER break the request that triggered it — every error is
 * swallowed after a warning. Two cases matter in particular:
 *
 *  - before migration 018 has been applied the `notifications` table does
 *    not exist (42P01) — the app keeps working, the bell just shows
 *    announcements only until the migration lands;
 *  - concurrent producers racing on the same dedupe key (23505) — that is
 *    exactly what the UNIQUE(user_id, dedupe_key) is for, so it's fine.
 */

const missingTable = (error) =>
    error?.code === '42P01' || /notifications.*does not exist/i.test(error?.message || '');

const ignorable = (error) => missingTable(error) || error?.code === '23505';

const slugFor = (className) =>
    String(className || '').toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');

/**
 * Create one nudge row per recipient, skipping anyone who already has the
 * same nudge (same dedupe key). Recipients are in-app user ids.
 *
 * Resolves to the ids that received the nudge just now ([] when everyone
 * already had it, or on any failure), so a producer can follow up exactly
 * once per recipient — e.g. one Telegram message per reminder.
 */
const notify = async ({ schoolId, userIds, kind, title, body = '', link = null, dedupeKey }) => {
    try {
        const recipients = [...new Set((userIds || []).filter(Boolean))];
        if (!schoolId || recipients.length === 0 || !title || !dedupeKey) return [];

        // Who already has this exact nudge?
        const { data: existing, error: selectError } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('school_id', schoolId)
            .eq('dedupe_key', dedupeKey)
            .in('user_id', recipients);

        if (selectError) {
            if (missingTable(selectError)) return [];
            throw selectError;
        }

        const already = new Set((existing || []).map((row) => row.user_id));
        const rows = recipients
            .filter((id) => !already.has(id))
            .map((id) => ({
                school_id: schoolId,
                user_id: id,
                kind,
                title,
                body,
                link,
                dedupe_key: dedupeKey,
            }));

        if (rows.length === 0) return [];

        const { error: insertError } = await supabase.from('notifications').insert(rows);
        if (insertError) {
            // A concurrent producer won the race (23505): it owns the follow-up.
            if (ignorable(insertError)) return [];
            throw insertError;
        }
        return rows.map((row) => row.user_id);
    } catch (error) {
        console.warn('[nudges] skipped:', error.message);
        return [];
    }
};

/** Same nudge to every active admin in the school. */
const notifyAdmins = async ({ schoolId, excludeUserId = null, ...rest }) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('school_id', schoolId)
            .eq('role', 'admin')
            .eq('is_active', true);

        if (error) throw error;
        const ids = (data || []).map((u) => u.id).filter((id) => id !== excludeUserId);
        return await notify({ schoolId, userIds: ids, ...rest });
    } catch (error) {
        console.warn('[nudges] admin lookup failed:', error.message);
        return [];
    }
};

/**
 * Notify every active teacher attached to `classId` in the current academic year
 * (homeroom main/assistant teachers in `class_staff` + subject teachers in
 * `class_subjects`), giving each role a working workspace link.
 */
const notifyClassTeachers = async ({
    schoolId,
    classId,
    className = null,
    excludeUserIds = [],
    kind = 'roster_update',
    title,
    body = '',
    dedupeKey,
}) => {
    try {
        if (!schoolId || !classId || !title || !dedupeKey) return [];

        const { data: year, error: yearErr } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', schoolId)
            .eq('is_current', true)
            .maybeSingle();
        if (yearErr || !year?.id) return [];

        const [staffRes, subjRes, classRes] = await Promise.all([
            supabase
                .from('class_staff')
                .select('user_id')
                .eq('academic_year_id', year.id)
                .eq('class_id', classId),
            supabase
                .from('class_subjects')
                .select('teacher_id')
                .eq('academic_year_id', year.id)
                .eq('class_id', classId),
            className
                ? Promise.resolve({ data: { name: className }, error: null })
                : supabase
                    .from('classes')
                    .select('name')
                    .eq('id', classId)
                    .eq('school_id', schoolId)
                    .maybeSingle(),
        ]);

        if (staffRes.error || subjRes.error) return [];

        const excluded = new Set((excludeUserIds || []).filter(Boolean));
        const candidateIds = [...new Set([
            ...(staffRes.data || []).map((r) => r.user_id),
            ...(subjRes.data || []).map((r) => r.teacher_id),
        ].filter((id) => id && !excluded.has(id)))];

        if (candidateIds.length === 0) return [];

        const { data: users, error: userErr } = await supabase
            .from('users')
            .select('id, role, is_active')
            .eq('school_id', schoolId)
            .in('id', candidateIds);
        if (userErr) return [];

        const activeUsers = (users || []).filter((u) => u.is_active !== false);
        if (activeUsers.length === 0) return [];

        const resolvedClassName = classRes?.data?.name || className || '';
        const mainLink = resolvedClassName
            ? `/class-home/${slugFor(resolvedClassName)}`
            : '/app/students';

        const subjectIds = activeUsers.filter((u) => u.role === 'subject_teacher').map((u) => u.id);
        const mainIds = activeUsers.filter((u) => u.role === 'main_teacher').map((u) => u.id);
        const otherIds = activeUsers
            .filter((u) => u.role !== 'subject_teacher' && u.role !== 'main_teacher')
            .map((u) => u.id);

        const notified = await Promise.all([
            subjectIds.length
                ? notify({ schoolId, userIds: subjectIds, kind, title, body, link: '/subject-home', dedupeKey })
                : [],
            mainIds.length
                ? notify({ schoolId, userIds: mainIds, kind, title, body, link: mainLink, dedupeKey })
                : [],
            otherIds.length
                ? notify({ schoolId, userIds: otherIds, kind, title, body, link: '/app/students', dedupeKey })
                : [],
        ]);

        return notified.flat();
    } catch (error) {
        console.warn('[nudges] class-teacher lookup failed:', error.message);
        return [];
    }
};

module.exports = { notify, notifyAdmins, notifyClassTeachers };
