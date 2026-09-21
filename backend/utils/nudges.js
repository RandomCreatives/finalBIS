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

/**
 * Create one nudge row per recipient, skipping anyone who already has the
 * same nudge (same dedupe key). Recipients are in-app user ids.
 */
const notify = async ({ schoolId, userIds, kind, title, body = '', link = null, dedupeKey }) => {
    try {
        const recipients = [...new Set((userIds || []).filter(Boolean))];
        if (!schoolId || recipients.length === 0 || !title || !dedupeKey) return;

        // Who already has this exact nudge?
        const { data: existing, error: selectError } = await supabase
            .from('notifications')
            .select('user_id')
            .eq('school_id', schoolId)
            .eq('dedupe_key', dedupeKey)
            .in('user_id', recipients);

        if (selectError) {
            if (missingTable(selectError)) return;
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

        if (rows.length === 0) return;

        const { error: insertError } = await supabase.from('notifications').insert(rows);
        if (insertError && !ignorable(insertError)) throw insertError;
    } catch (error) {
        console.warn('[nudges] skipped:', error.message);
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
        await notify({ schoolId, userIds: ids, ...rest });
    } catch (error) {
        console.warn('[nudges] admin lookup failed:', error.message);
    }
};

module.exports = { notify, notifyAdmins };
