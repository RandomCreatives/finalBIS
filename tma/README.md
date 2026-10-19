# BIS NOC Staff Mini App (Telegram)

A small React + Vite app that runs inside Telegram and signs staff in with
their Telegram identity. It talks to the same Express/Supabase API as the main
site; no separate backend.

## How sign-in works

1. Telegram opens the Mini App with a signed `initData` query string. The SDK
   exposes it as `window.Telegram.WebApp.initData`.
2. The app POSTs it to `POST /api/auth/telegram-webapp`.
3. The backend verifies Telegram's **Mini App** HMAC:

   ```
   secret_key        = HMAC_SHA256(key="WebAppData", message=<bot_token>)
   data_check_string = every field except "hash", sorted by key, joined "\n"
   hash              = hex(HMAC_SHA256(key=secret_key, message=data_check_string))
   ```

   This is *not* the Login Widget algorithm (which hashes the bot token
   directly). It also enforces `auth_date` freshness: older than 24 h or more
   than 5 minutes in the future is rejected. The bot token never leaves the
   server.
4. The Telegram account must already be linked to an active staff account
   (Staff page → Link Telegram). Unlinked or deactivated accounts get a 401.
5. On success the API returns the same JWT session the website uses.

The endpoint is rate-limited per IP (10 failed attempts / 15 min, successful
sign-ins are not counted).

## Local development

```bash
cd tma
npm ci
npm run dev        # http://localhost:5173/tma/
```

`/api` requests are proxied to `http://localhost:5000` (override with
`VITE_DEV_API_PROXY`). To exercise the Telegram flow locally, start the
backend and open the app from the bot — Telegram supplies `initData` only
inside its webview. Outside Telegram the app shows a clear "open from
Telegram" message instead of crashing.

```bash
npm run build      # tsc + production bundle in dist/
npm run preview    # serve dist/ at /tma/
```

## Deployment (Vercel)

The root `vercel.json` builds this app with `@vercel/static-build` and serves
it under **`/tma/`**:

| Path                | Serves                       |
| ------------------- | ---------------------------- |
| `/tma`, `/tma/…`    | `tma/index.html` (SPA)       |
| `/tma/assets/*`     | hashed JS/CSS bundles        |
| `/api/*`            | the Express backend          |

Vite's `base` is `/tma/`, so the built HTML references `/tma/assets/…`. The
SPA fallback route keeps deep links (e.g. `/tma/attendance`) working; React
Router uses `import.meta.env.BASE_URL` as its basename.

`VITE_API_URL` stays **empty** in production: the app and API share a domain,
so relative `/api` URLs are correct.

### Registering the Mini App with Telegram

1. `@BotFather` → `/newapp` (or `/setmenubutton`) → choose the bot.
2. Web App URL: `https://<your-domain>/tma/`.
3. Set the same `TELEGRAM_BOT_TOKEN` in Vercel's backend environment variables
   (server-side only — do not prefix it with `REACT_APP_` or `VITE_`).

## CI

`.github/workflows/ci.yml` runs `npm ci` and `npm run build` (which includes
`tsc` type-checking) for this directory, and asserts that the built HTML
references `/tma/assets/`.
