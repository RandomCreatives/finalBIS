const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const bcrypt = require('bcryptjs');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const {
    BASIC_PASSWORD_HASH,
    ensureMagentaMainTeacher,
    ensureMagentaMainTeacherOnce,
    resetMagentaEnsureCache,
} = require('../services/magentaMainTeacher');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const MAGENTA = '938efd5f-c75a-45e2-bcb5-c08dd0252cd1';
const VIOLET = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';

const SUBJ_MAT = '11111111-1111-4111-8111-111111111111';
const SUBJ_SCI = '22222222-2222-4222-8222-222222222222';
const SUBJ_GLS = '33333333-3333-4333-8333-333333333333';
const SUBJ_REG = '44444444-4444-4444-8444-444444444444';
const SUBJ_ENG = '55555555-5555-4555-8555-555555555555';

const mkUser = (id, role, name, extra = {}) => ({
    id,
    school_id: SCHOOL,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@bisnoc.local`,
    password_hash: '$2a$12$x',
    role,
    is_active: true,
    ...extra,
});

const ADMIN = mkUser('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'School Admin');
const ABIGIA = mkUser('b49699f4-da75-484e-aae1-bc56a72ba52c', 'main_teacher', 'Abigia Alemayehu Dogamo');
const ENG_TEACHER = mkUser('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Michael Okwara');
const EXISTING_BETHELHEM_ID = '82e61fbc-9942-415c-909c-f408360a2ef4';

const tokenFor = (u) => signToken(u);

const baseTables = ({ users = [ADMIN, ABIGIA, ENG_TEACHER] } = {}) => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: MAGENTA, school_id: SCHOOL, name: 'Year 4 - Magenta', year_level: 4, capacity: 30 },
        { id: VIOLET, school_id: SCHOOL, name: 'Year 4 - Violet', year_level: 4, capacity: 30 },
    ],
    users: users.map((u) => ({ ...u })),
    subjects: [
        { id: SUBJ_MAT, school_id: SCHOOL, name: 'Mathematics', code: 'MAT', taught_by: 'main_teacher' },
        { id: SUBJ_SCI, school_id: SCHOOL, name: 'Science', code: 'SCI', taught_by: 'main_teacher' },
        { id: SUBJ_GLS, school_id: SCHOOL, name: 'Global Citizenship', code: 'GLS', taught_by: 'main_teacher' },
        { id: SUBJ_REG, school_id: SCHOOL, name: 'Registration', code: 'REG', taught_by: 'main_teacher' },
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'subject_teacher' },
    ],
    class_staff: [
        { id: 'cs-mag-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, user_id: ABIGIA.id, position: 'main' },
    ],
    class_subjects: [
        { id: 'seat-mat', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, subject_id: SUBJ_MAT, teacher_id: ABIGIA.id, sessions_per_week: 6 },
        { id: 'seat-sci', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, subject_id: SUBJ_SCI, teacher_id: ABIGIA.id, sessions_per_week: 3 },
        { id: 'seat-gls', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, subject_id: SUBJ_GLS, teacher_id: ABIGIA.id, sessions_per_week: 3 },
        { id: 'seat-reg', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, subject_id: SUBJ_REG, teacher_id: null, sessions_per_week: 5 },
        { id: 'seat-eng', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, subject_id: SUBJ_ENG, teacher_id: ENG_TEACHER.id, sessions_per_week: 5 },
    ],
    timetable_slots: [
        { id: 'tt-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, class_subject_id: 'seat-mat', teacher_id: ABIGIA.id, day_of_week: 1, starts_at: '08:30:00', ends_at: '09:10:00' },
        { id: 'tt-2', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, class_subject_id: 'seat-sci', teacher_id: ABIGIA.id, day_of_week: 1, starts_at: '09:10:00', ends_at: '09:50:00' },
        { id: 'tt-3', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, class_subject_id: 'seat-eng', teacher_id: ENG_TEACHER.id, day_of_week: 1, starts_at: '09:50:00', ends_at: '10:30:00' },
    ],
});

beforeEach(() => {
    reset(baseTables());
    supabaseStub._rpc = {};
    resetMagentaEnsureCache();
});

describe('ensureMagentaMainTeacher — Ms. Bethelhem Girma account + Year 4 - Magenta staffing', () => {
    test('creates an active main_teacher account, assigns Year 4 - Magenta, and enables both sign-in paths', async () => {
        const result = await ensureMagentaMainTeacher();

        assert.equal(result.status, 'applied');
        assert.equal(result.accountAction, 'created');
        assert.equal(result.homeroomChanged, true);
        assert.equal(result.previousMainTeacher, ABIGIA.name);
        assert.equal(result.user.name, 'Bethelhem Girma');
        assert.equal(result.user.email, 'bethelhem.girma@bisnoc.local');
        assert.equal(result.user.role, 'main_teacher');
        assert.equal(result.user.isActive, true);
        assert.equal(result.seatsTransferred, 4, 'MAT, SCI, GLS and unassigned REG move');
        assert.equal(result.lessonsPlaced, 2);

        // Subject-teacher English seat and outgoing teacher account stay untouched.
        const engSeat = rowsOf('class_subjects').find((s) => s.id === 'seat-eng');
        assert.equal(engSeat.teacher_id, ENG_TEACHER.id);
        const abigia = rowsOf('users').find((u) => u.id === ABIGIA.id);
        assert.equal(abigia.is_active, true);

        // Placed timetable slots for MAT and SCI now belong to Bethelhem.
        const matSlot = rowsOf('timetable_slots').find((t) => t.id === 'tt-1');
        assert.equal(matSlot.teacher_id, result.user.id);

        // 1) Staff email + password sign-in works immediately with 'year 4 magenta'.
        const emailLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'bethelhem.girma@bisnoc.local', password: 'year 4 magenta' });
        assert.equal(emailLogin.status, 200);
        assert.equal(emailLogin.body.user.name, 'Bethelhem Girma');
        assert.equal(emailLogin.body.user.isActive, true);

        // 2) Class-card sign-in works immediately and signs in as Bethelhem Girma.
        const cardLogin = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 4 - Magenta', password: 'year 4 magenta' });
        assert.equal(cardLogin.status, 200);
        assert.equal(cardLogin.body.user.name, 'Bethelhem Girma');

        // 3) PWA password-only sign-in works immediately too.
        const pwaLogin = await request(app)
            .post('/api/auth/class-password-login')
            .send({ password: 'year 4 magenta' });
        assert.equal(pwaLogin.status, 200);
        assert.equal(pwaLogin.body.user.name, 'Bethelhem Girma');
    });

    test('syncs all seated main teachers to their class card passwords on rollout, preserves admin passwords, and respects later custom passwords on cold restarts', async () => {
        const BLUE = '3a111111-2222-4333-8444-555555555555';
        const INDIGO = '4b111111-2222-4333-8444-555555555555';
        const blueTeacher = mkUser('10000000-0000-4000-8000-000000000001', 'main_teacher', 'Hanna Tesfaye', {
            email: 'hanna.tesfaye@bisnoc.local',
            password_hash: '$2a$12$randomSeededHashFromMigration009xxxxxxxxxxxxxxxxxxxxx',
        });
        const violetTeacher = mkUser('10000000-0000-4000-8000-000000000002', 'main_teacher', 'Selamawit Bekele', {
            email: 'selamawit.bekele@bisnoc.local',
            password_hash: BASIC_PASSWORD_HASH,
        });
        // Existing Bethelhem from PR #158 holding BASIC_PASSWORD_HASH triggers the one-time rollout.
        const legacyBethelhem = mkUser(EXISTING_BETHELHEM_ID, 'main_teacher', 'Bethelhem Girma', {
            email: 'bethelhem.girma@bisnoc.local',
            password_hash: BASIC_PASSWORD_HASH,
        });

        const tables = baseTables({
            users: [ADMIN, ABIGIA, ENG_TEACHER, blueTeacher, violetTeacher, legacyBethelhem],
        });
        tables.classes.push(
            { id: BLUE, school_id: SCHOOL, name: 'Year 3 - Blue', year_level: 3, capacity: 30 },
            { id: INDIGO, school_id: SCHOOL, name: 'Year 3 - Indigo', year_level: 3, capacity: 30 }
        );
        tables.class_staff = [
            { id: 'cs-mag-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, user_id: EXISTING_BETHELHEM_ID, position: 'main' },
            { id: 'cs-blue-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: BLUE, user_id: blueTeacher.id, position: 'main' },
            { id: 'cs-vio-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: VIOLET, user_id: violetTeacher.id, position: 'main' },
            // Admin temporarily covering Indigo must never have their admin password overwritten.
            { id: 'cs-ind-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: INDIGO, user_id: ADMIN.id, position: 'main' },
        ];
        reset(tables);

        const firstRun = await ensureMagentaMainTeacher({ mode: 'auto' });
        assert.equal(firstRun.status, 'applied');
        assert.equal(firstRun.passwordsUpdated, 2, 'Blue + Violet synced (plus Bethelhem upgraded)');

        // Every seated main_teacher can now sign in via email with their class card password.
        for (const [email, password] of [
            ['bethelhem.girma@bisnoc.local', 'year 4 magenta'],
            ['hanna.tesfaye@bisnoc.local', 'year 3 blue'],
            ['selamawit.bekele@bisnoc.local', 'year 4 violet'],
        ]) {
            const loginRes = await request(app).post('/api/auth/login').send({ email, password });
            assert.equal(loginRes.status, 200, `${email} should sign in with "${password}"`);
        }

        // Admin password hash was NOT overwritten.
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN.id).password_hash, ADMIN.password_hash);

        // Now Hanna changes her personal password; a serverless cold start must NOT reset it.
        const customHash = await bcrypt.hash('MyPersonalSecret99', 4);
        rowsOf('users').find((u) => u.id === blueTeacher.id).password_hash = customHash;
        resetMagentaEnsureCache();

        const coldStartRun = await ensureMagentaMainTeacher({ mode: 'auto' });
        assert.equal(coldStartRun.status, 'already_applied');
        assert.equal(coldStartRun.passwordsUpdated, 0);
        assert.equal(rowsOf('users').find((u) => u.id === blueTeacher.id).password_hash, customHash);
    });

    test('activates a deactivated pre-existing account, promotes assistant_teacher, and removes duplicate assistant seat', async () => {
        const inactiveBethelhem = mkUser(
            EXISTING_BETHELHEM_ID,
            'assistant_teacher',
            'Ms. Bethelhem Girma',
            { is_active: false, email: 'bethelhem.girma@bisnoc.local' }
        );
        const tables = baseTables({ users: [ADMIN, ABIGIA, ENG_TEACHER, inactiveBethelhem] });
        tables.class_staff.push({
            id: 'cs-mag-asst',
            school_id: SCHOOL,
            academic_year_id: YEAR,
            class_id: MAGENTA,
            user_id: EXISTING_BETHELHEM_ID,
            position: 'assistant',
        });
        reset(tables);

        const result = await ensureMagentaMainTeacher();

        assert.equal(result.status, 'applied');
        assert.equal(result.accountAction, 'activated');
        assert.equal(result.user.id, EXISTING_BETHELHEM_ID);
        assert.equal(result.user.role, 'main_teacher');
        assert.equal(result.user.isActive, true);

        const magSeats = rowsOf('class_staff').filter((s) => s.class_id === MAGENTA);
        assert.equal(magSeats.length, 1, 'assistant seat cleared so unique(class, user, year) holds');
        assert.equal(magSeats[0].position, 'main');
        assert.equal(magSeats[0].user_id, EXISTING_BETHELHEM_ID);
    });

    test('activates her account even if she was already seated on Magenta while inactive', async () => {
        const seatedInactive = mkUser(
            EXISTING_BETHELHEM_ID,
            'main_teacher',
            'Bethelhem Girma',
            { is_active: false }
        );
        const tables = baseTables({ users: [ADMIN, ABIGIA, ENG_TEACHER, seatedInactive] });
        tables.class_staff = [
            { id: 'cs-mag-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, user_id: EXISTING_BETHELHEM_ID, position: 'main' },
        ];
        reset(tables);

        const result = await ensureMagentaMainTeacher();
        assert.equal(result.status, 'applied');
        assert.equal(result.accountAction, 'activated');
        assert.equal(result.user.isActive, true);

        // Re-running is now a clean no-op.
        const second = await ensureMagentaMainTeacher();
        assert.equal(second.status, 'already_applied');
    });

    test('ensureMagentaMainTeacherOnce caches after applying so subsequent calls cost zero queries', async () => {
        const first = await ensureMagentaMainTeacherOnce();
        assert.equal(first.status, 'applied');

        // Break the DB stub to prove the second call returns from cache without querying.
        reset({}, { errors: { schools: { code: 'XX000', message: 'boom' } } });
        const second = await ensureMagentaMainTeacherOnce();
        assert.equal(second.status, 'cached');
    });

    test('auto mode skips if Magenta was later reassigned to another teacher, while explicit admin endpoint applies', async () => {
        const cover = mkUser('99999999-9999-4999-8999-999999999999', 'main_teacher', 'Abeba Wendifraw Dinku');
        const tables = baseTables({ users: [ADMIN, ABIGIA, ENG_TEACHER, cover] });
        tables.class_staff = [
            { id: 'cs-mag-main', school_id: SCHOOL, academic_year_id: YEAR, class_id: MAGENTA, user_id: cover.id, position: 'main' },
        ];
        reset(tables);

        const autoRes = await ensureMagentaMainTeacher({ mode: 'auto' });
        assert.equal(autoRes.status, 'skipped');
        assert.equal(autoRes.reason, 'reassigned_to_other_teacher');

        // Non-admins cannot call the explicit endpoint.
        const forbidden = await request(app)
            .post('/api/assignments/magenta-bethelhem')
            .auth(tokenFor(cover));
        assert.equal(forbidden.status, 403);

        // Admin explicit call applies cleanly.
        const explicitRes = await request(app)
            .post('/api/assignments/magenta-bethelhem')
            .auth(tokenFor(ADMIN));
        assert.equal(explicitRes.status, 200);
        assert.equal(explicitRes.body.status, 'applied');
        assert.equal(explicitRes.body.user.name, 'Bethelhem Girma');
        assert.equal(explicitRes.body.user.isActive, true);
    });

    test('refuses without changing anything when she already leads another class or lessons clash', async () => {
        const bethelhem = mkUser(EXISTING_BETHELHEM_ID, 'main_teacher', 'Bethelhem Girma');
        const tables = baseTables({ users: [ADMIN, ABIGIA, ENG_TEACHER, bethelhem] });
        tables.class_staff.push({
            id: 'cs-vio-main',
            school_id: SCHOOL,
            academic_year_id: YEAR,
            class_id: VIOLET,
            user_id: EXISTING_BETHELHEM_ID,
            position: 'main',
        });
        reset(tables);

        await assert.rejects(
            () => ensureMagentaMainTeacher({ mode: 'explicit' }),
            /already the main teacher of Year 4 - Violet/
        );
        assert.equal(rowsOf('class_staff').find((s) => s.class_id === MAGENTA).user_id, ABIGIA.id);

        // Now test timetable clash (08:30 vs 08:30:00 normalization).
        const clashTables = baseTables({ users: [ADMIN, ABIGIA, ENG_TEACHER, bethelhem] });
        clashTables.timetable_slots.push({
            id: 'tt-clash',
            school_id: SCHOOL,
            academic_year_id: YEAR,
            class_id: VIOLET,
            class_subject_id: 'seat-vio-mat',
            teacher_id: EXISTING_BETHELHEM_ID,
            day_of_week: 1,
            starts_at: '08:30',
            ends_at: '09:10',
        });
        reset(clashTables);

        await assert.rejects(
            () => ensureMagentaMainTeacher({ mode: 'explicit' }),
            /already teaches 1 lesson/
        );
        assert.equal(rowsOf('class_staff').find((s) => s.class_id === MAGENTA).user_id, ABIGIA.id);
        assert.equal(rowsOf('class_subjects').find((s) => s.id === 'seat-mat').teacher_id, ABIGIA.id);
    });
});

describe('PUT /api/assignments/class-staff & POST /api/assignments/auto-assign-main', () => {
    test('assigning a main teacher via API hands over main_teacher subjects, timetable slots, and upgrades placeholder password to class card password', async () => {
        const bethelhem = mkUser(EXISTING_BETHELHEM_ID, 'main_teacher', 'Bethelhem Girma', {
            password_hash: BASIC_PASSWORD_HASH,
        });
        const tables = baseTables({ users: [ADMIN, ABIGIA, ENG_TEACHER, bethelhem] });
        reset(tables);

        supabaseStub._rpc.assign_class_staff = ({ p_class_id, p_user_id, p_position }) => {
            const seat = rowsOf('class_staff').find(
                (s) => s.class_id === p_class_id && s.position === p_position
            );
            if (seat) seat.user_id = p_user_id;
            return {
                data: { class_id: p_class_id, position: p_position, user: { id: p_user_id, name: bethelhem.name } },
                error: null,
            };
        };

        const res = await request(app)
            .put('/api/assignments/class-staff')
            .auth(tokenFor(ADMIN))
            .send({ classId: MAGENTA, userId: EXISTING_BETHELHEM_ID, position: 'main' });

        assert.equal(res.status, 200);
        assert.equal(res.body.seatsTransferred, 4);
        assert.equal(res.body.lessonsPlaced, 2);
        assert.equal(rowsOf('class_subjects').find((s) => s.id === 'seat-mat').teacher_id, EXISTING_BETHELHEM_ID);
        assert.equal(rowsOf('timetable_slots').find((t) => t.id === 'tt-1').teacher_id, EXISTING_BETHELHEM_ID);
        const updatedUser = rowsOf('users').find((u) => u.id === EXISTING_BETHELHEM_ID);
        assert.ok(bcrypt.compareSync('year 4 magenta', updatedUser.password_hash));
    });

    test('auto-assign-main preserves existing non-zero sessions_per_week when called with 0', async () => {
        const res = await request(app)
            .post('/api/assignments/auto-assign-main')
            .auth(tokenFor(ADMIN))
            .send({ sessionsPerWeek: 0 });

        assert.equal(res.status, 200);
        // The newly upserted rows carry preserved sessions (6, 3, 3) rather than 0.
        const matRows = rowsOf('class_subjects').filter((s) => s.subject_id === SUBJ_MAT);
        assert.ok(matRows.every((r) => r.sessions_per_week === 6));
    });
});
