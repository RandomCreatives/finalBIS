/**
 * One-time Telegram account linking (staff self-service).
 *
 * Both endpoints require a signed-in staff member. The link is a bearer
 * token, so it is minted on demand, expires in 10 minutes, is usable once,
 * and is scoped to the requesting account. See services/telegramLink.js for
 * the token lifecycle and the rejection rules.
 */
const env = require('../config/env');
const {
    LINK_TOKEN_TTL_MS,
    buildDeepLink,
    createLinkToken,
    getLinkStatus,
} = require('../services/telegramLink');
const {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    asyncHandler,
} = require('../utils/errors');

const requireTelegramConfigured = () => {
    if (!env.telegram.botToken || !env.telegram.botUsername) {
        throw new BadRequestError(
            'Telegram is not configured on this server. Ask an administrator to set the bot token and username.'
        );
    }
};

/**
 * POST /api/auth/telegram-link
 *
 * Mints a one-time deep link for the signed-in staff member. The response
 * carries the deep link (and the token it is built from) so the browser can
 * offer both "Open Telegram" and "Copy link". Nothing secret about the bot
 * leaves the server.
 */
const requestLink = asyncHandler(async (req, res) => {
    requireTelegramConfigured();

    const result = await createLinkToken({ userId: req.user.id });

    if (!result.ok) {
        if (result.code === 'not_found') throw new NotFoundError('Account not found');
        if (result.code === 'inactive') {
            throw new ForbiddenError('This account is deactivated. Contact the school office.');
        }
        if (result.code === 'already_linked') {
            throw new ConflictError(
                'This account is already linked to a Telegram account. Unlink it first to link a different one.'
            );
        }
        throw new BadRequestError('Could not create a Telegram link. Please try again.');
    }

    const botUsername = env.telegram.botUsername.replace(/^@/, '');

    res.status(201).json({
        token: result.token,
        deepLink: buildDeepLink(botUsername, result.token),
        botUsername,
        expiresAt: result.expiresAt.toISOString(),
        expiresInSeconds: Math.floor(LINK_TOKEN_TTL_MS / 1000),
        message: `Open this link in Telegram within ${Math.floor(LINK_TOKEN_TTL_MS / 60000)} minutes to finish linking.`,
    });
});

/**
 * GET /api/auth/telegram-link/:token
 *
 * Poll the state of a link the caller minted: pending | used | expired |
 * invalid. Scoped to the caller, so other members' tokens are not readable.
 */
const linkStatus = asyncHandler(async (req, res) => {
    const result = await getLinkStatus({ userId: req.user.id, token: req.params.token });
    res.json(result);
});

module.exports = { requestLink, linkStatus };
