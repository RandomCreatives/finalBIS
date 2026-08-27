const bcrypt = require('bcryptjs');
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

async function createUser(schoolId, { name, email, password, role }) {
    const password_hash = await bcrypt.hash(password, 12);
    
    // Check if exists
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    
    if (existing) {
        // Update
        const { error } = await supabase
            .from('users')
            .update({ name, password_hash, role, is_active: true })
            .eq('id', existing.id);
        if (error) throw error;
        console.log(`Updated: ${email} (${role})`);
        return existing.id;
    }
    
    const { data, error } = await supabase
        .from('users')
        .insert({
            school_id: schoolId,
            name,
            email,
            password_hash,
            role,
            is_active: true,
        })
        .select('id')
        .single();
    
    if (error) throw error;
    console.log(`Created: ${email} (${role})`);
    return data.id;
}

async function main() {
    const schoolId = await getSchoolId();
    console.log(`Using school: ${schoolId}\n`);

    // 2 Admins
    await createUser(schoolId, {
        name: 'System Administrator',
        email: 'admin1@bisnoc.local',
        password: 'Admin2026!',
        role: 'admin'
    });
    await createUser(schoolId, {
        name: 'Deputy Administrator',
        email: 'admin2@bisnoc.local',
        password: 'Admin2026!',
        role: 'admin'
    });

    // 1 Clinic (role: main_teacher per create-test-accounts convention)
    await createUser(schoolId, {
        name: 'Clinic Nurse',
        email: 'clinic@bisnoc.local',
        password: 'Clinic2026!',
        role: 'main_teacher'
    });

    // 1 Store (using assistant_teacher role until migration adds store_manager)
    await createUser(schoolId, {
        name: 'Store Manager',
        email: 'store@bisnoc.local',
        password: 'Store2026!',
        role: 'assistant_teacher'
    });

    // 1 Main Teacher
    await createUser(schoolId, {
        name: 'Main Teacher',
        email: 'mainteacher@bisnoc.local',
        password: 'Teacher2026!',
        role: 'main_teacher'
    });

    // 6 Subject Teachers (one per subject)
    const subjects = [
        { name: 'English Teacher', email: 'english@bisnoc.local' },
        { name: 'Amharic Teacher', email: 'amharic@bisnoc.local' },
        { name: 'Music Teacher', email: 'music@bisnoc.local' },
        { name: 'Arts Teacher', email: 'arts@bisnoc.local' },
        { name: 'PE Teacher', email: 'pe@bisnoc.local' },
        { name: 'French Teacher', email: 'french@bisnoc.local' },
    ];

    for (const s of subjects) {
        await createUser(schoolId, {
            name: s.name,
            email: s.email,
            password: 'Teacher2026!',
            role: 'subject_teacher'
        });
    }

    console.log('\n=== ALL ACCOUNTS CREATED ===');
    console.log('Admins:');
    console.log('  admin1@bisnoc.local / Admin2026!');
    console.log('  admin2@bisnoc.local / Admin2026!');
    console.log('Clinic:');
    console.log('  clinic@bisnoc.local / Clinic2026! (role: main_teacher)');
    console.log('Store:');
    console.log('  store@bisnoc.local / Store2026! (role: store_manager)');
    console.log('Main Teacher:');
    console.log('  mainteacher@bisnoc.local / Teacher2026!');
    console.log('Subject Teachers (all password: Teacher2026!):');
    subjects.forEach(s => console.log(`  ${s.email}`));
}

main().catch(err => {
    console.error('Failed:', err.message || err);
    process.exit(1);
});