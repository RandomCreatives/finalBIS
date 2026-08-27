const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const ADMINS = [
    { name: 'Mr. Leul (Principal)',   email: 'leul@bisnoc.local',  password: 'Leul2026!',  title: 'Principal' },
    { name: 'Mr. Mike (Coordinator)', email: 'mike@bisnoc.local',  password: 'Mike2026!',  title: 'Coordinator' },
];

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) throw new Error('No school found');
    const schoolId = school.id;

    for (const a of ADMINS) {
        const password_hash = await bcrypt.hash(a.password, 12);
        const { data: existing } = await supabase.from('users').select('id, email').eq('email', a.email).maybeSingle();
        if (existing) {
            const { error } = await supabase.from('users')
                .update({ name: a.name, password_hash, role: 'admin', is_active: true })
                .eq('id', existing.id);
            if (error) throw error;
            console.log(`Updated existing: ${a.email} -> ${a.name} (admin)`);
            continue;
        }
        const { error } = await supabase.from('users').insert({
            school_id: schoolId, name: a.name, email: a.email,
            password_hash, role: 'admin', is_active: true,
        });
        if (error) throw error;
        console.log(`Created: ${a.email} (${a.name}, role=admin)`);
    }
    console.log('\nLogin credentials:');
    ADMINS.forEach(a => console.log(`  ${a.title.padEnd(12)} ${a.email}  /  ${a.password}`));
    console.log('\n(telegram_id is empty — link Telegram later from the app.)');
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
