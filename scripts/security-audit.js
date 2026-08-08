#!/usr/bin/env node

/**
 * Security Audit Script for BIS NOC
 * Run: node scripts/security-audit.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(80));
console.log('BIS NOC Security Audit');
console.log('='.repeat(80));
console.log();

const results = {
    passed: [],
    warnings: [],
    errors: []
};

function check(description, test, severity = 'warning') {
    try {
        const result = test();
        if (result) {
            results.passed.push(description);
            console.log(`\u2705 PASS: ${description}`);
        } else {
            results.warnings.push({ description, severity });
            console.log(`\u26A0\uFE0F  ${severity.toUpperCase().padEnd(6)}: ${description}`);
        }
    } catch (err) {
        results.errors.push({ description, error: err.message, severity });
        console.log(`\u274C ERROR: ${description}`);
        console.log(`   ${err.message}`);
    }
}

/** Reads the given repo-relative file as UTF-8, or null if missing. */
function readFile(relPath) {
    const abs = path.join(__dirname, '..', relPath);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

/** Combines schema.sql + functions.sql + all migration files. */
function combinedSchema() {
    const parts = [];
    for (const rel of ['supabase/schema.sql', 'supabase/functions.sql']) {
        const content = readFile(rel);
        if (content) parts.push(content);
    }
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    if (fs.existsSync(migrationsDir)) {
        for (const file of fs.readdirSync(migrationsDir)) {
            if (file.endsWith('.sql')) {
                parts.push(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
            }
        }
    }
    return parts.join('\n');
}

// Check 1: Environment variables
console.log('\n\uD83D\uDCCB Environment Configuration');
console.log('-'.repeat(80));

check(
    'Backend .env.example exists',
    () => fs.existsSync(path.join(__dirname, '../backend/.env.example')),
    'error'
);

check(
    'Frontend .env.example exists',
    () => fs.existsSync(path.join(__dirname, '../frontend/.env.example')),
    'error'
);

check(
    'No .env files committed (security risk)',
    () => {
        // Checks git tracking, not mere file existence: a local .env is
        // expected in development, but committing it is the security risk.
        try {
            const tracked = execSync('git ls-files -- backend/.env frontend/.env', {
                cwd: path.join(__dirname, '..'),
                encoding: 'utf8',
            }).trim();
            return tracked === '';
        } catch {
            return false;
        }
    },
    'error'
);

// Check 2: Security headers
console.log('\n\uD83D\uDD12 Security Headers');
console.log('-'.repeat(80));

check(
    'Helmet middleware configured',
    () => {
        const appJs = readFile('backend/app.js');
        return appJs && appJs.includes('helmet') && appJs.includes('app.use(helmet');
    },
    'error'
);

check(
    'CORS configured with origin validation',
    () => {
        const appJs = readFile('backend/app.js');
        return appJs && appJs.includes('cors') && appJs.includes('isAllowedOrigin');
    },
    'error'
);

check(
    'X-Powered-By disabled',
    () => {
        const appJs = readFile('backend/app.js');
        return appJs && appJs.includes('x-powered-by') && appJs.includes('disable');
    },
    'warning'
);

check(
    'Trust proxy enabled for rate limiting',
    () => {
        const appJs = readFile('backend/app.js');
        return appJs && appJs.includes('trust proxy');
    },
    'warning'
);

// Check 3: Authentication
console.log('\n\uD83D\uDD10 Authentication Security');
console.log('-'.repeat(80));

check(
    'JWT secret validation exists',
    () => {
        const envJs = readFile('backend/config/env.js');
        return envJs && envJs.includes('JWT_SECRET') && envJs.includes('length < 32');
    },
    'error'
);

check(
    'Bcrypt used for password hashing',
    () => {
        const authController = readFile('backend/controllers/auth.controller.js');
        return authController && authController.includes('bcrypt') && authController.includes('BCRYPT_ROUNDS');
    },
    'error'
);

check(
    'Timing-safe password comparison',
    () => {
        const authController = readFile('backend/controllers/auth.controller.js');
        return authController && authController.includes('bcrypt.compare');
    },
    'error'
);

check(
    'Session validation on every request',
    () => {
        const authJs = readFile('backend/middleware/auth.js');
        return authJs && authJs.includes('supabase') && authJs.includes('is_active');
    },
    'error'
);

// Check 4: Rate limiting
console.log('\n\u26A1 Rate Limiting');
console.log('-'.repeat(80));

check(
    'Auth rate limiter configured',
    () => {
        const securityJs = readFile('backend/middleware/security.js');
        return securityJs && securityJs.includes('authLimiter') && securityJs.includes('windowMs: 15 * 60 * 1000');
    },
    'error'
);

check(
    'API rate limiter configured',
    () => {
        const securityJs = readFile('backend/middleware/security.js');
        return securityJs && securityJs.includes('apiLimiter') && securityJs.includes('max: 300');
    },
    'warning'
);

check(
    'Failed auth attempts only count toward limit',
    () => {
        const securityJs = readFile('backend/middleware/security.js');
        return securityJs && securityJs.includes('skipSuccessfulRequests: true');
    },
    'warning'
);

// Check 5: Database security
console.log('\n\uD83D\uDDC3\uFE0F Database Security');
console.log('-'.repeat(80));

check(
    'RLS enabled on all tables',
    () => {
        const sql = combinedSchema();
        return sql.includes('ENABLE ROW LEVEL SECURITY') &&
               sql.includes('FORCE ROW LEVEL SECURITY');
    },
    'error'
);

check(
    'No permissive policies (anon can read nothing)',
    () => {
        const sql = combinedSchema();
        return sql.includes('REVOKE ALL ON') && sql.includes('FROM anon, authenticated');
    },
    'error'
);

check(
    'Service role key used (not anon)',
    () => {
        const supabaseJs = readFile('backend/config/supabase.js');
        return supabaseJs && (supabaseJs.includes('supabaseServiceKey') || supabaseJs.includes('SUPABASE_SERVICE_KEY'));
    },
    'error'
);

// Check 6: Input validation
console.log('\n\uD83D\uDCDD Input Validation');
console.log('-'.repeat(80));

check(
    'Express validator used',
    () => {
        const routesJs = readFile('backend/routes/index.js');
        return routesJs && routesJs.includes('express-validator') && routesJs.includes('body(');
    },
    'error'
);

check(
    'Validation middleware exists',
    () => {
        const securityJs = readFile('backend/middleware/security.js');
        return securityJs && securityJs.includes('validate') && securityJs.includes('validationResult');
    },
    'error'
);

// Check 7: Error handling
console.log('\n\u26A0\uFE0F Error Handling');
console.log('-'.repeat(80));

check(
    'Error handling middleware exists',
    () => {
        const appJs = readFile('backend/app.js');
        return appJs && appJs.includes('errorHandler') && appJs.includes('notFound');
    },
    'error'
);

check(
    'Async handler wrapper used',
    () => {
        const errorsJs = readFile('backend/utils/errors.js');
        return errorsJs && errorsJs.includes('asyncHandler');
    },
    'warning'
);

// Check 8: Tests
console.log('\n\uD83E\uDDEA Testing');
console.log('-'.repeat(80));

check(
    'Backend test files exist',
    () => {
        const testDir = path.join(__dirname, '../backend/tests');
        if (!fs.existsSync(testDir)) return false;
        return fs.readdirSync(testDir).some((f) => f.endsWith('.test.js'));
    },
    'error'
);

check(
    'Database test files exist',
    () => {
        const testDir = path.join(__dirname, '../backend/tests/db');
        if (!fs.existsSync(testDir)) return false;
        return fs.readdirSync(testDir).some((f) => f.endsWith('.db.test.js'));
    },
    'warning'
);

// Check 9: CI/CD
console.log('\n\uD83D\uDE80 CI/CD');
console.log('-'.repeat(80));

check(
    'GitHub Actions workflow template exists',
    () => fs.existsSync(path.join(__dirname, '../docs/ci/github-actions.yml.example')),
    'warning'
);

check(
    'GitHub Actions workflow configured',
    () => {
        const workflowDir = path.join(__dirname, '../.github/workflows');
        if (!fs.existsSync(workflowDir)) return false;
        return fs.readdirSync(workflowDir).some((f) => f.includes('ci') || f.includes('test'));
    },
    'warning'
);

// Check 10: Dependencies
console.log('\n\uD83D\uDCE6 Dependencies');
console.log('-'.repeat(80));

for (const dir of ['backend', 'frontend']) {
    try {
        const cwd = path.join(__dirname, '..', dir);
        console.log(`\n${dir} dependencies:`);
        console.log(execSync('npm ls --depth=0', { cwd, encoding: 'utf8' }));
    } catch (err) {
        const lines = String(err.stdout || '').trim().split('\n');
        lines.forEach((l) => console.log(l));
        const linesErr = String(err.stderr || '').trim().split('\n');
        linesErr.forEach((l) => console.log(l));
        console.log(`\u26A0\uFE0F  ${dir}: npm ls reported problems (broken/missing deps)`);
    }
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`\u2705 Passed: ${results.passed.length}`);
console.log(`\u26A0\uFE0F  Warnings: ${results.warnings.length}`);
console.log(`\u274C Errors: ${results.errors.length}`);
console.log();

if (results.errors.length > 0) {
    console.log('\uD83D\uDD34 CRITICAL ISSUES (must fix):');
    results.errors.forEach((e) => console.log(`  - ${e.description}`));
    console.log();
}

if (results.warnings.length > 0) {
    console.log('\uD83D\uDFE1 WARNINGS (should fix):');
    results.warnings.forEach((w) => console.log(`  - ${w.description}`));
    console.log();
}

if (results.passed.length > 0) {
    console.log('\u2705 GOOD PRACTICES:');
    results.passed.forEach((p) => console.log(`  - ${p}`));
    console.log();
}

const exitCode = results.errors.length > 0 ? 1 : 0;
console.log('='.repeat(80));
process.exit(exitCode);
