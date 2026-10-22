/**
 * Which deployment am I?
 *
 * When Telegram linking misbehaves the first question is almost always "are
 * the bot and the website talking to the same deployment and the same
 * database?" — a webhook registered on a preview URL, or an API host with a
 * different SUPABASE_URL, produces exactly the "not linked" dead end we kept
 * seeing, and nothing in the response said which environment answered.
 *
 * Everything here is a non-secret fingerprint: host names, a commit hash and
 * a masked database project reference. No token, key or full ref ever
 * appears. The same object is stamped into sign-in errors, the bot's
 * confirmation, and the diagnostics endpoint, so two of them can be compared
 * side by side.
 */
const env = require('../config/env');

/** First-4 … last none: enough to tell two projects apart, useless to anyone else. */
const maskRef = (value, keep = 4) => {
    const s = String(value || '').trim();
    if (!s) return null;
    if (s.length <= keep) return '…';
    return `${s.slice(0, keep)}…`;
};

/** Host of a URL, or null. Never throws on rubbish input. */
const hostOf = (value) => {
    try {
        return new URL(String(value)).host || null;
    } catch {
        return null;
    }
};

/**
 * Supabase project reference as `<ref>.supabase.co` → masked ref.
 * Self-hosted or custom domains fall back to the masked hostname.
 */
const supabaseRef = (url = env.supabaseUrl) => {
    const host = hostOf(url);
    if (!host) return null;

    const label = host.split('.')[0];
    if (/\.supabase\.(co|in)$/i.test(host)) return maskRef(label);
    return maskRef(host, 6);
};

/**
 * Is this a preview/ephemeral host rather than the real site?
 *
 * Vercel is explicit when it can be (VERCEL_ENV), which is the reliable
 * signal; the hostname heuristics are the fallback for other hosts and for
 * comparing a webhook URL against this deployment.
 */
const isPreviewHost = (host, { vercelEnv = process.env.VERCEL_ENV, productionHost = null } = {}) => {
    if (vercelEnv && vercelEnv !== 'production') return true;

    const h = String(host || '').toLowerCase();
    if (!h) return false;
    if (/localhost|127\.0\.0\.1/.test(h)) return true;
    if (/\.e2b\.app$/.test(h)) return true;
    if (productionHost && h !== String(productionHost).toLowerCase()) return true;
    // Vercel preview aliases: <project>-git-<branch>-<scope>.vercel.app and
    // <project>-<deployment-id>-<scope>.vercel.app
    if (/-git-[a-z0-9-]+\.vercel\.app$/i.test(h)) return true;
    return false;
};

/**
 * The fingerprint for this process.
 *
 * Vercel exposes VERCEL_URL (this deployment), VERCEL_PROJECT_PRODUCTION_URL
 * (the production domain) and the git commit; other hosts fall back to
 * FRONTEND_URL and nothing respectively. `source` says which was used, so a
 * missing value is never mistaken for a different deployment.
 */
const deploymentInfo = (overrides = {}) => {
    const url =
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        process.env.VERCEL_URL ||
        process.env.FRONTEND_URL ||
        null;

    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || null;
    const host = overrides.host ?? (url ? String(url).replace(/^https?:\/\//, '').replace(/\/$/, '') : null);
    const commit = overrides.commit
        ?? ((process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null);

    return {
        host,
        commit,
        environment: overrides.environment ?? (env.nodeEnv || 'unknown'),
        preview: isPreviewHost(host, {
            vercelEnv: overrides.vercelEnv ?? process.env.VERCEL_ENV,
            productionHost,
        }),
        database: supabaseRef(overrides.supabaseUrl ?? env.supabaseUrl),
    };
};

/** One-line label, e.g. "final-bis.vercel.app@a1b2c3d (production, db abcd…)". */
const deploymentLabel = (info = deploymentInfo()) => {
    const where = [info.host || 'unknown host', info.commit].filter(Boolean).join('@');
    const db = info.database ? `, db ${info.database}` : '';
    return `${where} (${info.environment}${db})`;
};

module.exports = { deploymentInfo, deploymentLabel, isPreviewHost, supabaseRef, maskRef, hostOf };
