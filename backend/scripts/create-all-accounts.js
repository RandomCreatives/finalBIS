const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const RESET_PASSWORDS = process.argv.includes('--reset-passwords');
const ENV_INITIAL_PASS = process.env.STAFF_INITIAL_PASSWORD;

async function getSchoolId() {
    const { data: school, error } = await supabase
        .from('schools')
        .select('id')
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    if (!school) throw new Error('No school found — run seed.js first');
    return school.id;
}

async function handleUser(schoolId, { name, email, role }) {
    // Check if exists
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    
    if (existing && !RESET_PASSWORDS) {
        // Update without touching password_hash
        const { error } = await supabase
            .from('users')
            .update({ name, role, is_active: true })
            .eq('id', existing.id);
        if (error) throw error;
        console.log(`Updated existing: ${email} (${role}, password unchanged)`);
        return { email, name, role, displayPass: '(password unchanged)' };
    }
    
    const passToSet = ENV_INITIAL_PASS || crypto.randomBytes(16).toString('hex');
    const password_hash = await bcrypt.hash(passToSet, 12);
    const displayPass = ENV_INITIAL_PASS ? '(from STAFF_INITIAL_PASSWORD)' : passToSet;

    if (existing && RESET_PASSWORDS) {
        const { error } = await supabase
            .from('users')
            .update({ name, password_hash, role, is_active: true })
            .eq('id', existing.id);
        if (error) throw error;
        console.log(`Reset password for existing: ${email} (${role})`);
    } else {
        const { error } = await supabase
            .from('users')
            .insert({
                school_id: schoolId,
                name,
                email,
                password_hash,
                role,
                is_active: true,
            });
        if (error) throw error;
        console.log(`Created: ${email} (${role})`);
    }

    return { email, name, role, displayPass };
}

async function main() {
    const schoolId = await getSchoolId();
    console.log(`Using school: ${schoolId}\n`);

    const results = [];

    // 2 Admins
    results.push(await handleUser(schoolId, {
        name: 'System Administrator',
        email: 'admin1@bisnoc.local',
        role: 'admin'
    }));
    results.push(await handleUser(schoolId, {
        name: 'Deputy Administrator',
        email: 'admin2@bisnoc.local',
        role: 'admin'
    }));

    // 1 Clinic
    results.push(await handleUser(schoolId, {
        name: 'Clinic Nurse',
        email: 'clinic@bisnoc.local',
        role: 'main_teacher'
    }));

    // 1 Store
    results.push(await handleUser(schoolId, {
        name: 'Store Manager',
        email: 'store@bisnoc.local',
        role: 'assistant_teacher'
    }));

    // 1 Main Teacher
    results.push(await handleUser(schoolId, {
        name: 'Main Teacher',
        email: 'mainteacher@bisnoc.local',
        role: 'main_teacher'
    }));

    // 6 Subject Teachers
    const subjects = [
        { name: 'English Teacher', email: 'english@bisnoc.local' },
        { name: 'Amharic Teacher', email: 'amharic@bisnoc.local' },
        { name: 'Music Teacher', email: 'music@bisnoc.local' },
        { name: 'Arts Teacher', email: 'arts@bisnoc.local' },
        { name: 'PE Teacher', email: 'pe@bisnoc.local' },
        { name: 'French Teacher', email: 'french@bisnoc.local' },
    ];

    for (const s of subjects) {
        results.push(await handleUser(schoolId, {
            name: s.name,
            email: s.email,
            role: 'subject_teacher'
        }));
    }

    console.log('\n=== ALL ACCOUNTS PROCESSED ===');
    results.forEach(r => {
        console.log(`  ${r.email.padEnd(25)} / ${r.displayPass.padEnd(35)} (${r.role})`);
    });
}

main().catch(err => {
    console.error('Failed:', err.message || err);
    process.exit(1);
});
