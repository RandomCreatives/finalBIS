# School Management System — BIS NOC Gerji

A staff-facing school management system for the British International School, NOC Gerji Campus.

**Stack:** React 18 (Create React App) · Express 4 · Supabase (PostgreSQL)

---

## Pipeline (CI/CD)

| Stage | What happens | Where |
|---|---|---|
| **Every PR** | Backend test suite (367 tests, offline) + frontend ESLint, build & unit tests | `.github/workflows/ci.yml` (GitHub Actions) |
| **Every PR** | Preview deployment with its own URL | Vercel GitHub integration |
| **Merge to `main`** | Automatic production deployment | Vercel |

Workflow: branch → PR → CI + preview checks → merge → live.

---

## Deploying on Vercel

The application is deployed to Vercel at **`https://bis-gerji-primary2.vercel.app`** (project **`bis-gerji-primary2`**), configured via the root `vercel.json`.

### Environment Variables for Production
Configure these in Vercel Project Settings → Environment Variables for the **Production** environment:
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- `JWT_SECRET` and `JWT_EXPIRES_IN`
- `FRONTEND_URL` (public app URL, no trailing slash, e.g. `https://bis-gerji-primary2.vercel.app`)
- `CORS_ORIGINS`
- `CRON_SECRET` (protects `/api/cron/attendance-reminders`)
- Optional integration credentials: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LOGIN_ENABLED`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).

> **Note:** Any changes to Vercel environment variables take effect only after a new deployment is created.

### Vercel Hobby Plan Deployments & Private Repositories
Under the Vercel Hobby plan for private repositories, commits deployed automatically must be authored by the GitHub account linked to the Vercel project owner. Otherwise, Vercel will block automatic deployment with a "Deployment Blocked" error.
- **Unblocking automatic deployments:** Ensure the Vercel owner's account links the GitHub user (e.g. `RandomCreatives`) under Vercel → Settings → Authentication.
- **Manual deployment option:** From the Vercel dashboard, go to **`bis-gerji-primary2` → Deployments → Create Deployment → `main`**.

### Database Migrations
Migrations in `supabase/migrations/` are applied **manually in order using the Supabase SQL Editor**. Merging code to `main` does not automatically run SQL migrations.
- Latest applied migration: `030_timetable_update_2026_10.sql` (applied); `032_magenta_main_teacher_bethelhem.sql` and `033_french_teacher_2_michael.sql` also self-reconcile automatically on API boot.
- **Pending:** `031_telegram_link_tokens.sql` — creates the one-time linking
  table and must be applied before **Settings → Telegram → Create link** works (in-Mini-App linking on `/tma` works without it).
- **Auto-reconciled on deploy (`032_magenta_main_teacher_bethelhem.sql`):**
  `backend/services/magentaMainTeacher.js` automatically creates/activates
  Ms. Bethelhem Girma (`bethelhem.girma@bisnoc.local`, `main_teacher`), aligns
  every seated main teacher's account password with their class card password
  (`year 3 blue` … `year 4 magenta` … `year 4 orange`), and hands over
  Year 4 - Magenta's homeroom, class-teacher subject seats (Mathematics,
  Science, Global Citizenship, Registration), and timetable lessons on the
  first `/api/*` request (or via admin `POST /api/assignments/magenta-bethelhem`).
  The SQL file remains in `supabase/migrations/` if you want to run it directly
  in the SQL Editor.

### Verifying Production Deployment Status
To verify whether production is running the latest deployment carrying the #151 features (or an older build), send unauthenticated HTTP requests:

| Request | New build | Old build |
|---|---|---|
| `GET /api/cron/attendance-reminders` | **401** `{"status":"error","message":"Unauthorized"}` (proves `CRON_SECRET` is active) | **404** `{"message":"Route not found: GET /api/cron/attendance-reminders"}` |
| `GET /api/attendance/week` | **401** "Authentication required" | **404** Route not found |

---

## What it does

| Module | Capability |
|---|---|
| **Students** | Enrolment records, guardians, special-needs flags, class placement, transfers |
| **Classes** | Homeroom groups, each with a main and an assistant teacher |
| **Subjects** | School-wide catalogue; teachers assigned per class |
| **Assignments** | Class staffing, subject-across-classes assignment, workload reporting |
| **Calendar** | Term dates, exams, meetings, holidays and trips, targeted by role or class |
| **Planning** | Termly schemes of work and weekly lesson plans, with a submit/review workflow |
| **Timetable** | Weekly grid with database-enforced clash prevention; "who attends this class" |
| **Attendance** | Homeroom (daily) or per-subject registers |
| **Marksheets** | Per student, subject and term; percentage and grade derived server-side |
| **Library** | Loans, returns, 3-book limit, overdue fines at 5 ETB/day |
| **Clinic** | Medical visits; leave requests approved by an admin |
| **Messages** | Threaded admin ↔ teacher conversations, attachable to a student or class |
| **Tasks** | Assignable action items with due dates and status |
| **Notices** | Targeted announcements with read and acknowledgement receipts |

> **Scope.** Active modules: Dashboard, Daily Planner,
> Staff, Classes, Subjects, Assignments, Students, Attendance, Timetable,
> Planning, Marksheets, Calendar, Tasks, Files, Notices, Settings. **Dormant — hidden
> from the UI but fully implemented and kept in the codebase:** Library,
> Store, Clinic, Messages, Data Center. These return as later
> versions by re-adding their nav entries; nothing is deleted.

---

## The staffing model

This is the core of the data structure, so it's worth stating plainly.

**Classes** — for 2026/27 the school runs **14 classes**: ten Year 4 (Grade 3)
and four Year 3 (Grade 2), each with a capacity of **30 students**
(max-average). Every class has exactly **one main teacher** and **one assistant
teacher**. Enforced by a partial unique index, so the seat can't be
double-filled. Assistants are added as they are hired — a class may run with
only its main teacher assigned.

**Subjects** — a school-wide catalogue. "English" is *one* row, not one per class.
Each subject records who normally delivers it:

| Delivered by | Subjects |
|---|---|
| **Subject teachers** | English · Amharic · Music · Arts · Physical Education · French |
| **Each class's main teacher** | Mathematics · Science · semester-assigned subjects |

The API warns (rather than blocks) when an assignment departs from this, since cover
and one-off exceptions are normal. **Auto-assign main-teacher subjects** applies the
default arrangement across every staffed class in one action.

**Teaching assignments** (`class_subjects`) — one row per *(class, subject, year)*
naming the responsible teacher. This is what allows:

> 3 English teachers covering 4 classes each · 2 Amharic teachers covering 6 each

A subject teacher spans many classes; a class draws its subjects from many teachers.
The **Assignments → Subject teaching** screen does this in one action: pick the subject,
pick the teacher, tick the classes.

**Academic years and terms** — a year holds three terms of roughly 10–12 weeks each,
though a term is however long its dates say. Teaching weeks are *derived* from those
dates rather than stored, so moving a term re-labels its weeks automatically instead of
leaving lesson plans pointing at the wrong one. Staffing, assignments, timetables,
marks and planning are all scoped to the year or term.

### Admin controls

- **Assign** a main and assistant teacher to each class
- **Rotate** two classes' teachers in a single atomic swap
- **Assign subjects** to a teacher across many classes at once
- **Place unassigned students** into a class in bulk, with capacity enforced
- **Transfer** students between classes, with an audit trail
- **Manage the timetable**, including a per-class view of everyone attached to it

---

## Timetable

A Monday–Friday grid, with visibility scoped by role:

| Role | Sees |
|---|---|
| `admin` | Every class, and edits the schedule |
| `main_teacher` | The **whole weekly grid** for their class, plus their own lessons elsewhere |
| `assistant_teacher` | The whole weekly grid for the class they support |
| `subject_teacher` | **Only their own lessons**, across every class they teach |

Clashes are impossible rather than merely discouraged: two `EXCLUDE USING GIST`
constraints reject any overlapping period for the same class or the same teacher, so
concurrent edits by two admins still cannot produce a double-booking. Reassigning a
subject's teacher cascades onto their timetable automatically.

**Who attends** shows, for any class, its main and assistant teacher, every subject
teacher who comes into it with their weekly load, and the full student roster.

### Roles

| Role | Can do |
|---|---|
| `admin` | Everything: staff accounts, assignments, clinic leave approval, notices |
| `main_teacher` | Their class, attendance, marks, welfare, transfers, tasks, notices |
| `assistant_teacher` | Their class, attendance, library, clinic — no marks, no transfers |
| `subject_teacher` | Attendance and marks for the classes they teach |

Every teacher gets their own dashboard: today's timetable, their classes, their open
tasks, unread messages, and a prompt for any register not yet taken.

---

## The academic cycle

**Terms** — three per year by default, each with real dates. Exactly one is *current*
at a time, and overlapping terms are rejected by the database. Everything that is
"per term" — marks, schemes, lesson plans — hangs off a real term record rather than a
loose `'term_1'` string.

**Schemes of work** — one per teacher, per subject, per class, per term. Creating one
scaffolds a blank row for every teaching week, so a teacher opens a ready-made outline
instead of an empty page.

**Lesson plans** — one per week, per subject, sitting under the scheme: the scheme says
what week 4 covers, the plan says how it will be taught. Includes a reflection field to
complete after teaching.

**Review workflow** — `draft → submitted → approved | changes_requested`. Teachers author
and edit their own work; admins and main teachers review. An approved document locks to
its author. Editing after a change request returns it to draft.

**Staff overview** gives reviewers one row per teaching assignment: scheme status and how
many of the expected weekly plans exist.

---

## Calendar

Term dates, exams, meetings, holidays, trips, deadlines and training — in a month grid
or an upcoming list.

Events can be **targeted by role** (all staff, or just main/assistant/subject teachers)
and **scoped to a class** or left school-wide. Teachers only see events addressed to
them, and only for classes they are attached to. Admins and main teachers publish;
everyone reads.

---

## Admin ↔ teacher communication

Three connected pieces, designed so nothing depends on someone remembering:

1. **Messages** — threaded conversations that can be attached to a student or class.
   Each has a category, priority and an open/resolved state, so a conversation is a
   piece of work that gets closed rather than a message that scrolls away. Unread
   counts appear as a badge in the sidebar.
2. **Tasks** — a request with an owner, due date and visible status. Overdue items are
   flagged on the assignee's dashboard. The assignee moves it along; only the person
   who raised it can change what it says.
3. **Notices** — targeted at a role, optionally requiring acknowledgement. An admin can
   see exactly who has read and confirmed each one.

Messages arrive asynchronously: the inbox polls every 30s and the sidebar badge every
60s. No extra infrastructure, and RLS stays fully closed.

### Data-flow command center

The dashboard now opens with a live **Teacher ↔ Admin data-flow command center** powered
by `GET /api/dashboard/data-flow`:

- **Admins** see branch-wide flow health across staffing, attendance, planning review,
  tasks, conversations, notice acknowledgements and clinic leave approvals.
- **Teachers** see only their own obligations: registers due, planning gaps, assigned
  tasks, unread messages and notices requiring acknowledgement.
- Each flow exposes a progress score, the current metric, the source/destination of the
  data and a next action link, so operational bottlenecks are visible before they become
  missed deadlines.

---

## Telegram sign-in

Staff can sign in with Telegram instead of a password, via the official **Telegram
Login Widget**. A staff member's Telegram account is linked to their BIS NOC login, and
from then on one tap on the Telegram button signs them in — the widget payload is
HMAC-signed by the school bot, so it cannot be forged.

**Linking is self-service and one-time.** A signed-in staff member opens
**Settings → Telegram** and taps **Create link**. The server mints a random
32-byte token, stores only its SHA-256 hash with a 10-minute TTL, and returns
`https://t.me/<bot>?start=link_<token>`; opening it in the bot binds that
Telegram account to their existing staff login. The token is single-use and
one link is live per account (creating a new one invalidates the old).

Expired, reused, unknown, and already-linked identities are refused: a
Telegram account bound to another staff member cannot be claimed, and an
account already bound to a different Telegram account must be unlinked first.
Consumption is an atomic conditional `UPDATE`, so two simultaneous `/start`
presses cannot both win, and the only secrets that ever leave the server are
the public bot username and the one-time link itself.

Admins keep a fallback on the **Staff** page (the link icon) that shows the
bot link to share and still accepts a numeric user id directly.

To enable it:

1. **Create the bot** — talk to [@BotFather](https://t.me/BotFather), run `/newbot`, and
   copy the token into the backend's `TELEGRAM_BOT_TOKEN`. Put the bot's username (no
   leading `@`) in `TELEGRAM_BOT_USERNAME`.
2. **Register your domain** — in BotFather run `/setdomain`, pick the bot, and enter the
   exact domain that serves the site. The widget only renders on an HTTPS domain
   registered this way, so it will not appear on `localhost`.
3. **Done.** The login page and the Settings card read the bot username from
   `GET /api/auth/telegram-config`, so no frontend rebuild is needed once the backend
   env is set.

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/telegram-config` | Public. Reports whether the widget is enabled + the bot username |
| `POST /api/auth/telegram` | Sign in with a verified widget payload |
| `POST /api/auth/link-telegram` | Authenticated. Link the verified account to *my* login |
| `DELETE /api/auth/link-telegram` | Authenticated. Unlink *my* Telegram account |
| `POST /api/auth/telegram-link` | Authenticated. Mint a one-time linking deep link for *my* login |
| `GET /api/auth/telegram-link/:token` | Authenticated. Poll my link: `pending`, `used`, `expired`, `invalid`, `unavailable` |

#### "This Telegram account is not linked to a BIS NOC staff login"

Telegram signed the identity successfully, but no staff row carries that
Telegram id yet. The message names the account that was used
(`@username · id 123456789`), and the same id is shown on
**Settings → Telegram** and in the bot's "✅ Linked" confirmation, so the
three can be compared directly:

| What you see | What it means | Fix |
|---|---|---|
| Different `id` at sign-in than the bot's "✅ Linked … Telegram: id …" | You linked one Telegram account but are signing in with another (e.g. the office PC's Telegram) | Sign in with email + password, open **Settings → Telegram → Create link**, and open that link **in the account you sign in with** |
| The bot says "✅ Linked … <a name/email you don't expect>" | The link was created while signed in as a different staff account | Same: create a new link from the right account (this rotates the old one) |
| Settings shows nothing linked, although the bot confirmed the link | The bot and the website are pointed at **different deployments/databases** (typically a webhook registered on a preview URL) | Re-register the webhook on the production domain: `node backend/scripts/set-telegram-webhook.js https://<prod-domain>/api/telegram/webhook` |
| Sign-in worked before and stopped | The account was unlinked (self-service, or by an admin on the Staff page) | Link again as above |

The API returns `401` with `code: "TELEGRAM_NOT_LINKED"` and
`details: { telegramId, username }` for this case, so clients can offer the
right next step instead of showing a dead end. The failure is also logged
server-side (`[auth] Telegram sign-in: no staff account is linked to telegram …`).

#### "Telegram linking is not set up on this server yet"

The linking endpoints need the `telegram_link_tokens` table. If the code is deployed before
`supabase/migrations/031_telegram_link_tokens.sql` is applied, `POST /api/auth/telegram-link`
answers **503** with that message, `GET /api/auth/telegram-config` reports
`linkEnabled: false`, and **Settings → Telegram** shows an explanatory notice instead of a
button that fails.

Fix it by pasting `supabase/migrations/031_telegram_link_tokens.sql` into the Supabase
**SQL Editor** and running it. The readiness check is cached for 60 seconds, so reload the
Settings page a minute later. No redeploy is needed.

If Supabase answers `PGRST205` ("Could not find the table … in the schema cache") right after
the migration, the schema cache has not refreshed yet — wait a moment and retry.

### Bot buttons

The inline keyboards are designed as one system — two buttons per row, a fixed
emoji lexicon, Back/Menu on every sub-screen, confirm screens for bulk writes,
and paginated lists. The full map (with screens) is in
[`docs/telegram-buttons.md`](docs/telegram-buttons.md); the rules are enforced by
`backend/tests/telegramMenus.test.js`.

### Telegram Mini App (`tma/`)

The staff Mini App is a separate React + Vite app served at **`/tma/`** by the
same Vercel deployment. It signs staff in with Telegram's Mini App `initData`
— a different HMAC scheme from the Login Widget:

```
secret_key        = HMAC_SHA256(key="WebAppData", message=<bot_token>)
data_check_string = every field except "hash", sorted by key, joined "\n"
hash              = hex(HMAC_SHA256(key=secret_key, message=data_check_string))
```

`POST /api/auth/telegram-webapp` verifies that signature with the server-side
bot token (never exposed to the browser), rejects `auth_date` values older than
24 hours or more than 5 minutes in the future, rate-limits repeated attempts
per IP, and only issues a session for a linked, active staff account.

To publish it: create the app in BotFather (`/newapp`) with the URL
`https://<your-domain>/tma/`. Full setup, local development and deployment
notes are in [`tma/README.md`](tma/README.md).

---

## Getting started

You need Node 18+ and a Supabase project.

### 1. Database

In the Supabase SQL editor, run in order:

1. `supabase/schema.sql` — tables, indexes, constraints, RLS
2. `supabase/functions.sql` — atomic transfer, attendance, staffing and messaging routines

Both are idempotent, safe to re-run, and verified by the database test suite before
they ever reach your project.

### 2. Backend

```sh
cd backend
npm install
cp .env.example .env      # then fill it in
```

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | **service_role** key — server-side only |
| `JWT_SECRET` | 32+ chars. `openssl rand -base64 48` |
| `CORS_ORIGINS` | Comma-separated, e.g. `http://localhost:3000` |

Create the school, its first academic year and the first administrator:

```sh
npm run seed
npm run dev          # http://localhost:5000
```

### 3. Frontend

```sh
cd frontend
npm install
cp .env.example .env      # REACT_APP_API_URL=http://localhost:5000
npm start                 # http://localhost:3000
```

### 4. First-run order

1. Sign in as the seeded admin
2. **Staff** → add teachers
3. **Classes** → run `cd backend && npm run setup:year` to create the 14
   classes (10 × Year 4, 4 × Year 3, capacity 30), or create them by hand
4. **Subjects** → the eight standard subjects are seeded already; add any others
5. **Assignments → Class staffing** → set each class's main and assistant
6. **Assignments → Subject teaching** → *Auto-assign main-teacher subjects*, then
   spread English, Amharic, Music, Arts, PE and French across classes
7. **Marksheets** → each teacher manages results per class, subject and term;
   a subject teacher sees one sheet per class they teach, saved in bulk
7. **Students** → enrol, then **Assignments → Students** to place any without a class
8. **Timetable** → build each class's week
9. **Calendar → Terms** → adjust the seeded term dates if needed
10. Teachers then write their **schemes of work** and **weekly lesson plans** under Planning

**Assignments → Workload** then shows each teacher's load and flags any class still
missing staff.

---

## Security model

- **Every endpoint except `POST /api/auth/login` requires a valid JWT**, with per-route
  role authorisation enforced server-side. React route guards are a usability layer,
  not the boundary.
- **Passwords are bcrypt-hashed** (cost 12) for all roles. Login timing is equalised so
  the API doesn't reveal which emails exist.
- **RLS is enabled on every table with no permissive policies** — the Supabase `anon`
  key can read nothing. Only the backend holds the service-role key.
- **No self-service registration and no guest bypass.** The first admin comes from the
  seed script; everyone else is created by an admin.
- Sessions are re-validated against the database on every request, so deactivating a
  user takes effect immediately.
- Conversations are private to their participants — admins are not auto-joined into
  every thread.
- Rate limiting: 10 failed logins per IP+email per 15 min; 300 API requests per IP.
- Helmet security headers are enabled, `X-Powered-By` is disabled, and production CSP
  allows API connections only to the configured Supabase/backend origins.
- CORS uses exact origin matching plus safe local/Arena preview host checks in
  non-production; substring lookalikes such as `localhost.evil.example` are rejected.

---

## Testing

```sh
cd backend
npm test          # everything (367 tests)
npm run test:api  # API layer only
npm run test:db   # database layer only
```

Two layers, both offline — no Supabase project, no Docker, no external server.

**API tests (323)** run the Express app against a stubbed Supabase client: authentication,
token handling, role authorisation on every protected route, input validation, password
hashing, teaching assignments, timetable visibility per role, teacher rotation, student
placement, scheme and lesson-plan ownership, the submit/review workflow, calendar
audience targeting, thread privacy, task permissions, notice targeting, the dashboard
data-flow rollups, and Telegram widget sign-in with self-service account linking
(signature verification, replay rejection, duplicate-link conflicts).

**Database tests (44)** apply `schema.sql` and `functions.sql` to a **real PostgreSQL 18
engine** (PGlite, Postgres compiled to WebAssembly) and exercise what a stub cannot:

- every `CHECK`, `UNIQUE` and foreign-key constraint
- the `EXCLUDE USING GIST` rules — overlapping terms, class double-booking, teacher
  double-booking — including that back-to-back periods are still allowed
- triggers: `updated_at`, timetable denormalisation, teacher-reassignment cascade
- every PL/pgSQL function: transfers, rotation, capacity, attendance upsert, fines,
  scheme scaffolding, review workflow
- cascade behaviour, e.g. deleting a class removes its events but leaves its pupils
  unassigned rather than deleted

The two layers cover different failure modes: the stub catches wrong HTTP behaviour, the
real engine catches wrong SQL.

---

## Layout

```
backend/
  api/index.js         Vercel serverless entry
  app.js               Express app
  server.js            Local / long-running entry point
  config/              Env validation + Supabase client
  controllers/         One module per domain
  middleware/          auth, security, error handling
  routes/index.js      The complete API surface
  scripts/seed.js      First-run bootstrap
  tests/
frontend/src/
  api/                 Axios client (token interceptor) + endpoint wrappers
  auth/                AuthContext + route guard
  components/          Layout and shared UI
  hooks/useApi.js      Fetch/loading/error handling
  pages/               One page per module
supabase/
  schema.sql
  functions.sql
```

## CI/CD

The repository includes a ready-to-enable GitHub Actions workflow template at
`docs/ci/github-actions.yml.example`. Copy it to `.github/workflows/ci.yml` in an
environment with GitHub workflow permissions to run it on pull requests and pushes to
`main` or `arena/**` branches. The template covers:

- **Backend job:** `npm ci`, the full API/database test suite, then a high-severity
  production dependency audit.
- **Frontend job:** `npm ci`, React tests, a production build with CI warnings enforced,
  then a critical-severity production dependency audit.
- npm caching keyed by each package lockfile and cancellation of superseded runs on the
  same branch.

## Deployment

Both halves deploy to Vercel from their own directory. Set the environment variables in
the dashboard — `CORS_ORIGINS` on the backend must include the deployed frontend URL,
and `REACT_APP_API_URL` on the frontend must point at the deployed backend.

For **Telegram sign-in** in production, also set `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_BOT_USERNAME` on the backend and register the deployed domain with
`@BotFather → /setdomain` — the widget only renders on that exact HTTPS domain.

**Daily attendance** runs on school time — Addis Ababa, GMT+3 — throughout the app.
From 08:45 on school days, class teachers whose register isn't in are reminded (in the
bell, and on Telegram if they've linked it) and the office gets one digest of missing
registers. The first bell refresh after 08:45 sends them; the Vercel cron in
`vercel.json` (`/api/cron/attendance-reminders`, weekdays at 09:00 school time) is the
backstop for when nobody is online. Set `CRON_SECRET` on the backend so only Vercel can
call the cron, and optionally `ATTENDANCE_REMINDER_TIME` (default `08:45`).
