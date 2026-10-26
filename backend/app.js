const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter, isAllowedOrigin } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const telegramBot = require('./services/telegramBot');
const { ensureMagentaMainTeacherOnce } = require('./services/magentaMainTeacher');

const app = express();

// Do not disclose the framework on every response.
app.disable('x-powered-by');

// Behind Vercel/Render the client IP arrives via X-Forwarded-For; without
// this the rate limiter would see one proxy IP for every visitor.
app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: env.isProduction
        ? {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'"],
                "font-src": ["'self'", "https://fonts.gstatic.com"],
                "connect-src": ["'self'", env.supabaseUrl, ...env.corsOrigins],
                "img-src": ["'self'", 'data:', 'https:'],
                "style-src": ["'self'", "'unsafe-inline'"],
            },
        }
        : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
}));

/**
 * CORS: strict allow-list, but always permit same-origin requests.
 *
 * On Vercel the static site and the API share one domain, yet browsers still
 * send an `Origin` header on same-origin POST/fetch calls. In production the
 * allow-list check alone would reject those and break the deployed app, so we
 * first allow any request whose Origin matches this server's own host.
 */
app.use((req, res, next) => {
    cors({
        origin(origin, callback) {
            // Same-origin/curl requests carry no Origin header.
            if (!origin) return callback(null, true);

            // Same-origin: the Origin matches this request's own host.
            try {
                const reqHost = req.headers.host; // e.g. app.vercel.app
                const originUrl = new URL(origin);
                if (reqHost && originUrl.host.toLowerCase() === reqHost.toLowerCase()) {
                    return callback(null, true);
                }
            } catch {
                /* fall through to the allow-list */
            }

            if (isAllowedOrigin(origin, env)) {
                return callback(null, true);
            }
            callback(new Error(`Origin ${origin} is not permitted by CORS`));
        },
        credentials: true,
    })(req, res, next);
});

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'BIS NOC School Management System API (Supabase)',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', env: env.nodeEnv, timestamp: new Date().toISOString() });
});

// Reconcile pending 2026/2027 Year 4 - Magenta main-teacher staffing
// (Ms. Bethelhem Girma + active account + class-teacher subjects) once per
// server instance so deployments do not depend on a manual SQL Editor run.
if (env.nodeEnv !== 'test') {
    app.use('/api', async (req, res, next) => {
        try {
            await ensureMagentaMainTeacherOnce();
        } catch (err) {
            console.error('[staffing] Magenta main-teacher ensure failed:', err.message);
        }
        next();
    });
}

/**
 * Keep-alive endpoint for Supabase free tier.
 * Free projects pause after 7 days of inactivity. This lightweight query
 * touches the DB once every 5 days via Vercel cron to prevent that.
 */
app.get('/api/keep-alive', async (req, res) => {
    try {
        const supabase = require('./config/supabase');
        const { error } = await supabase.from('users').select('id', { count: 'exact', head: true }).limit(1);
        if (error) throw error;
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[keep-alive] Ping failed:', err.message);
        res.status(500).json({ status: 'error', message: 'Database ping failed' });
    }
});

/**
 * Daily attendance reminders (Vercel cron, vercel.json — weekdays 06:00 UTC,
 * i.e. 09:00 in Addis Ababa). The backstop for the bell-driven trigger:
 * idempotent and time-gated, so a stray call can only send what is already
 * due. With CRON_SECRET set (recommended) Vercel sends it as a bearer token
 * and anything else is refused. The response carries counts only.
 */
app.get('/api/cron/attendance-reminders', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    try {
        const { runAttendanceReminders } = require('./services/attendanceReminders');
        const result = await runAttendanceReminders();
        console.log('[attendance-reminders]', JSON.stringify(result));
        res.json({
            status: 'ok',
            date: result.date,
            time: result.time,
            due: result.due,
            schools: result.schools.map((s) => ({
                schoolDay: s.schoolDay,
                missingRegisters: s.missing.length,
                teachersReminded: s.reminded.reduce((n, r) => n + r.teachers.length, 0),
                telegramSent: s.telegram,
                officeDigest: s.digest,
            })),
        });
    } catch (err) {
        console.error('[attendance-reminders] failed:', err.message);
        res.status(500).json({ status: 'error', message: 'Attendance reminders failed' });
    }
});

// Telegram webhook: registered before the IP limiter so Telegram's own
// delivery IPs are never throttled, and the secret-token header is checked.
app.post('/api/telegram/webhook', telegramBot.webhookHandler);

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
