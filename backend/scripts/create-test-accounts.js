#!/usr/bin/env node
/**
 * Creates test login accounts for the store, library and clinic roles.
 *
 * Run AFTER applying supabase/migrations/007_consolidated_upgrade.sql in the
 * Supabase SQL editor (it widens the role CHECK to admit store_manager).
 *
 *   cd backend
 *   node scripts/create-test-accounts.js
 *
 * Each account is marked is_email_verified = true so the code flow is wired
 * up end to end.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const supabase = require('../config/supabase');

const RESET_PASSWORDS = process.argv.includes('--reset-passwords');
const ENV_INITIAL_PASS = process.env.STAFF_INITIAL_PASSWORD;

const ACCOUNTS = [
    { name: 'Store Manager', email: 'store.bisnoc@gmail.com', role: 'store_manager' },
    { name: 'Librarian', email: 'library.bisnoc@gmail.com', role: 'assistant_teacher' },
    { name: 'Clinic Nurse', email: 'clinic.bisnoc@gmail.com', role: 'main_teacher' },
];

async function main() {
    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .limit(1)
        .maybeSingle();
    if (schoolError) throw schoolError;
    if (!school) throw new Error('No school found — run the seed script first');

    const results = [];

    for (const acc of ACCOUNTS) {
        const { data: existing } = await supabase
            .from('users')
            .select('id, role, is_email_verified')
            .eq('email', acc.email)
            .maybeSingle();

        if (existing && !RESET_PASSWORDS) {
            const { error } = await supabase
                .from('users')
                .update({
                    role: acc.role,
                    name: acc.name,
                    is_active: true,
                    is_email_verified: true,
                    pending_email: null,
                })
                .eq('id', existing.id);
            if (error) throw error;
            console.log(`updated ${acc.email}  (role=${acc.role}, password unchanged)`);
            results.push({ email: acc.email, name: acc.name, role: acc.role, displayPass: '(password unchanged)' });
            continue;
        }

        const passToSet = ENV_INITIAL_PASS || crypto.randomBytes(16).toString('hex');
        const password_hash = await bcrypt.hash(passToSet, 12);
        const displayPass = ENV_INITIAL_PASS ? '(from STAFF_INITIAL_PASSWORD)' : passToSet;

        if (existing && RESET_PASSWORDS) {
            const { error } = await supabase
                .from('users')
                .update({
                    role: acc.role,
                    password_hash,
                    name: acc.name,
                    is_active: true,
                    is_email_verified: true,
                    pending_email: null,
                })
                .eq('id', existing.id);
            if (error) throw error;
            console.log(`reset password for ${acc.email}  (role=${acc.role})`);
        } else {
            const { data, error } = await supabase
                .from('users')
                .insert({
                    school_id: school.id,
                    name: acc.name,
                    email: acc.email,
                    password_hash,
                    role: acc.role,
                    is_active: true,
                    is_email_verified: true,
                    pending_email: null,
                })
                .select('id, email, role')
                .single();

            if (error) throw error;
            console.log(`created ${data.email}  (role=${data.role})`);
        }

        results.push({ email: acc.email, name: acc.name, role: acc.role, displayPass });
    }

    console.log('\nDone. Test login credentials summary:');
    results.forEach((a) => console.log(`  ${a.email.padEnd(25)} / ${a.displayPass.padEnd(35)}  (${a.name})`));
}

main().catch((err) => {
    console.error('\nFailed:', err.message || err);
    process.exit(1);
});
