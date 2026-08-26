#!/usr/bin/env node
/**
 * Provisions the 2026/27 academic year structure:
 *
 *   - 10 x Year 4 (Grade 3) classes
 *   -  4 x Year 3 (Grade 2) classes
 *   - capacity 30 per class (max-average class size)
 *
 * Staffing is NOT touched here: assign the 14 main teachers (and assistants
 * as they are hired) through the admin UI or backend/scripts/assign-staff.js.
 * Subject teachers for Amharic, English, French, Arts, PE and Music are
 * likewise assigned through the Assignments screen, since more than one
 * teacher per subject is expected. Extra subjects (History, Global Studies,
 * ...) can be added by an admin at any time via the Subjects screen.
 *
 * The script is re-runnable: existing rows are detected by their unique
 * names and left untouched.
 *
 *   cd backend
 *   npm run setup:year
 *
 * Override the class rosters or term dates without editing this file:
 *
 *   YEAR4_CLASSES="Blue,Green,Red,Yellow,Orange,Magenta,Violet,Lavender,Cyan,Maroon" \
 *   YEAR3_CLASSES="Coral,Teal,Amber,Indigo" \
 *   CLASS_CAPACITY=30 \
 *   ACADEMIC_YEAR="2026/2027" \
 *   TERM1_START=2026-09-01 TERM1_END=2026-11-17 \
 *   TERM2_START=2027-01-06 TERM2_END=2027-03-23 \
 *   TERM3_START=2027-04-07 TERM3_END=2027-06-22 \
 *   npm run setup:year
 */
require('../config/env');
const supabase = require('../config/supabase');

// ---------------------------------------------------------------------------
// Edit this block to match the school's final roster.
// ---------------------------------------------------------------------------

// Last year's 12 color-named Year 3 classes: Blue, Green, Red, Yellow,
// Orange, Magenta, Violet, Lavender, Cyan, Maroon, Crimson, Purple.
// Ten of them carry forward into Year 4 — adjust the list if the school
// merges or renames any sections.
const DEFAULT_YEAR4_CLASSES = [
    'Blue', 'Green', 'Red', 'Yellow', 'Orange',
    'Magenta', 'Violet', 'Lavender', 'Cyan', 'Maroon',
];

// Four new Year 3 sections. Replace these color names with whatever the
// school picks for the new intake.
const DEFAULT_YEAR3_CLASSES = ['Coral', 'Teal', 'Amber', 'Indigo'];

const DEFAULT_CAPACITY = 30; // max-average students per class

// Term dates default to the standard Ethiopian independent-school calendar;
// the admin can adjust them later in the UI, or pass exact dates via env.
const DEFAULT_TERMS = [
    { term_index: 1, name: 'Term 1', starts_on: '2026-09-01', ends_on: '2026-11-17' },
    { term_index: 2, name: 'Term 2', starts_on: '2027-01-06', ends_on: '2027-03-23' },
    { term_index: 3, name: 'Term 3', starts_on: '2027-04-07', ends_on: '2027-06-22' },
];

// ---------------------------------------------------------------------------

const parseList = (raw, fallback) =>
    raw
        ? raw.split(',').map((s) => s.trim()).filter(Boolean)
        : fallback;

const YEAR4_CLASSES = parseList(process.env.YEAR4_CLASSES, DEFAULT_YEAR4_CLASSES);
const YEAR3_CLASSES = parseList(process.env.YEAR3_CLASSES, DEFAULT_YEAR3_CLASSES);
const CAPACITY = parseInt(process.env.CLASS_CAPACITY, 10) || DEFAULT_CAPACITY;
const YEAR_NAME = process.env.ACADEMIC_YEAR || '2026/2027';

const TERMS = DEFAULT_TERMS.map((t) => ({
    ...t,
    starts_on: process.env[`TERM${t.term_index}_START`] || t.starts_on,
    ends_on: process.env[`TERM${t.term_index}_END`] || t.ends_on,
}));

async function main() {
    console.log(`\nProvisioning academic year ${YEAR_NAME}\n`);
    console.log(`  Year 4 classes: ${YEAR4_CLASSES.length} (${YEAR4_CLASSES.join(', ')})`);
    console.log(`  Year 3 classes: ${YEAR3_CLASSES.length} (${YEAR3_CLASSES.join(', ')})`);
    console.log(`  capacity:       ${CAPACITY} students per class\n`);

    // School — the seed script must have run first.
    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, name')
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) {
        console.error('No school found. Run `npm run seed` first.');
        process.exit(1);
    }

    // Academic year — reuse by name so the script is re-runnable.
    let { data: year, error: yearError } = await supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', school.id)
        .eq('name', YEAR_NAME)
        .maybeSingle();

    if (yearError) throw yearError;

    if (!year) {
        ({ data: year, error: yearError } = await supabase
            .from('academic_years')
            .insert({
                school_id: school.id,
                name: YEAR_NAME,
                starts_on: TERMS[0].starts_on,
                ends_on: TERMS[2].ends_on,
                is_current: true,
            })
            .select('id, name')
            .single());
        if (yearError) throw yearError;
        console.log(`  created year     ${year.name}`);
    } else {
        console.log(`  year exists      ${year.name}`);
    }

    // Terms — only insert whichever are missing.
    const { data: presentTerms, error: termLookupError } = await supabase
        .from('terms')
        .select('term_index')
        .eq('academic_year_id', year.id);

    if (termLookupError) throw termLookupError;

    const have = new Set((presentTerms || []).map((t) => t.term_index));
    const missing = TERMS.filter((t) => !have.has(t.term_index));

    if (missing.length > 0) {
        const { error: termError } = await supabase.from('terms').insert(
            missing.map((t) => ({
                ...t,
                school_id: school.id,
                academic_year_id: year.id,
            }))
        );
        if (termError) throw termError;
        console.log(`  created terms    ${missing.map((t) => t.name).join(', ')}`);

        // Point "current term" at whichever term contains today, else Term 1.
        const today = new Date().toISOString().slice(0, 10);
        const active = TERMS.find((t) => today >= t.starts_on && today <= t.ends_on) || TERMS[0];

        const { data: activeRow } = await supabase
            .from('terms')
            .select('id')
            .eq('academic_year_id', year.id)
            .eq('term_index', active.term_index)
            .maybeSingle();

        if (activeRow) {
            await supabase.rpc('set_current_term', {
                p_term_id: activeRow.id,
                p_school_id: school.id,
            });
            console.log(`  current term     ${active.name}`);
        }
    } else {
        console.log('  terms exist      nothing to add');
    }

    // Classes — 10 x Year 4 + 4 x Year 3, all capacity 30.
    const wanted = [
        ...YEAR4_CLASSES.map((color) => ({ name: `Year 4 - ${color}`, year_level: 4 })),
        ...YEAR3_CLASSES.map((color) => ({ name: `Year 3 - ${color}`, year_level: 3 })),
    ];

    const { data: presentClasses, error: classLookupError } = await supabase
        .from('classes')
        .select('id, name, capacity, year_level')
        .eq('school_id', school.id);

    if (classLookupError) throw classLookupError;

    const byName = new Map((presentClasses || []).map((c) => [c.name, c]));
    const toCreate = [];

    for (const cls of wanted) {
        const existing = byName.get(cls.name);
        if (!existing) {
            toCreate.push({
                school_id: school.id,
                name: cls.name,
                year_level: cls.year_level,
                capacity: CAPACITY,
            });
            continue;
        }
        // Keep the row, but fix capacity/year_level if they drifted.
        const patch = {};
        if (existing.capacity !== CAPACITY) patch.capacity = CAPACITY;
        if (existing.year_level !== cls.year_level) patch.year_level = cls.year_level;
        if (Object.keys(patch).length > 0) {
            const { error: patchError } = await supabase
                .from('classes')
                .update(patch)
                .eq('id', existing.id);
            if (patchError) throw patchError;
            console.log(`  updated class    ${cls.name} (${Object.keys(patch).join(', ')})`);
        } else {
            console.log(`  class exists     ${cls.name}`);
        }
    }

    if (toCreate.length > 0) {
        const { error: createError } = await supabase.from('classes').insert(toCreate);
        if (createError) throw createError;
        console.log(`  created classes  ${toCreate.map((c) => c.name).join(', ')}`);
    }

    // Summary.
    const { data: finalClasses, error: finalError } = await supabase
        .from('classes')
        .select('name, year_level, capacity')
        .eq('school_id', school.id)
        .order('year_level', { ascending: false })
        .order('name');

    if (finalError) throw finalError;

    const y4 = finalClasses.filter((c) => c.year_level === 4);
    const y3 = finalClasses.filter((c) => c.year_level === 3);

    console.log(`\nDone. ${finalClasses.length} classes in the school:`);
    console.log(`  Year 4: ${y4.length} classes — ${y4.map((c) => c.name).join(', ')}`);
    console.log(`  Year 3: ${y3.length} classes — ${y3.map((c) => c.name).join(', ')}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Assign a main teacher to each class (admin UI → Classes, or scripts/assign-staff.js).`);
    console.log(`  2. Add assistants to classes as they are hired.`);
    console.log(`  3. Assign subject teachers across classes (Assignments → Subject teaching).`);
    console.log(`  4. Auto-assign main-teacher subjects (Maths & Science) to every staffed class.\n`);
}

main().catch((err) => {
    console.error('\nSetup failed:', err.message || err);
    process.exit(1);
});
