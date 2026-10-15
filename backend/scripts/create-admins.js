const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const RESET_PASSWORDS = process.argv.includes('--reset-passwords');
const ENV_INITIAL_PASS = process.env.STAFF_INITIAL_PASSWORD;

const ADMINS = [
    { name: 'Mr. Leul (Principal)',   email: 'leul@bisnoc.local',  title: 'Principal' },
    { name: 'Mr. Mike (Coordinator)', email: 'mike@bisnoc.local',  title: 'Coordinator' },
];

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    if (!school) throw new Error('No school found');
    const schoolId = school.id;

    const credentialsOutput = [];

    for (const a of ADMINS) {
        const { data: existing } = await supabase.from('users').select('id, email').eq('email', a.email).maybeSingle();

        if (existing && !RESET_PASSWORDS) {
            const { error } = await supabase.from('users')
                .update({ name: a.name, role: 'admin', is_active: true })
                .eq('id', existing.id);
            if (error) throw error;
            console.log(`Updated existing: ${a.email} -> ${a.name} (admin, password unchanged)`);
            credentialsOutput.push({ title: a.title, email: a.email, displayPass: '(password unchanged)' });
            continue;
        }

        const passToSet = ENV_INITIAL_PASS || crypto.randomBytes(16).toString('hex');
        const password_hash = await bcrypt.hash(passToSet, 12);
        const displayPass = ENV_INITIAL_PASS ? '(from STAFF_INITIAL_PASSWORD)' : passToSet;

        if (existing && RESET_PASSWORDS) {
            const { error } = await supabase.from('users')
                .update({ name: a.name, password_hash, role: 'admin', is_active: true })
                .eq('id', existing.id);
            if (error) throw error;
            console.log(`Reset password for existing: ${a.email} -> ${a.name} (admin)`);
        } else {
            const { error } = await supabase.from('users').insert({
                school_id: schoolId, name: a.name, email: a.email,
                password_hash, role: 'admin', is_active: true,
            });
            if (error) throw error;
            console.log(`Created: ${a.email} (${a.name}, role=admin)`);
        }

        credentialsOutput.push({ title: a.title, email: a.email, displayPass });
    }

    console.log('\nLogin credentials summary:');
    credentialsOutput.forEach(c => console.log(`  ${c.title.padEnd(20)} ${c.email}  /  ${c.displayPass}`));
    console.log('\n(telegram_id is empty — link Telegram later from the app.)');
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
