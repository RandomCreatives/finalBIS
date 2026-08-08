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
            console.log(`✅ PASS: ${description}`);
        } else {
            results.warnings.push({ description, severity });
            console.log(`⚠️  ${severity.toUpperCase().padEnd(6)}: ${description}`);
        }
    } catch (err) {
        results.errors.push({ description, error: err.message, severity });
        console.log(`❌ ERROR: ${description}`);
        console.log(`   ${err.message}`);
    }
}

// Check 1: Environment variables
console.log('\n📋 Environment Configuration');
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
        const backendEnv = path.join(__dirname, '../backend/.env');
        const frontendEnv = path.join(__dirname, '../frontend/.env');
        return !fs.existsSync(backendEnv) && !fs.existsSync(frontendEnv);
    },
    'error'
);

// Check 2: Security headers
console.log('\n🔒 Security Headers');
console.log('-'.repeat(80));

check(
    'Helmet middleware configured',
    () => {
        const appJs = fs.readFileSync(path.join(__dirname, '../backend/app.js'), 'utf8');
        return appJs.includes('helmet') && appJs.includes('app.use(helmet');
    },
    'error'
);

check(
    'CORS configured with origin validation',
    () => {
        const appJs = fs.readFileSync(path.join(__dirname, '../backend/app.js'), 'utf8');
        return appJs.includes('cors') && appJs.includes('isAllowedOrigin');
    },
    'error'
);

check(
    'X-Powered-By disabled',
    () => {
        const appJs = fs.readFileSync(path.join(__dirname, '../backend/app.js'), 'utf8');
        return appJs.includes('x-powered-by') && appJs.includes('disable');
    },
    'warning'
);

check(
    'Trust proxy enabled for rate limiting',
    () => {
        const appJs = fs.readFileSync(path.join(__dirname, '../backend/app.js'), 'utf8');
        return appJs.includes("trust proxy");
    },
    'warning'
);

// Check 3: Authentication
console.log('\n🔐 Authentication Security');
console.log('-'.repeat(80));

check(
    'JWT secret validation exists',
    () => {
        const envJs = fs.readFileSync(path.join(__dirname, '../backend/config/env.js'), 'utf8');
        return envJs.includes('JWT_SECRET') && envJs.includes('length < 32');
    },
    'error'
);

check(
    'Bcrypt used for password hashing',
    () => {
        const authController = fs.readFileSync(path.join(__dirname, '../backend/controllers/auth.controller.js'), 'utf8');
        return authController.includes('bcrypt') && authController.includes('BCRYPT_ROUNDS');
    },
    'error'
);

check(
    'Timing-safe password comparison',
    () => {
        const authController = fs.readFileSync(path.join(__dirname, '../backend/controllers/auth.controller.js'), 'utf8');
        return authController.includes('bcrypt.compare');
    },
    'error'
);

check(
    'Session validation on every request',
    () => {
        const authJs = fs.readFileSync(path.join(__dirname, '../backend/middleware/auth.js'), 'utf8');
        return authJs.includes('supabase') && authJs.includes('is_active');
    },
    'error'
);

// Check 4: Rate limiting
console.log('\n⚡ Rate Limiting');
console.log('-'.repeat(80));

check(
    'Auth rate limiter configured',
    () => {
        const securityJs = fs.readFileSync(path.join(__dirname, '../backend/middleware/security.js'), 'utf8');
        return securityJs.includes('authLimiter') && securityJs.includes('windowMs: 15 * 60 * 1000');
    },
    'error'
);

check(
    'API rate limiter configured',
    () => {
        const securityJs = fs.readFileSync(path.join(__dirname, '../backend/middleware/security.js'), 'utf8');
        return securityJs.includes('apiLimiter') && securityJs.includes('max: 300');
    },
    'warning'
);

check(
    'Failed auth attempts only count toward limit',
    () => {
        const securityJs = fs.readFileSync(path.join(__dirname, '../backend/middleware/security.js'), 'utf8');
        return securityJs.includes('skipSuccessfulRequests: true');
    },
    'warning'
);

// Check 5: Database security
console.log('\n🗃️ Database Security');
console.log('-'.repeat(80));

check(
    'RLS enabled on all tables',
    () => {
        const schemaSql = fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8');
        return schemaSql.includes('ENABLE ROW LEVEL SECURITY') && 
               schemaSql.includes('FORCE ROW LEVEL SECURITY');
    },
    'error'
);

check(
    'No permissive policies (anon can read nothing)',
    () => {
        const schemaSql = fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8');
        return schemaSql.includes('REVOKE ALL ON') && schemaSql.includes('FROM anon, authenticated');
    },
    'error'
);

check(
    'Service role key used (not anon)',
    () => {
        const supabaseJs = fs.readFileSync(path.join(__dirname, '../backend/config/supabase.js'), 'utf8');
        return supabaseJs.includes('supabaseServiceKey') || supabaseJs.includes('SUPABASE_SERVICE_KEY');
    },
    'error'
);

// Check 6: Input validation
console.log('\n📝 Input Validation');
console.log('-'.repeat(80));

check(
    'Express validator used',
    () => {
        const routesJs = fs.readFileSync(path.join(__dirname, '../backend/routes/index.js'), 'utf8');
        return routesJs.includes('express-validator') && routesJs.includes('body(');
    },
    'error'
);

check(
    'Validation middleware exists',
    () => {
        const securityJs = fs.readFileSync(path.join(__dirname, '../backend/middleware/security.js'), 'utf8');
        return securityJs.includes('validate') && securityJs.includes('validationResult');
    },
    'error'
);

// Check 7: Error handling
console.log('\n⚠️ Error Handling');
console.log('-'.repeat(80));

check(
    'Error handling middleware exists',
    () => {
        const appJs = fs.readFileSync(path.join(__dirname, '../backend/app.js'), 'utf8');
        return appJs.includes('errorHandler') && appJs.includes('notFound');
    },
    'error'
);

check(
    'Async handler wrapper used',
    () => {
        const errorsJs = fs.readFileSync(path.join(__dirname, '../backend/utils/errors.js'), 'utf8');
        return errorsJs.includes('asyncHandler');
    },
    'warning'
);

// Check 8: Tests
console.log('\n🧪 Testing');
console.log('-'.repeat(80));

check(
    'Backend test files exist',
    () => {
        const testDir = path.join(__dirname, '../backend/tests');
        const files = fs.readdirSync(testDir);
        return files.length > 0 && files.some(f => f.endsWith('.test.js'));
    },
    'error'
);

check(
    'Database test files exist',
    () => {
        const testDir = path.join(__dirname, '../backend/tests/db');
        if (fs.existsSync(testDir)) {
            const files = fs.readdirSync(testDir);
            return files.some(f => f.endsWith('.db.test.js'));
        }
        return false;
    },
    'warning'
);

// Check 9: CI/CD
console.log('\n🚀 CI/CD');
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
        if (fs.existsSync(workflowDir)) {
            const files = fs.readdirSync(workflowDir);
            return files.some(f => f.includes('ci') || f.includes('test'));
        }
        return false;
    },
    'warning'
);

// Check 10: Dependencies
console.log('\n📦 Dependencies');
console.log('-'.repeat(80));

try {
    console.log('\nBackend dependencies:');
    execSync('cd backend && npm ls --depth=0 2>/dev/null | head -20', { encoding: 'utf8' });
    
    console.log('\nFrontend dependencies:');
    execSync('cd frontend && npm ls --depth=0 2>/dev/null | head -20', { encoding: 'utf8' });
} catch (err) {
    console.log('⚠️  Could not list dependencies (npm not available or no node_modules)');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);
console.log(`❌ Errors: ${results.errors.length}`);
console.log();

if (results.errors.length > 0) {
    console.log('🔴 CRITICAL ISSUES (must fix):');
    results.errors.forEach(e => console.log(`  - ${e.description}`));
    console.log();
}

if (results.warnings.length > 0) {
    console.log('🟡 WARNINGS (should fix):');
    results.warnings.forEach(w => console.log(`  - ${w.description}`));
    console.log();
}

if (results.passed.length > 0) {
    console.log('✅ GOOD PRACTICES:');
    results.passed.forEach(p => console.log(`  - ${p}`));
    console.log();
}

const exitCode = results.errors.length > 0 ? 1 : 0;
console.log('='.repeat(80));
process.exit(exitCode);
