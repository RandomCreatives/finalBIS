// Creates (or updates) a single teacher test account with a known password.
// Mirrors the column set used by create-admins.js (the live `users` table has
// no `is_email_verified` column yet, so we don't set it).
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const TEACHER = {
    name: 'Test Teacher',
    email: 'teacher.bisnoc@gmail.com',
    password: 'Teacher2026!',
    role: 'main_teacher',
};

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) throw new Error('No school found — run the seed first');

    const password_hash = await bcrypt.hash(TEACHER.password, 12);
    const { data: existing } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', TEACHER.email)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('users')
            .update({ name: TEACHER.name, password_hash, role: TEACHER.role, is_active: true })
            .eq('id', existing.id);
        if (error) throw error;
        console.log(`Updated existing: ${TEACHER.email} -> ${TEACHER.role}`);
    } else {
        const { error } = await supabase.from('users').insert({
            school_id: school.id,
            name: TEACHER.name,
            email: TEACHER.email,
            password_hash,
            role: TEACHER.role,
            is_active: true,
        });
        if (error) throw error;
        console.log(`Created: ${TEACHER.email} (${TEACHER.role})`);
    }

    console.log('\nTeacher login:');
    console.log(`  ${TEACHER.email}  /  ${TEACHER.password}`);
}

main().catch((e) => {
    console.error('FAILED:', e.message || e);
    process.exit(1);
});
