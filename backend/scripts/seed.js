#!/usr/bin/env node
/**
 * Creates the school record and its first admin account.
 *
 * There is deliberately no public "register admin" endpoint — that was how
 * the old system let anyone mint themselves an administrator. Bootstrapping
 * is an operator task, run once from a trusted machine:
 *
 *   cd backend
 *   ADMIN_EMAIL=you@school.et ADMIN_PASSWORD='...' npm run seed
 */
const bcrypt = require('bcryptjs');
const readline = require('readline');
const env = require('../config/env');
const supabase = require('../config/supabase');

const SCHOOL_NAME = process.env.SCHOOL_NAME || 'British International School — NOC Gerji Campus';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ask = (question, { silent = false } = {}) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        if (silent) {
            // Suppress echo while a password is typed.
            rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
        }
        rl.question(question, (answer) => {
            rl.close();
            if (silent) process.stdout.write('\n');
            resolve(answer.trim());
        });
    });

async function main() {
    console.log(`\nSeeding "${SCHOOL_NAME}"\n`);

    const email = ADMIN_EMAIL || (await ask('Admin email: '));
    const password = ADMIN_PASSWORD || (await ask('Admin password (min 10 chars): ', { silent: true }));

    if (!email || !email.includes('@')) {
        console.error('A valid admin email is required.');
        process.exit(1);
    }
    if (!password || password.length < 10) {
        console.error('Admin password must be at least 10 characters.');
        process.exit(1);
    }

    // School — reuse if it already exists so the script is re-runnable.
    let { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('name', SCHOOL_NAME)
        .maybeSingle();

    if (schoolError) throw schoolError;

    if (!school) {
        ({ data: school, error: schoolError } = await supabase
            .from('schools')
            .insert({ name: SCHOOL_NAME })
            .select('id, name')
            .single());
        if (schoolError) throw schoolError;
        console.log(`  created school   ${school.name}`);
    } else {
        console.log(`  school exists    ${school.name}`);
    }

    // Academic year — staffing and subject assignments hang off this.
    const thisYear = new Date().getFullYear();
    const yearName = process.env.ACADEMIC_YEAR || `${thisYear}/${thisYear + 1}`;

    const { data: existingYear, error: yearLookupError } = await supabase
        .from('academic_years')
        .select('id, name')
        .eq('school_id', school.id)
        .eq('name', yearName)
        .maybeSingle();

    if (yearLookupError) throw yearLookupError;

    if (!existingYear) {
        const { error: yearError } = await supabase.from('academic_years').insert({
            school_id: school.id,
            name: yearName,
            starts_on: `${thisYear}-09-01`,
            ends_on: `${thisYear + 1}-07-31`,
            is_current: true,
        });
        if (yearError) throw yearError;
        console.log(`  created year     ${yearName}`);
    } else {
        console.log(`  year exists      ${existingYear.name}`);
    }

    // Three terms. Dates are a sensible default the admin can adjust; each
    // runs roughly 11 teaching weeks.
    const { data: yearRow, error: yearRowError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', school.id)
        .eq('name', yearName)
        .single();

    if (yearRowError) throw yearRowError;

    const TERMS = [
        { term_index: 1, name: 'Term 1', starts_on: `${thisYear}-09-01`, ends_on: `${thisYear}-11-17` },
        { term_index: 2, name: 'Term 2', starts_on: `${thisYear + 1}-01-06`, ends_on: `${thisYear + 1}-03-23` },
        { term_index: 3, name: 'Term 3', starts_on: `${thisYear + 1}-04-07`, ends_on: `${thisYear + 1}-06-22` },
    ];

    const { data: presentTerms, error: termLookupError } = await supabase
        .from('terms')
        .select('term_index')
        .eq('academic_year_id', yearRow.id);

    if (termLookupError) throw termLookupError;

    const haveTerms = new Set((presentTerms || []).map((t) => t.term_index));
    const missingTerms = TERMS.filter((t) => !haveTerms.has(t.term_index));

    if (missingTerms.length > 0) {
        const { error: termError } = await supabase.from('terms').insert(
            missingTerms.map((t) => ({
                ...t,
                school_id: school.id,
                academic_year_id: yearRow.id,
            }))
        );
        if (termError) throw termError;
        console.log(`  created terms    ${missingTerms.map((t) => t.name).join(', ')}`);

        // Make whichever term contains today current, else Term 1.
        const today = new Date().toISOString().slice(0, 10);
        const active = TERMS.find((t) => today >= t.starts_on && today <= t.ends_on) || TERMS[0];

        const { data: activeRow } = await supabase
            .from('terms')
            .select('id')
            .eq('academic_year_id', yearRow.id)
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

    // Subject catalogue, with the school's teaching policy baked in.
    // English, Amharic, Music, Arts, PE and French go to subject teachers;
    // Maths and Science are delivered by each class's own main teacher.
    const SUBJECTS = [
        { name: 'English', code: 'ENG', taught_by: 'subject_teacher' },
        { name: 'Amharic', code: 'AMH', taught_by: 'subject_teacher' },
        { name: 'Music', code: 'MUS', taught_by: 'subject_teacher' },
        { name: 'Arts', code: 'ART', taught_by: 'subject_teacher' },
        { name: 'Physical Education', code: 'PE', taught_by: 'subject_teacher' },
        { name: 'French', code: 'FRA', taught_by: 'subject_teacher' },
        { name: 'Mathematics', code: 'MAT', taught_by: 'main_teacher' },
        { name: 'Science', code: 'SCI', taught_by: 'main_teacher' },
    ];

    const { data: presentSubjects, error: subjectLookupError } = await supabase
        .from('subjects')
        .select('code')
        .eq('school_id', school.id);

    if (subjectLookupError) throw subjectLookupError;

    const have = new Set((presentSubjects || []).map((s) => s.code));
    const missing = SUBJECTS.filter((s) => !have.has(s.code));

    if (missing.length > 0) {
        const { error: subjectError } = await supabase
            .from('subjects')
            .insert(missing.map((s) => ({ ...s, school_id: school.id, is_semester: false })));
        if (subjectError) throw subjectError;
        console.log(`  created subjects ${missing.map((s) => s.name).join(', ')}`);
    } else {
        console.log('  subjects exist   nothing to add');
    }

    const { data: existing, error: userLookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (userLookupError) throw userLookupError;

    if (existing) {
        console.error(`\nA user with email ${email} already exists. Nothing to do.`);
        process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: admin, error: adminError } = await supabase
        .from('users')
        .insert({
            school_id: school.id,
            name: ADMIN_NAME,
            email,
            password_hash,
            role: 'admin',
        })
        .select('id, name, email, role')
        .single();

    if (adminError) throw adminError;

    console.log(`  created admin    ${admin.email}`);
    console.log(`\nDone. Sign in at the /login page with that address.\n`);
}

main().catch((err) => {
    console.error('\nSeed failed:', err.message || err);
    process.exit(1);
});
