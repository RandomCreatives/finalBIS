const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123456:TEST_TOKEN_FOR_SUITES';

const { reset, rowsOf } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = {
    id: 'b7180a79-119a-4dfb-9934-aa683058abf6',
    school_id: SCHOOL,
    name: 'School Admin',
    email: 'admin@bisnoc.local',
    password_hash: '$2a$12$x',
    role: 'admin',
    is_active: true,
    telegram_id: null,
};
const MAIN_TEACHER = {
    id: '82e61fbc-9942-415c-909c-f408360a2ef4',
    school_id: SCHOOL,
    name: 'Bethelhem Girma',
    email: 'bethelhem.girma@bisnoc.local',
    password_hash: '$2a$12$x',
    role: 'main_teacher',
    is_active: true,
    telegram_id: 111222333,
};
const SUBJECT_TEACHER = {
    id: '33333333-3333-4333-8333-000000000002',
    school_id: SCHOOL,
    name: 'Mr. Michael',
    email: 'mr.michael@bisnoc.local',
    password_hash: '$2a$12$x',
    role: 'subject_teacher',
    is_active: true,
    telegram_id: 444555666,
};

const realFetch = global.fetch;

describe('Admin Broadcast (/api/push/*)', () => {
    let telegramCalls = [];

    beforeEach(() => {
        telegramCalls = [];
        reset({
            schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
            users: [ADMIN, MAIN_TEACHER, SUBJECT_TEACHER],
            push_subscriptions: [],
            notifications: [],
        });

        global.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.telegram.org/')) {
                telegramCalls.push({
                    method: String(url).split('/').pop(),
                    body: JSON.parse(init.body),
                });
                return { json: async () => ({ ok: true, result: { message_id: 1 } }) };
            }
            return realFetch(url, init);
        };
    });

    afterEach(() => {
        global.fetch = realFetch;
    });

    test('GET /api/push/stats returns Telegram-linked and active staff counts without failing when no browser subs exist', async () => {
        const res = await request(app)
            .get('/api/push/stats')
            .auth(signToken(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.subscribedUsers, 0);
        assert.equal(res.body.telegramLinkedUsers, 2);
        assert.equal(res.body.activeStaffUsers, 3);
    });

    test('POST /api/push/subscribe and both POST & DELETE /api/push/unsubscribe manage subscriptions cleanly', async () => {
        const subRes = await request(app)
            .post('/api/push/subscribe')
            .auth(signToken(MAIN_TEACHER))
            .send({
                endpoint: 'https://fcm.googleapis.com/fcm/send/example-1',
                keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
            });
        assert.equal(subRes.status, 200);
        assert.equal(rowsOf('push_subscriptions').length, 1);

        const delRes = await request(app)
            .delete('/api/push/unsubscribe')
            .auth(signToken(MAIN_TEACHER))
            .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/example-1' });
        assert.equal(delRes.status, 200);
        assert.equal(rowsOf('push_subscriptions').length, 0);
    });

    test('POST /api/push/send broadcasts to all staff via @bisnocbot Telegram and in-app bell even without VAPID keys', async () => {
        const res = await request(app)
            .post('/api/push/send')
            .auth(signToken(ADMIN))
            .send({
                title: 'Rainy dismissal plan',
                body: 'Gate B opens at 15:05 today.',
                url: '/app/attendance',
                audience: null,
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.telegramSent, 2);
        assert.equal(res.body.inAppSent, 3);
        assert.equal(res.body.failed, 0);

        const sentMessages = telegramCalls.filter((c) => c.method === 'sendMessage');
        assert.equal(sentMessages.length, 2);
        assert.match(sentMessages[0].body.text, /Office Broadcast/);
        assert.match(sentMessages[0].body.text, /Rainy dismissal plan/);
        const buttons = sentMessages[0].body.reply_markup.inline_keyboard.flat();
        assert.ok(buttons.some((b) => b.web_app?.url === 'https://bis-gerji-primary2.vercel.app/tma/'));
        assert.ok(buttons.some((b) => b.url === 'https://bis-gerji-primary2.vercel.app/app/attendance'));
    });

    test('POST /api/push/send respects role audience filter and rejects non-admin callers', async () => {
        const forbidden = await request(app)
            .post('/api/push/send')
            .auth(signToken(MAIN_TEACHER))
            .send({ title: 'Test', body: 'Test' });
        assert.equal(forbidden.status, 403);

        const res = await request(app)
            .post('/api/push/send')
            .auth(signToken(ADMIN))
            .send({
                title: 'Marksheet deadline',
                body: 'Please submit French & English marks by Friday.',
                audience: 'subject_teacher',
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.telegramSent, 1);
        assert.equal(res.body.inAppSent, 1);

        const sentMessages = telegramCalls.filter((c) => c.method === 'sendMessage');
        assert.equal(sentMessages.length, 1);
        assert.equal(sentMessages[0].body.chat_id, SUBJECT_TEACHER.telegram_id);
        const buttons = sentMessages[0].body.reply_markup.inline_keyboard.flat();
        assert.ok(buttons.some((b) => b.url === 'https://bis-gerji-primary2.vercel.app/subject-home'));
    });
});
