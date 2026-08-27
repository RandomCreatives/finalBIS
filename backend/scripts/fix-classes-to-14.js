require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const APPLY = process.env.APPLY === '1';
// Intended roster (exactly the CSV's 14 rows)
const KEEP_Y3 = ['Blue', 'Yellow', 'Red', 'Green'];
const KEEP_Y4 = ['Blue', 'Purple', 'Lavender', 'Crimson', 'Green', 'Yellow', 'Magenta', 'Red', 'Violet', 'Orange'];

// CSV main-teacher assignments (class "Year X - Color" -> user id). Red Y3 / Green Y4 are SKIP (no teacher).
const TEACHERS = {
    'Year 3 - Blue':   'a42e544f-810c-46da-bc9d-f62a8babb26b', // Yeabsira Amdie Kidanewold
    'Year 3 - Yellow': '8386d3d6-9507-4e4f-a748-b04a1ce87080', // Meron Abebe Tarekegn
    'Year 3 - Green':  '635483b5-d749-4c5c-a94c-f2c1f888fd2e', // Degnet Engida Addis
    'Year 4 - Blue':   'f83d00d4-52cc-49d0-9b9f-f6ccf9f374a4', // Mulugeta Jemberu Dargie
    'Year 4 - Purple': '7e28f5b0-9546-44d0-8dd6-457c086a650c', // Mekdelawit Abate Nebebe
    'Year 4 - Lavender':'91e4c527-cfa1-43bf-91e7-0480b9de61c6', // Selam Goyte Abza
    'Year 4 - Crimson':'a551f7ef-2b67-46df-b10d-ef868f8cceee', // Simegn Yilma Akalu
    'Year 4 - Yellow': 'de15baf5-55d1-4bd7-b585-4e6997857c7d', // Mariamawit Belay Nadew
    'Year 4 - Magenta':'b49699f4-da75-484e-aae1-bc56a72ba52c', // Abigia Alemayehu Dogamo
    'Year 4 - Red':    'e636e2ae-d3c6-4f5d-8f4f-7f182c5d150f', // Denebe Abu Shuniye
    'Year 4 - Violet': '6a67c290-3baa-47ce-b9f4-a7122ab58895', // Abigiya Tadele Biru
    'Year 4 - Orange': '684187a9-0369-4438-bcab-fe9a63a6bbcf', // Mekdelawit Nigusu Alemu
};

function parse(name) {
    const m = name.match(/^Year (\d+) - (.+)$/);
    return m ? { y: parseInt(m[1], 10), color: m[2] } : null;
}

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    const schoolId = school.id;
    const { data: year } = await supabase.from('academic_years').select('id, name')
        .eq('school_id', schoolId).eq('is_current', true).maybeSingle();
    const yearId = year.id;
    const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', schoolId);
    const byName = new Map(classes.map(c => [c.name, c]));

    // Classes to delete: Y3 not in KEEP_Y3, Y4 not in KEEP_Y4
    const toDelete = classes.filter(c => {
        const p = parse(c.name);
        if (!p) return false;
        if (p.y === 3) return !KEEP_Y3.includes(p.color);
        if (p.y === 4) return !KEEP_Y4.includes(p.color);
        return false;
    });

    // Ensure all KEEP classes exist (create missing Y4 Crimson)
    const missing = [];
    for (const n of [...Object.keys(TEACHERS), 'Year 3 - Red', 'Year 4 - Green']) {
        if (!byName.has(n)) missing.push(n);
    }

    console.log(`[${APPLY ? 'APPLY' : 'PLAN'}] School ${schoolId} | Year ${year.name}`);
    console.log(`\nKEEP classes (${KEEP_Y3.length} Y3 + ${KEEP_Y4.length} Y4 = ${KEEP_Y3.length + KEEP_Y4.length}):`);
    console.log('  Y3:', KEEP_Y3.join(', '));
    console.log('  Y4:', KEEP_Y4.join(', '));

    console.log(`\nDELETE ${toDelete.length} classes (all should have 0 students):`);
    const delIds = toDelete.map(c => c.id);
    const { data: stu } = await supabase.from('students').select('class_id').in('class_id', delIds);
    const stuCount = stu ? stu.length : 0;
    toDelete.forEach(c => console.log('  - ' + c.name));
    if (stuCount > 0) { console.log(`  !! ABORT: ${stuCount} students enrolled in deletion targets`); process.exit(1); }

    console.log(`\nCREATE missing KEEP classes: ${missing.length ? missing.join(', ') : 'none'}`);

    if (!APPLY) { console.log('\n(Plan only. Re-run with APPLY=1 to execute.)'); return; }

    // 1) delete extras
    const { error: de } = await supabase.from('classes').delete().in('id', delIds);
    if (de) { console.log('  FAIL delete: ' + de.message); process.exit(1); }
    console.log(`  OK deleted ${delIds.length} classes`);

    // 2) create missing (Y4 Crimson)
    for (const n of missing) {
        const p = parse(n);
        const { data: cr, error } = await supabase.from('classes')
            .insert({ school_id: schoolId, name: n, year_level: p.y }).select('id, name').single();
        if (error) { console.log(`  FAIL create ${n}: ${error.message}`); process.exit(1); }
        byName.set(n, cr);
        console.log(`  OK created ${n} (${cr.id})`);
    }

    // 3) assign main teachers per CSV; also clear Y3 Red / Y4 Green (no teacher)
    const assignments = { ...TEACHERS, 'Year 3 - Red': null, 'Year 4 - Green': null };
    for (const [cls, userId] of Object.entries(assignments)) {
        const c = byName.get(cls);
        if (!c) { console.log(`  SKIP (no class) ${cls}`); continue; }
        if (userId) {
            const { error } = await supabase.rpc('assign_class_staff', {
                p_class_id: c.id, p_user_id: userId, p_position: 'main',
                p_year_id: yearId, p_school_id: schoolId,
            });
            console.log(error ? `  FAIL ${cls}: ${error.message}` : `  OK ${cls} -> ${userId}`);
        } else {
            const { error } = await supabase.from('class_staff').delete()
                .eq('school_id', schoolId).eq('academic_year_id', yearId)
                .eq('class_id', c.id).eq('position', 'main');
            console.log(error ? `  FAIL clear ${cls}: ${error.message}` : `  OK cleared main for ${cls}`);
        }
    }

    // 4) verify final roster
    const { data: final } = await supabase.from('class_staff').select('position, class:classes(name), user:users(name)')
        .eq('school_id', schoolId).eq('academic_year_id', yearId).eq('position', 'main');
    console.log('\nFinal main-teacher roster:');
    (final || []).sort((a, b) => a.class.name.localeCompare(b.class.name))
        .forEach(s => console.log(`  ${s.class.name.padEnd(16)} -> ${s.user ? s.user.name : '(none)'}`));
    const y3 = (final || []).filter(s => s.class.name.startsWith('Year 3 ')).length;
    const y4 = (final || []).filter(s => s.class.name.startsWith('Year 4 ')).length;
    console.log(`\nCounts -> Year 3 classes staffed: ${y3}, Year 4 classes staffed: ${y4}`);
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
