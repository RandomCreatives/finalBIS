/**
 * Utility: set an account's password (admin reset, by hand).
 *
 * First used 2026-09-21: after the placeholder→named seat assignment, the
 * eleven named subject teachers kept the passwords nobody had ever been
 * told (the accounts were created ahead of hiring). Teachers knew the
 * shared placeholder password, so the eleven were set to it. The password
 * itself is NEVER stored in this file — it is passed on the command line.
 * Target accounts are passed by exact email, one flag each.
 *
 * Verifies before writing: every account must exist, be active, and (for
 * subject teachers) hold seats this year — a mismatch prints a warning so
 * typos don't set passwords on the wrong person. After writing, each stored
 * hash is re-read and checked against the new password.
 *
 * Usage:
 *   node scripts/reset-account-password.js --password 'NewPass123!' \
 *     --email mihiret.hmariam@bisnoc.local --email fremnet.esubalew@bisnoc.local \
 *     [--dry-run]
 */

require('dotenv').config({ path: './.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const BCRYPT_ROUNDS = 12; // matches the auth controller
const DRY_RUN = process.argv.includes('--dry-run');

const arg = (flag) => {
    const out = [];
    process.argv.forEach((a, i) => { if (a === flag && process.argv[i + 1]) out.push(process.argv[i + 1]); });
    return out;
};

const fail = (msg) => { console.error(`\nABORT: ${msg}`); process.exit(1); };

const main = async () => {
    const [password] = arg('--password');
    const emails = arg('--email').map((e) => e.trim().toLowerCase());
    if (!password || password.length < 8) fail('pass --password (8+ characters)');
    if (emails.length === 0) fail('pass at least one --email');

    const { data: school } = await supabase.from('schools').select('id').maybeSingle();
    if (!school) fail('school not found');

    const { data: year } = await supabase
        .from('academic_years').select('id').eq('is_current', true).maybeSingle();

    const warnings = [];
    const targets = [];
    for (const email of emails) {
        const { data: u } = await supabase
            .from('users').select('id, name, email, role, is_active')
            .eq('school_id', school.id).eq('email', email).maybeSingle();
        if (!u) fail(`no account with email ${email}`);
        if (!u.is_active) warnings.push(`${u.name} <${email}> is deactivated`);
        if (u.role === 'subject_teacher' && year) {
            const { count } = await supabase
                .from('class_subjects').select('id', { count: 'exact', head: true })
                .eq('academic_year_id', year.id).eq('teacher_id', u.id);
            if (!count) warnings.push(`${u.name} <${email}> holds no seats this year`);
        }
        targets.push(u);
    }

    console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}Password reset for ${targets.length} account(s)`);
    for (const u of targets) console.log(`  ${u.role.padEnd(16)} ${u.name} <${u.email}>`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);

    if (DRY_RUN) { console.log('\n(dry run — no database changes)'); return; }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    for (const u of targets) {
        const { error } = await supabase.from('users').update({ password_hash }).eq('id', u.id);
        if (error) fail(`${u.email}: update failed — ${error.message}`);
    }

    // Re-read every account and prove the new password verifies.
    for (const u of targets) {
        const { data: check } = await supabase.from('users').select('password_hash').eq('id', u.id).single();
        if (!check || !(await bcrypt.compare(password, check.password_hash)))
            fail(`${u.email}: stored hash does not verify against the new password`);
        console.log(`  ✓ ${u.name}: password set and verified`);
    }

    console.log('\nDone. Teachers sign in from their wall card with the new password.');
};

main().catch((e) => fail(e.message));
