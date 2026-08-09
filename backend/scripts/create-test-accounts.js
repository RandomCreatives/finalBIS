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
 * Credentials created (the Gmail address is the login email, so BOTH the
 * password login and the passwordless "Sign in with Gmail" code flow work
 * with the same address):
 *   store.bisnoc@gmail.com   / Store2026!    (store_manager)
 *   library.bisnoc@gmail.com / Library2026!  (assistant_teacher)
 *   clinic.bisnoc@gmail.com  / Clinic2026!   (main_teacher)
 *
 * Each account is marked is_email_verified = true so the code flow is wired
 * up end to end.
 */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const supabase = require('../config/supabase');

const ACCOUNTS = [
    { name: 'Store Manager', email: 'store.bisnoc@gmail.com', password: 'Store2026!', role: 'store_manager' },
    { name: 'Librarian', email: 'library.bisnoc@gmail.com', password: 'Library2026!', role: 'assistant_teacher' },
    { name: 'Clinic Nurse', email: 'clinic.bisnoc@gmail.com', password: 'Clinic2026!', role: 'main_teacher' },
];

async function main() {
    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .limit(1)
        .maybeSingle();
    if (schoolError) throw schoolError;
    if (!school) throw new Error('No school found — run the seed script first');

    for (const acc of ACCOUNTS) {
        const { data: existing } = await supabase
            .from('users')
            .select('id, role, is_email_verified')
            .eq('email', acc.email)
            .maybeSingle();

        if (existing) {
            // Update role/password to the intended values, and set the Gmail
            // as verified so passwordless sign-in works immediately.
            const password_hash = await bcrypt.hash(acc.password, 12);
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
            console.log(`updated ${acc.email}  (role=${acc.role})`);
            continue;
        }

        const password_hash = await bcrypt.hash(acc.password, 12);
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

    console.log('\nDone. Test logins (password OR Gmail code):');
    ACCOUNTS.forEach((a) => console.log(`  ${a.email} / ${a.password}  (${a.name})`));
    console.log('\nExisting admin: master@bisnoc.test / Master2026!');
}

main().catch((err) => {
    console.error('\nFailed:', err.message || err);
    process.exit(1);
});
