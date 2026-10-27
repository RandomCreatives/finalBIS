const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123456:TEST_TOKEN_FOR_SUITES';

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const {
    BASIC_PASSWORD_HASH,
    PLACEHOLDER_EMAIL,
    TARGET_NAME,
    TARGET_EMAIL,
    ensureFrenchTeacher2Michael,
    ensureFrenchTeacher2MichaelOnce,
    resetFrenchTeacher2EnsureCache,
} = require('../services/frenchTeacher2Michael');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_Y3B = '11111111-1111-4111-8111-000000000001';
const CLASS_Y4M = '11111111-1111-4111-8111-000000000002';
const SUBJ_FRA = '22222222-2222-4222-8222-000000000001';
const SUBJ_ENG = '22222222-2222-4222-8222-000000000002';

const FRENCH_2_ID = '33333333-3333-4333-8333-000000000002';
const THOMAS_ID = '33333333-3333-4333-8333-000000000001';
const ENG_MIKE_ID = '33333333-3333-4333-8333-000000000003';

const seedTables = ({ extraUsers = [] } = {}) => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_Y3B, school_id: SCHOOL, name: 'Year 3 - Blue', year_level: 3 },
        { id: CLASS_Y4M, school_id: SCHOOL, name: 'Year 4 - Magenta', year_level: 4 },
    ],
    subjects: [
        { id: SUBJ_FRA, school_id: SCHOOL, name: 'French', code: 'FRA', taught_by: 'subject_teacher' },
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'subject_teacher' },
    ],
    users: [
        {
            id: THOMAS_ID,
            school_id: SCHOOL,
            name: 'Thomas Asmelash Gebray',
            email: 'thomas.asmelash@bisnoc.local',
            password_hash: BASIC_PASSWORD_HASH,
            role: 'subject_teacher',
            is_active: true,
        },
        {
            id: FRENCH_2_ID,
            school_id: SCHOOL,
            name: 'French Teacher 2',
            email: PLACEHOLDER_EMAIL,
            password_hash: BASIC_PASSWORD_HASH,
            role: 'subject_teacher',
            is_active: true,
            telegram_id: 777888999,
        },
        {
            id: ENG_MIKE_ID,
            school_id: SCHOOL,
            name: 'Michael Okwara Okwara',
            email: 'michael.okwara@bisnoc.local',
            password_hash: BASIC_PASSWORD_HASH,
            role: 'subject_teacher',
            is_active: true,
        },
        ...extraUsers,
    ],
    class_subjects: [
        { id: 'cs-fra-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_Y3B, subject_id: SUBJ_FRA, teacher_id: FRENCH_2_ID, sessions_per_week: 2 },
        { id: 'cs-fra-2', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_Y4M, subject_id: SUBJ_FRA, teacher_id: FRENCH_2_ID, sessions_per_week: 2 },
        { id: 'cs-eng-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_Y4M, subject_id: SUBJ_ENG, teacher_id: ENG_MIKE_ID, sessions_per_week: 4 },
    ],
    timetable_slots: [
        { id: 'ts-fra-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_Y4M, class_subject_id: 'cs-fra-2', teacher_id: FRENCH_2_ID, day_of_week: 2, starts_at: '11:30:00', ends_at: '12:20:00' },
    ],
});

const realFetch = global.fetch;

describe('French, Teacher 2 -> Mr. Michael reconciliation', () => {
    beforeEach(() => {
        resetFrenchTeacher2EnsureCache();
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    test('renames French Teacher 2 in place to Mr. Michael while preserving UUID, seats, and Michael Okwara Okwara', async () => {
        reset(seedTables());

        const res = await ensureFrenchTeacher2Michael({ client: supabaseStub });
        assert.equal(res.status, 'applied');
        assert.equal(res.action, 'renamed_in_place');
        assert.equal(res.user.id, FRENCH_2_ID);
        assert.equal(res.user.name, TARGET_NAME);
        assert.equal(res.user.email, TARGET_EMAIL);

        // English teacher Michael Okwara Okwara is untouched.
        const engMike = rowsOf('users').find((u) => u.id === ENG_MIKE_ID);
        assert.equal(engMike.name, 'Michael Okwara Okwara');

        // Subject-teacher directory now lists Mr. Michael under French (no "French Teacher 2").
        const dirRes = await request(app).get('/api/auth/subject-teachers');
        assert.equal(dirRes.status, 200);
        const names = dirRes.body.teachers.map((t) => t.name);
        assert.ok(names.includes('Mr. Michael'));
        assert.ok(!names.includes('French Teacher 2'));

        // Re-running is idempotent.
        const second = await ensureFrenchTeacher2Michael({ client: supabaseStub });
        assert.equal(second.status, 'already_applied');
    });

    test('ensureFrenchTeacher2MichaelOnce caches across calls', async () => {
        reset(seedTables());

        const first = await ensureFrenchTeacher2MichaelOnce({ client: supabaseStub });
        assert.equal(first.status, 'applied');

        const second = await ensureFrenchTeacher2MichaelOnce({ client: supabaseStub });
        assert.equal(second.status, 'cached');
    });

    test('hands over seats cleanly if a separate Mr. Michael account already existed', async () => {
        const separateId = '44444444-4444-4444-8444-000000000099';
        reset(
            seedTables({
                extraUsers: [
                    {
                        id: separateId,
                        school_id: SCHOOL,
                        name: 'Mr. Michael',
                        email: TARGET_EMAIL,
                        password_hash: BASIC_PASSWORD_HASH,
                        role: 'subject_teacher',
                        is_active: false,
                    },
                ],
            })
        );

        const res = await ensureFrenchTeacher2Michael({ client: supabaseStub });
        assert.equal(res.status, 'applied');
        assert.equal(res.action, 'merged_into_existing');
        assert.equal(res.seatsMoved, 2);

        const mrMichael = rowsOf('users').find((u) => u.id === separateId);
        const placeholder = rowsOf('users').find((u) => u.id === FRENCH_2_ID);
        assert.equal(mrMichael.is_active, true);
        assert.equal(placeholder.is_active, false);
        assert.ok(
            rowsOf('class_subjects')
                .filter((cs) => cs.subject_id === SUBJ_FRA)
                .every((cs) => cs.teacher_id === separateId)
        );
    });

    test('@bisnocbot greets Mr. Michael with full honorific + name ("Hello Mr. Michael")', async () => {
        reset(seedTables());
        await ensureFrenchTeacher2Michael({ client: supabaseStub });

        const sent = [];
        global.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.telegram.org/')) {
                sent.push(JSON.parse(init.body));
                return { json: async () => ({ ok: true, result: { message_id: 1 } }) };
            }
            return realFetch(url, init);
        };

        const hookRes = await request(app)
            .post('/api/telegram/webhook')
            .send({ message: { chat: { id: 777888999 }, text: '/start' } });

        assert.equal(hookRes.status, 200);
        assert.equal(sent.length, 1);
        assert.match(sent[0].text, /Hello Mr\. Michael!/);
    });
});
