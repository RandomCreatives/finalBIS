require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    const schoolId = school.id;
    const { data: year } = await supabase
        .from('academic_years').select('id, name').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
    const yearId = year.id;
    console.log(`School ${schoolId} | Year ${year.name} (${yearId})\n`);

    // 1) Undo wrong assignment: Year 3 - Purple had Yeabsira before our mistake.
    const y3PurpleId = 'c5f2ec28-cb24-401e-bcda-d47769f8a77d';
    const y3PurplePrev = 'a42e544f-810c-46da-bc9d-f62a8babb26b'; // Yeabsira Amdie Kidanewold
    const { error: e1 } = await supabase.rpc('assign_class_staff', {
        p_class_id: y3PurpleId, p_user_id: y3PurplePrev, p_position: 'main',
        p_year_id: yearId, p_school_id: schoolId,
    });
    console.log(e1 ? `  FAIL revert Y3 Purple: ${e1.message}` : `  OK   reverted Year 3 - Purple -> Yeabsira Amdie Kidanewold`);

    // 2) Create missing Year 4 - Purple class.
    const { data: existing } = await supabase
        .from('classes').select('id, name').eq('school_id', schoolId).eq('name', 'Year 4 - Purple').maybeSingle();
    let y4PurpleId;
    if (existing) {
        y4PurpleId = existing.id;
        console.log(`  OK   Year 4 - Purple already exists (${y4PurpleId})`);
    } else {
        const { data: created, error: e2 } = await supabase
            .from('classes').insert({ school_id: schoolId, name: 'Year 4 - Purple', year_level: 4 })
            .select('id, name').single();
        if (e2) { console.log(`  FAIL create class: ${e2.message}`); process.exit(1); }
        y4PurpleId = created.id;
        console.log(`  OK   created class ${created.name} (${created.id})`);
    }

    // 3) Assign Mekdelawit Abate Nebebe as main teacher for Year 4 - Purple.
    const y4PurpleTeacher = '7e28f5b0-9546-44d0-8dd6-457c086a650c';
    const { error: e3 } = await supabase.rpc('assign_class_staff', {
        p_class_id: y4PurpleId, p_user_id: y4PurpleTeacher, p_position: 'main',
        p_year_id: yearId, p_school_id: schoolId,
    });
    console.log(e3 ? `  FAIL staff Y4 Purple: ${e3.message}` : `  OK   Year 4 - Purple -> Mekdelawit Abate Nebebe`);

    // Verify final state of all Y3/Y4 mains
    const { data: staff } = await supabase
        .from('class_staff').select('position, class:classes(name), user:users(name)')
        .eq('school_id', schoolId).eq('academic_year_id', yearId).eq('position', 'main');
    console.log('\nFinal Year 3/4 main teachers:');
    (staff || [])
        .filter(s => /^Year [34] /.test(s.class?.name || ''))
        .sort((a, b) => a.class.name.localeCompare(b.class.name))
        .forEach(s => console.log(`  ${s.class.name.padEnd(16)} -> ${s.user?.name}`));
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
