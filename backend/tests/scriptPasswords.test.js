const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

describe('script password security checks', () => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');

    test('no hardcoded password string literals in backend/scripts/*.js', () => {
        const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
        assert.ok(files.length > 0, 'Should find scripts in backend/scripts');

        // Forbidden password patterns or known leaked password strings
        const forbiddenKeywords = [
            /changeme/i,
            /admin2026/i,
            /teacher2026/i,
            /clinic2026/i,
            /store2026/i,
            /bisnoc2026/i,
            /library2026/i,
            /leul2026/i,
            /mike2026/i,
            /temppass/i,
        ];

        // Regex for string literal assignments to password / TEMP_PASSWORD
        // Matches: password: 'x', password = 'x', TEMP_PASSWORD = 'x'
        const assignmentPattern = /(?:password|TEMP_PASSWORD)\s*[:=]\s*['"`]([^'"`]+)['"`]/gi;

        const violations = [];

        for (const file of files) {
            const filePath = path.join(scriptsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            // Strip comments
            const codeOnly = content
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '');

            // Check forbidden keyword list
            for (const pattern of forbiddenKeywords) {
                if (pattern.test(codeOnly)) {
                    violations.push(`${file} contains forbidden credential string matching ${pattern}`);
                }
            }

            // Check string literal assignments
            let match;
            while ((match = assignmentPattern.exec(codeOnly)) !== null) {
                const val = match[1].trim();
                // Ignore doc placeholders like '...' or '<...>'
                if (val !== '...' && !val.startsWith('<')) {
                    violations.push(`${file} assigns string literal password: "${match[0]}"`);
                }
            }
        }

        assert.deepEqual(violations, [], `Hardcoded password literals found in backend/scripts:\n${violations.join('\n')}`);
    });

    test('node --check passes on all backend/scripts/*.js', () => {
        const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));

        for (const file of files) {
            const filePath = path.join(scriptsDir, file);
            assert.doesNotThrow(() => {
                execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
            }, `node --check failed for ${file}`);
        }
    });

    test('admin-login scripts exit non-zero when ADMIN_EMAIL/ADMIN_PASSWORD missing', () => {
        const adminScripts = ['assign-staff.js', 'fix-assignments.js', 'import-staff.js'];

        for (const scriptName of adminScripts) {
            const scriptPath = path.join(scriptsDir, scriptName);
            let failed = false;
            try {
                execFileSync(process.execPath, [scriptPath], {
                    env: { ...process.env, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' },
                    stdio: 'pipe'
                });
            } catch (err) {
                failed = true;
                assert.notEqual(err.status, 0, `${scriptName} should exit non-zero when env vars missing`);
            }
            assert.ok(failed, `${scriptName} did not fail when ADMIN_EMAIL and ADMIN_PASSWORD were missing`);
        }
    });
});
