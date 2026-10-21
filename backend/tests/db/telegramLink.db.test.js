/**
 * telegram_link_tokens — real PostgreSQL, real constraints.
 *
 * The API tests use the stubbed client; these run against the actual engine
 * (PGlite) to prove the guarantees one-time linking relies on: hashes only,
 * one outstanding link per staff account, single-use bookkeeping, cascade on
 * account deletion, and a migration that is safe to re-run.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { createTestDb, seedBaseline } = require('./harness');

let t;
let ids;

const hash = () => crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');

const insertToken = (userId, overrides = {}) => {
    const values = {
        user_id: userId,
        token_hash: hash(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 1000).toISOString(),
        used_at: null,
        telegram_id: null,
        ...overrides,
    };

    return t.query(
        `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at, created_at, used_at, telegram_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, token_hash`,
        [values.user_id, values.token_hash, values.expires_at, values.created_at, values.used_at, values.telegram_id]
    );
};

before(async () => {
    t = await createTestDb();
});

after(async () => {
    if (t) await t.close();
});

beforeEach(async () => {
    await t.query(`TRUNCATE schools RESTART IDENTITY CASCADE`);
    ids = await seedBaseline(t.query);
});

describe('telegram_link_tokens schema', () => {
    test('stores a token per staff account and cascades on account deletion', async () => {
        const { rows } = await insertToken(ids.mainTeacherId);
        assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);

        await t.query(`DELETE FROM users WHERE id = $1`, [ids.mainTeacherId]);

        const after = await t.query(`SELECT COUNT(*)::int AS n FROM telegram_link_tokens`);
        assert.equal(after.rows[0].n, 0, 'deleting the staff account removes its links');
    });

    test('refuses a duplicate token hash', async () => {
        const tokenHash = hash();
        await insertToken(ids.mainTeacherId, { token_hash: tokenHash });

        const error = await t.expectFailure(
            `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at, created_at)
             VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW())`,
            [ids.subjectTeacherId, tokenHash]
        );
        assert.ok(error, 'a replayed hash must not be insertable twice');
    });

    test('allows only one outstanding link per staff account', async () => {
        await insertToken(ids.mainTeacherId);

        const error = await t.expectFailure(
            `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at, created_at)
             VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW())`,
            [ids.mainTeacherId, hash()]
        );
        assert.ok(error, 'two live links for one account must be impossible');
    });

    test('a consumed link frees the account for a new one', async () => {
        await insertToken(ids.mainTeacherId, {
            used_at: new Date().toISOString(),
            telegram_id: '700100200',
        });

        const { rows } = await insertToken(ids.mainTeacherId);
        assert.ok(rows[0].id);

        const total = await t.query(`SELECT COUNT(*)::int AS n FROM telegram_link_tokens`);
        assert.equal(total.rows[0].n, 2, 'used rows are kept for audit');
    });

    test('users.telegram_id keeps its unique index', async () => {
        const { rows } = await t.query(
            `SELECT indexname FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'users'
               AND indexdef ILIKE '%(telegram_id)%'`
        );
        assert.ok(
            rows.some((r) => r.indexname === 'idx_users_telegram_id'),
            'the one-Telegram-account-to-one-login index must exist'
        );
    });

    test('one Telegram account maps to one staff login', async () => {
        await t.query(`UPDATE users SET telegram_id = 111 WHERE id = $1`, [ids.mainTeacherId]);

        const error = await t.expectFailure(
            `UPDATE users SET telegram_id = 111 WHERE id = $1`,
            [ids.subjectTeacherId]
        );
        assert.match(String(error), /duplicate key|unique/i);
    });

    test('rejects a token hash that is not a SHA-256 hex digest', async () => {
        const error = await t.expectFailure(
            `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at, created_at)
             VALUES ($1, 'plaintext-token', NOW() + INTERVAL '10 minutes', NOW())`,
            [ids.mainTeacherId]
        );
        assert.match(String(error), /telegram_link_tokens_hash_format|check/i);
    });

    test('rejects a token that is already expired when created', async () => {
        const error = await t.expectFailure(
            `INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at, created_at)
             VALUES ($1, $2, NOW() - INTERVAL '1 minute', NOW())`,
            [ids.mainTeacherId, hash()]
        );
        assert.match(String(error), /telegram_link_tokens_ttl|check/i);
    });

    test('row level security is forced on and no policies are granted', async () => {
        const { rows } = await t.query(
            `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
             WHERE relname = 'telegram_link_tokens'`
        );
        assert.deepEqual(rows[0], { relrowsecurity: true, relforcerowsecurity: true });

        const policies = await t.query(
            `SELECT COUNT(*)::int AS n FROM pg_policies WHERE tablename = 'telegram_link_tokens'`
        );
        assert.equal(policies.rows[0].n, 0);
    });

    test('the upgrade migration is safe to run on a database that already has the table', async () => {
        const migration = fs.readFileSync(
            path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '031_telegram_link_tokens.sql'),
            'utf8'
        );

        await t.db.exec(migration);

        // Still exactly one table, still functional.
        const { rows } = await insertToken(ids.subjectTeacherId);
        assert.ok(rows[0].id);
    });
});
