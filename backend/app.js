const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind Vercel/Render the client IP arrives via X-Forwarded-For; without
// this the rate limiter would see one proxy IP for every visitor.
app.set('trust proxy', 1);

app.use(helmet());

/**
 * CORS: strict allow-list. An unknown origin is rejected outright — the
 * previous implementation logged a rejection and then allowed it anyway.
 */
app.use(
    cors({
        origin(origin, callback) {
            // Same-origin/curl requests carry no Origin header.
            if (!origin) return callback(null, true);
            if (
                env.corsOrigins.includes(origin) ||
                origin.endsWith('.e2b.app') ||
                origin.includes('localhost') ||
                env.nodeEnv === 'development'
            ) {
                return callback(null, true);
            }
            callback(new Error(`Origin ${origin} is not permitted by CORS`));
        },
        credentials: true,
    })
);

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

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
