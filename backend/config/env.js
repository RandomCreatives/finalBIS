require('dotenv').config();

/**
 * Centralised environment loading with fail-fast validation.
 * The app refuses to boot with a missing or weak secret rather than
 * silently falling back to an insecure default.
 */

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
    console.error(
        `\n[config] Missing required environment variable(s): ${missing.join(', ')}\n` +
        `Copy backend/.env.example to backend/.env and fill in the values.\n`
    );
    process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
    console.error(
        '\n[config] JWT_SECRET must be at least 32 characters.\n' +
        'Generate one with:  openssl rand -base64 48\n'
    );
    process.exit(1);
}

const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 5000,

    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,

    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

    // Comma-separated list of allowed browser origins.
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
};

env.isProduction = env.nodeEnv === 'production';

module.exports = env;
