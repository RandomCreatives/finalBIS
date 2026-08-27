require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

// classId -> userId (main teacher). Year 3 Red and Year 4 Green are SKIPPED (CSV: no teacher).
const ASSIGNMENTS = [
    ['b299b6a3-bb54-47b8-a14d-3c3966fcc321', 'a42e544f-810c-46da-bc9d-f62a8babb26b'], // Y3 Blue  - Yeabsira Amdie Kidanewold
    ['a1637b49-f338-4a72-8aa9-3ee82b086fd0', '8386d3d6-9507-4e4f-a748-b04a1ce87080'], // Y3 Yellow - Meron Abebe Tarekegn
    ['8898953f-eaef-4a25-b5ce-a1da79eba2bd', '635483b5-d749-4c5c-a94c-f2c1f888fd2e'], // Y3 Green - Degnet Engida Addis
    ['1e4e1726-90cf-4d0b-90c0-ae492359f668', 'f83d00d4-52cc-49d0-9b9f-f6ccf9f374a4'], // Y4 Blue  - Mulugeta Jemberu Dargie
    ['c5f2ec28-cb24-401e-bcda-d47769f8a77d', '7e28f5b0-9546-44d0-8dd6-457c086a650c'], // Y4 Purple - Mekdelawit Abate Nebebe
    ['6392a68b-ed5d-4581-91b8-22d679dbd5b9', '91e4c527-cfa1-43bf-91e7-0480b9de61c6'], // Y4 Lavender - Selam Goyte Abza
    ['ffd464c8-e56b-435d-8fed-bd20c7807757', 'a551f7ef-2b67-46df-b10d-ef868f8cceee'], // Y4 Crimson - Simegn Yilma Akalu
    ['c2376e4c-12fb-4ff3-83c9-80945ca3f857', 'de15baf5-55d1-4bd7-b585-4e6997857c7d'], // Y4 Yellow - Mariamawit Belay Nadew
    ['938efd5f-c75a-45e2-bcb5-c08dd0252cd1', 'b49699f4-da75-484e-aae1-bc56a72ba52c'], // Y4 Magenta - Abigia Alemayehu Dogamo
    ['b4b0a3bf-550e-4884-aafd-09e744b3ddf5', 'e636e2ae-d3c6-4f5d-8f4f-7f182c5d150f'], // Y4 Red - Denebe Abu Shuniye
    ['a5b883b5-733c-46d9-b2f4-bc028e73b9d5', '6a67c290-3baa-47ce-b9f4-a7122ab58895'], // Y4 Violet - Abigiya Tadele Biru
    ['6e2cfa4f-06f4-4bba-a883-c628ee7e9792', '684187a9-0369-4438-bcab-fe9a63a6bbcf'], // Y4 Orange - Mekdelawit Nigusu Alemu
];

async function main() {
    const { data: school } = await supabase.from('schools').select('id').limit(1).maybeSingle();
    const schoolId = school.id;
    const { data: year } = await supabase
        .from('academic_years').select('id, name').eq('school_id', schoolId).eq('is_current', true).maybeSingle();
    if (!year) throw new Error('No current academic year set');
    const yearId = year.id;
    console.log(`School ${schoolId} | Year: ${year.name} (${yearId})\n`);

    const classIds = ASSIGNMENTS.map(a => a[0]);
    const { data: classNames } = await supabase.from('classes').select('id, name').in('id', classIds);
    const nameById = new Map((classNames || []).map(c => [c.id, c.name]));

    for (const [classId, userId] of ASSIGNMENTS) {
        const className = nameById.get(classId) || classId;
        // Current main holder (for reporting)
        const { data: prev } = await supabase
            .from('class_staff').select('user:users(name)').eq('school_id', schoolId)
            .eq('academic_year_id', yearId).eq('class_id', classId).eq('position', 'main').maybeSingle();
        const prevName = prev?.user?.name || '(none)';

        const { data, error } = await supabase.rpc('assign_class_staff', {
            p_class_id: classId,
            p_user_id: userId,
            p_position: 'main',
            p_year_id: yearId,
            p_school_id: schoolId,
        });

        if (error) {
            console.log(`  FAIL  ${className}: ${error.message}`);
            continue;
        }
        const { data: now } = await supabase
            .from('class_staff').select('user:users(name)').eq('school_id', schoolId)
            .eq('academic_year_id', yearId).eq('class_id', classId).eq('position', 'main').maybeSingle();
        console.log(`  OK    ${className}: ${prevName} -> ${now?.user?.name || userId}`);
    }
    console.log('\nDone.');
}

main().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
