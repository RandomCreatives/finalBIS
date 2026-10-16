// Creates (or updates) a single teacher test account.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const RESET_PASSWORDS = process.argv.includes('--reset-passwords');
const ENV_INITIAL_PASS = process.env.STAFF_INITIAL_PASSWORD;

const TEACHER = {
    name: 'Test Teacher',
    email: 'teacher.bisnoc@gmail.com',
    role: 'main_teacher',
};

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) throw new Error('No school found — run the seed first');

    const { data: existing } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', TEACHER.email)
        .maybeSingle();

    if (existing && !RESET_PASSWORDS) {
        const { error } = await supabase
            .from('users')
            .update({ name: TEACHER.name, role: TEACHER.role, is_active: true })
            .eq('id', existing.id);
        if (error) throw error;
        console.log(`Updated existing: ${TEACHER.email} -> ${TEACHER.role} (password unchanged)`);
        console.log('\nTeacher login:');
        console.log(`  ${TEACHER.email}  /  (password unchanged)`);
        return;
    }

    const passToSet = ENV_INITIAL_PASS || crypto.randomBytes(16).toString('hex');
    const password_hash = await bcrypt.hash(passToSet, 12);
    const displayPass = ENV_INITIAL_PASS ? '(from STAFF_INITIAL_PASSWORD)' : passToSet;

    if (existing && RESET_PASSWORDS) {
        const { error } = await supabase
            .from('users')
            .update({ name: TEACHER.name, password_hash, role: TEACHER.role, is_active: true })
            .eq('id', existing.id);
        if (error) throw error;
        console.log(`Reset password for existing: ${TEACHER.email} -> ${TEACHER.role}`);
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
    console.log(`  ${TEACHER.email}  /  ${displayPass}`);
}

main().catch((e) => {
    console.error('FAILED:', e.message || e);
    process.exit(1);
});
