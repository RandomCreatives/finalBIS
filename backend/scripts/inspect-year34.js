require('dotenv').config({ path: './.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

function normalize(n) {
    return String(n || '')
        .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+/i, '')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function initials(name) {
    const parts = normalize(name).split(' ').filter(Boolean);
    return {
        first: parts[0] || '',
        last: parts.length > 1 ? parts[parts.length - 1] : '',
        middleInitials: parts.slice(1, -1).map(p => p[0]).join('')
    };
}

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    const schoolId = school.id;

    const { data: currentYear } = await supabase
        .from('academic_years').select('id, name, is_current')
        .eq('school_id', schoolId).eq('is_current', true).maybeSingle();

    console.log('School:', schoolId);
    console.log('Current academic year:', currentYear ? `${currentYear.name} (${currentYear.id})` : 'NONE');
    const yearId = currentYear ? currentYear.id : null;

    const { data: classes } = await supabase
        .from('classes').select('id, name').eq('school_id', schoolId).order('name');

    const { data: users } = await supabase
        .from('users').select('id, name, email, role, is_active')
        .eq('school_id', schoolId).order('name');

    console.log('\n=== CLASSES (Year 3 / Year 4) ===');
    const targetClasses = (classes || []).filter(c => /year\s*3|year\s*4/i.test(c.name));
    targetClasses.forEach(c => console.log(`  ${c.id}  ${c.name}`));

    console.log('\n=== USERS (active, non-admin) ===');
    (users || [])
        .filter(u => u.is_active && u.role !== 'admin')
        .forEach(u => console.log(`  ${u.id}  ${u.name}  [${u.role}]`));

    // Parse CSV
    const csv = fs.readFileSync(path.join(__dirname, '..', '..', 'Year_3_and_Year_4_Class_Teachers.csv'), 'utf8');
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    let year = '';
    const rows = [];
    for (const line of lines) {
        if (/^Year\s*\d/.test(line)) { year = line.split(',')[0].trim(); continue; }
        if (/^(Class|Teacher),?$/.test(line)) continue;
        const [cls, teacher] = line.split(',').map(s => (s || '').trim());
        if (!cls) continue;
        rows.push({ year, cls, teacher });
    }

    console.log('\n=== MATCHING PLAN (dry run) ===');
    const classKey = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const classMap = new Map((classes || []).map(c => [classKey(c.name), c]));

    for (const r of rows) {
        const fullClass = `${r.year} - ${r.cls}`;
        const clsMatch = classMap.get(classKey(fullClass));
        if (/to be assigned|new teacher/i.test(r.teacher || '')) {
            console.log(`  SKIP  ${fullClass} -> "${r.teacher}" (no teacher specified)`);
            continue;
        }
        const ni = initials(r.teacher);
        const cands = (users || []).filter(u => {
            const un = normalize(u.name);
            const ut = un.split(' ').filter(Boolean);
            const uFirst = ut[0] || '';
            const uLast = ut.length > 1 ? ut[ut.length - 1] : '';
            const firstOk = !ni.first || uFirst.startsWith(ni.first) || ni.first.startsWith(uFirst);
            const lastOk = !ni.last || uLast.startsWith(ni.last) || ni.last.startsWith(uLast);
            return firstOk && lastOk;
        });
        console.log(`  ${fullClass.padEnd(20)} -> "${r.teacher}"`);
        console.log(`      class: ${clsMatch ? clsMatch.id + '  ' + clsMatch.name : 'NOT FOUND'}`);
        console.log(`      teacher candidates:`);
        cands.forEach(c => console.log(`        - ${c.id}  ${c.name}  [${c.role}]  ${c.email}`));
        if (!cands.length) console.log('        NONE');
    }
}

main().catch(e => { console.error('ERR', e.message || e); process.exit(1); });
