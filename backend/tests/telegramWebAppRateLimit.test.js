/**
 * Rate limiting for the Telegram Mini App sign-in endpoint.
 *
 * Kept in its own file so the limiter's in-memory counter starts fresh: the
 * other telegramWebApp tests deliberately send several 401s, and those count
 * toward the IP budget (only successful requests are skipped).
 */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';

describe('POST /api/auth/telegram-webapp rate limiting', () => {
    beforeEach(() =>
        reset({
            users: [
                {
                    id: ADMIN,
                    school_id: SCHOOL,
                    name: 'Test Admin',
                    email: 'admin@school.et',
                    role: 'admin',
                    is_active: true,
                    telegram_id: null,
                    last_login_at: null,
                },
            ],
        }),
    );

    test('throttles repeated failed Telegram sign-in attempts', async () => {
        const statuses = [];
        for (let i = 0; i < 11; i += 1) {
            const res = await request(app)
                .post('/api/auth/telegram-webapp')
                .send({ init_data: `not-a-valid-payload-${i}` });
            statuses.push(res.status);
        }

        assert.equal(statuses.slice(0, 10).every((s) => s === 401), true, `unexpected statuses: ${statuses}`);
        assert.equal(statuses[10], 429, `expected the 11th attempt to be throttled: ${statuses}`);
    });
});
