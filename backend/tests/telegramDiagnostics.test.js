/**
 * Diagnosing "linked, but sign-in says not linked".
 *
 * Covers the three additions that turn that support loop into one request:
 *   · the deployment fingerprint stamped into the 401 and the bot's reply
 *   · the admin diagnostics endpoint (webhook / database / deployment checks)
 *   · the write order in consumeLinkToken, so a failed bind never burns a link
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { reset, rowsOf, db, missingTableError } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const { handleUpdate } = require('../services/telegramBot');
const { consumeLinkToken, createLinkToken, hashLinkToken, resetReadinessCache } = require('../services/telegramLink');
const { resetWebhookCache } = require('../controllers/telegramDiagnostics.controller');
const deployment = require('../utils/deployment');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';
const TEACHER = '5be2c1a4-9f0d-4c1b-8a6e-2d3f4a5b6c7d';
const TG_ID = '700100200';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SAVED_ENV = {
    host: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    sha: process.env.VERCEL_GIT_COMMIT_SHA,
    vercelEnv: process.env.VERCEL_ENV,
};

const user = (overrides = {}) => ({
    id: ADMIN, school_id: SCHOOL, name: 'Test Admin', email: 'admin@school.et',
    password_hash: 'x', role: 'admin', is_active: true,
    telegram_id: null, telegram_username: null, ...overrides,
});

const seed = ({ users: overrides = [], tokens = [], errors = {}, overrides: opOverrides = {} } = {}) => {
    const base = [user(), user({ id: TEACHER, name: 'Teacher', email: 't@school.et', role: 'main_teacher' })];
    const byId = new Map(base.map((u) => [u.id, u]));
    overrides.forEach((u) => byId.set(u.id, { ...(byId.get(u.id) || {}), ...u }));
    reset({ users: [...byId.values()], telegram_link_tokens: tokens }, { errors, overrides: opOverrides });
};

// Telegram Bot API is captured, never called.
const realFetch = global.fetch;
let telegram = [];
let botApi = {};

beforeEach(() => {
    telegram = [];
    botApi = {};
    resetWebhookCache();
    resetReadinessCache();
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'final-bis.vercel.app';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc1234def';
    process.env.VERCEL_ENV = 'production';

    global.fetch = async (url, init) => {
        const method = String(url).split('/').pop();
        if (String(url).startsWith('https://api.telegram.org/')) {
            telegram.push({ method, body: init?.body ? JSON.parse(init.body) : {} });
            const handler = botApi[method];
            const payload = handler ? handler() : { ok: true, result: method === 'getMe' ? { id: 999, username: 'bis_noc_test_bot' } : true };
            return { json: async () => payload };
        }
        return realFetch(url, init);
    };
});

afterEach(() => {
    global.fetch = realFetch;
    const restore = (key, value) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    };
    restore('VERCEL_PROJECT_PRODUCTION_URL', SAVED_ENV.host);
    restore('VERCEL_GIT_COMMIT_SHA', SAVED_ENV.sha);
    restore('VERCEL_ENV', SAVED_ENV.vercelEnv);
});

const admin = () => signToken({ id: ADMIN, role: 'admin' });
const teacher = () => signToken({ id: TEACHER, role: 'main_teacher' });

/** Mini App payload signed the way Telegram signs it. */
const signedInitData = (id = TG_ID) => {
    const payload = {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: Number(id), first_name: 'Test', username: 'test_staff' }),
    };
    const check = Object.entries(payload).map(([k, v]) => `${k}=${v}`).sort().join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
    return new URLSearchParams({ ...payload, hash }).toString();
};

/* ── deployment fingerprint ─────────────────────────────────────────────── */

describe('deployment fingerprint', () => {
    test('reports host, commit, environment and a masked database reference', () => {
        const info = deployment.deploymentInfo();

        assert.equal(info.host, 'final-bis.vercel.app');
        assert.equal(info.commit, 'abc1234');
        assert.equal(info.environment, 'test');
        assert.equal(info.preview, false);
        assert.match(info.database, /^[a-z0-9]{4,6}…$/i, 'masked, never the full project ref');
        assert.ok(!info.database.includes('supabase'), 'the full host never leaks into the ref');
    });

    test('never contains a secret', () => {
        const serialised = JSON.stringify(deployment.deploymentInfo());
        assert.ok(!serialised.includes(BOT_TOKEN));
        assert.ok(!serialised.includes(process.env.SUPABASE_SERVICE_KEY));
        assert.ok(!serialised.includes(process.env.JWT_SECRET));
    });

    test('flags preview and ephemeral hosts', () => {
        const prod = 'final-bis.vercel.app';
        assert.equal(deployment.isPreviewHost(prod, { productionHost: prod }), false);
        assert.equal(deployment.isPreviewHost('final-bis-git-main-x.vercel.app', { productionHost: prod }), true);
        assert.equal(deployment.isPreviewHost('abc.e2b.app'), true);
        assert.equal(deployment.isPreviewHost('localhost:3000'), true);
        assert.equal(deployment.isPreviewHost(prod, { vercelEnv: 'preview', productionHost: prod }), true);
    });

    test('masks short inputs without revealing them', () => {
        assert.equal(deployment.maskRef('abcdef'), 'abcd…');
        assert.equal(deployment.maskRef('abc'), '…');
        assert.equal(deployment.maskRef(''), null);
    });
});

describe('the "not linked" 401 carries the fingerprint', () => {
    test('details + message name this deployment, so it can be compared with the bot', async () => {
        seed();

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: signedInitData() });

        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'TELEGRAM_NOT_LINKED');
        assert.equal(res.body.details.deployment.host, 'final-bis.vercel.app');
        assert.equal(res.body.details.deployment.commit, 'abc1234');
        assert.match(res.body.message, /final-bis\.vercel\.app@abc1234/);
        assert.match(res.body.message, /database [a-z0-9]{4,6}…/i);

        // Still no internals, still no token.
        assert.ok(!JSON.stringify(res.body).includes(BOT_TOKEN));
    });

    test("the bot's confirmation names the same fingerprint", async () => {
        seed();
        const minted = await request(app)
            .post('/api/auth/telegram-link')
            .auth(signToken({ id: ADMIN, role: 'admin' }));

        telegram = [];
        await handleUpdate({
            message: {
                message_id: 1, chat: { id: TG_ID, type: 'private' },
                from: { id: TG_ID, username: 'test_staff' },
                text: `/start link_${minted.body.token}`,
            },
        });

        const linked = telegram.filter((m) => m.method === 'sendMessage')
            .map((m) => m.body.text).find((t) => /Linked/.test(t));

        assert.match(linked, /final-bis\.vercel\.app@abc1234/);
        assert.match(linked, /database [a-z0-9]{4,6}…/i);
        assert.match(linked, new RegExp(`id ${TG_ID}`));
    });
});

/* ── diagnostics endpoint ───────────────────────────────────────────────── */

describe('GET /api/auth/telegram-link/diagnostics', () => {
    test('is admin-only', async () => {
        seed();

        const anon = await request(app).get('/api/auth/telegram-link/diagnostics');
        assert.equal(anon.status, 401);

        const asTeacher = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(teacher());
        assert.equal(asTeacher.status, 403);
    });

    test('reports a healthy setup when the webhook points here', async () => {
        seed();
        botApi.getWebhookInfo = () => ({
            ok: true,
            result: {
                url: 'https://final-bis.vercel.app/api/telegram/webhook',
                pending_update_count: 0,
                max_connections: 40,
            },
        });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true, 'a missing webhook secret is a warning, not a blocker');
        assert.ok(res.body.warnings.includes('webhook_secret'));
        assert.deepEqual(res.body.blockers, []);
        assert.equal(res.body.webhook.pointsHere, true);
        assert.equal(res.body.webhook.preview, false);
        assert.equal(res.body.database.linkTableReady, true);
        assert.equal(res.body.deployment.host, 'final-bis.vercel.app');
        // With no hardening warnings left, the hint says so.
        assert.match(res.body.hint, /TELEGRAM_WEBHOOK_SECRET|Everything checks out/);
    });

    test('spots the classic failure: webhook registered on a preview URL', async () => {
        seed();
        botApi.getWebhookInfo = () => ({
            ok: true,
            result: {
                url: 'https://final-bis-git-main-team.vercel.app/api/telegram/webhook',
                pending_update_count: 3,
                last_error_message: 'Wrong response from the webhook: 401 Unauthorized',
                last_error_date: Math.floor(Date.now() / 1000) - 60,
            },
        });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        assert.equal(res.body.ok, false);
        assert.equal(res.body.webhook.pointsHere, false);
        assert.equal(res.body.webhook.preview, true);
        assert.equal(res.body.webhook.pendingUpdates, 3);
        assert.match(res.body.webhook.lastErrorMessage, /401/);

        const failed = res.body.checks.filter((c) => c.ok === false).map((c) => c.id);
        assert.ok(failed.includes('webhook_points_here'));
        assert.ok(failed.includes('webhook_not_preview'));
        // The hint tells the admin exactly what to run next.
        assert.match(res.body.hint, /set-telegram-webhook\.js/);
    });

    test('reports a missing linking table and a missing webhook', async () => {
        seed({ errors: { telegram_link_tokens: missingTableError('telegram_link_tokens') } });
        botApi.getWebhookInfo = () => ({ ok: true, result: { url: '' } });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        assert.equal(res.body.ok, false);
        assert.equal(res.body.database.linkTableReady, false);
        assert.equal(res.body.webhook.configured, false);

        const failed = res.body.checks.filter((c) => c.ok === false).map((c) => c.id);
        assert.ok(failed.includes('link_table'));
        assert.ok(failed.includes('webhook_set'));
    });

    test('shows what this deployment sees for the caller, without leaking others', async () => {
        const tokenHash = hashLinkToken(crypto.randomBytes(32).toString('base64url'));
        seed({
            tokens: [
                { id: 't1', user_id: ADMIN, token_hash: tokenHash, created_at: '2026-10-22T09:00:00Z', used_at: '2026-10-22T09:01:00Z' },
                { id: 't2', user_id: TEACHER, token_hash: hashLinkToken('x'.repeat(43)), created_at: '2026-10-22T08:00:00Z', used_at: null },
            ],
        });
        botApi.getWebhookInfo = () => ({ ok: true, result: { url: 'https://final-bis.vercel.app/api/telegram/webhook' } });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        assert.equal(res.body.database.myTokens.total, 1, 'only the caller own tokens');
        assert.equal(res.body.database.myTokens.unused, 0);
        assert.equal(res.body.database.myTokens.lastUsedAt, '2026-10-22T09:01:00Z');
        assert.ok(!JSON.stringify(res.body).includes(tokenHash), 'never returns a token hash');
    });

    test('counts the linked staff in this database', async () => {
        seed({ users: [{ id: TEACHER, telegram_id: TG_ID }] });
        botApi.getWebhookInfo = () => ({ ok: true, result: { url: 'https://final-bis.vercel.app/api/telegram/webhook' } });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        assert.equal(res.body.database.telegramIdsLinked, 1);
    });

    test('never returns the bot token or service key', async () => {
        seed();
        botApi.getWebhookInfo = () => ({ ok: true, result: { url: 'https://final-bis.vercel.app/api/telegram/webhook' } });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        const serialised = JSON.stringify(res.body);
        assert.ok(!serialised.includes(BOT_TOKEN));
        assert.ok(!serialised.includes(process.env.SUPABASE_SERVICE_KEY));
        assert.ok(!serialised.includes(process.env.JWT_SECRET));
        assert.equal(res.body.bot.id, 999, 'the public bot id is fine to report');
    });

    test('survives Telegram being unreachable', async () => {
        seed();
        botApi.getWebhookInfo = () => ({ ok: false, description: 'Unauthorized' });

        const res = await request(app)
            .get('/api/auth/telegram-link/diagnostics')
            .auth(admin());

        assert.equal(res.status, 200);
        assert.equal(res.body.webhook.configured, false);
        assert.equal(res.body.ok, false);
    });
});

/* ── write order: a failed bind never burns the link ───────────────────── */

describe('consumeLinkToken write order', () => {
    const mintFor = async (userId = ADMIN) => {
        const result = await createLinkToken({ userId });
        assert.equal(result.ok, true);
        return result.token;
    };

    test('a failed bind leaves the link usable', async () => {
        seed({ errors: { users: ({ mode }) => (mode === 'update' ? { code: 'XX000', message: 'write failed' } : null) } });
        const token = await mintFor();

        const result = await consumeLinkToken({ token, telegramId: TG_ID });

        assert.equal(result.ok, false);
        assert.equal(result.code, 'error');
        assert.equal(rowsOf('telegram_link_tokens')[0].used_at, undefined, 'the token is NOT burnt');

        // ... so the same link works once the database recovers.
        delete db.errors.users;
        const retry = await consumeLinkToken({ token, telegramId: TG_ID });
        assert.equal(retry.ok, true);
        assert.equal(rowsOf('telegram_link_tokens')[0].used_at !== undefined, true);
    });

    test('a unique clash reports "already linked elsewhere" and keeps the link usable', async () => {
        seed({ errors: { users: ({ mode }) => (mode === 'update' ? { code: '23505', message: 'duplicate key' } : null) } });
        const token = await mintFor();

        const result = await consumeLinkToken({ token, telegramId: TG_ID });

        assert.equal(result.code, 'telegram_already_linked');
        assert.equal(rowsOf('telegram_link_tokens')[0].used_at, undefined);
    });

    test('if the claim is lost after binding, the binding is released', async () => {
        seed({
            // The user bind succeeds; the token claim matches no rows (a race).
            overrides: { 'telegram_link_tokens:update': () => ({ data: null, error: null }) },
        });
        const token = await mintFor();

        const result = await consumeLinkToken({ token, telegramId: TG_ID });

        assert.equal(result.ok, false);
        assert.equal(result.code, 'expired');
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null,
            'no account is left bound to an unconsumed token');
        assert.equal(rowsOf('telegram_link_tokens')[0].used_at, undefined);
    });

    test('the happy path binds and burns exactly once', async () => {
        seed();
        const token = await mintFor();

        const first = await consumeLinkToken({ token, telegramId: TG_ID, username: 'test_staff' });
        assert.equal(first.ok, true);
        assert.equal(String(first.user.telegram_id), TG_ID);
        assert.equal(first.user.telegram_username, 'test_staff');

        const replay = await consumeLinkToken({ token, telegramId: TG_ID });
        assert.equal(replay.code, 'used', 'a replay is refused');
    });

    test('the bot explains a failed save instead of staying silent', async () => {
        seed({ errors: { users: ({ mode }) => (mode === 'update' ? { code: 'XX000', message: 'write failed' } : null) } });
        const minted = await request(app).post('/api/auth/telegram-link').auth(admin());

        telegram = [];
        await handleUpdate({
            message: {
                message_id: 1, chat: { id: TG_ID, type: 'private' },
                from: { id: TG_ID, username: 'test_staff' },
                text: `/start link_${minted.body.token}`,
            },
        });

        const said = telegram.filter((m) => m.method === 'sendMessage').map((m) => m.body.text).join('\n');
        assert.match(said, /Something went wrong saving the link/);
        assert.match(said, /nothing was changed/);
    });
});
