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

    // Optional SMTP for sending verification codes and passwordless sign-in
    // emails. Leave blank in development to fall back to the server log.
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || '',
    },

    // Telegram Login Widget bot. The token is used to verify the widget's
    // HMAC signature and, later, to send staff notifications.
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    },
};

env.isProduction = env.nodeEnv === 'production';

module.exports = env;
