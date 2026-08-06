/**
 * Vercel serverless entry point.
 *
 * Serverless functions must export the app rather than bind a port, so the
 * listen call lives in server.js (used for local dev and long-running hosts
 * like Render). Previously both concerns sat in one file gated on NODE_ENV,
 * which meant a mis-set variable could stop the server listening at all.
 */
module.exports = require('../app');
