const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers');
const request = require('./request');
const app = require('../app');
const { isAllowedOrigin } = require('../middleware/security');

describe('security middleware', () => {
    test('does not disclose Express via X-Powered-By', async () => {
        const res = await request(app).get('/health');

        assert.equal(res.status, 200);
        assert.equal(res.headers['x-powered-by'], undefined);
    });

    test('allows exact configured production origins only', () => {
        const env = { corsOrigins: ['https://portal.school.example'], isProduction: true };

        assert.equal(isAllowedOrigin('https://portal.school.example', env), true);
        assert.equal(isAllowedOrigin('https://portal.school.example.evil.test', env), false);
        assert.equal(isAllowedOrigin('https://5000-sandbox.e2b.app', env), false);
    });

    test('allows safe local and Arena preview hosts outside production', () => {
        const env = { corsOrigins: ['https://portal.school.example'], isProduction: false };

        assert.equal(isAllowedOrigin('http://localhost:3000', env), true);
        assert.equal(isAllowedOrigin('http://127.0.0.1:3000', env), true);
        assert.equal(isAllowedOrigin('https://5000-sandbox.e2b.app', env), true);
        assert.equal(isAllowedOrigin('https://localhost.evil.example', env), false);
    });
});
