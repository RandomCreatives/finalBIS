const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});

// Give in-flight requests a chance to finish on deploy/restart.
const shutdown = (signal) => () => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));

module.exports = server;
