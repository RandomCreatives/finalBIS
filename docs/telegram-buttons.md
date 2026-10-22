# Inline buttons — @bisnocbot

The bot is used one-handed, on a phone, often in a corridor between lessons.
Every decision below comes from that: fewer taps, bigger targets, no dead ends,
and nothing destructive behind a single stray thumb.

All buttons are built in [`backend/services/telegramMenus.js`](../backend/services/telegramMenus.js);
the rules are enforced by [`backend/tests/telegramMenus.test.js`](../backend/tests/telegramMenus.test.js),
so a new screen cannot quietly break them.

---

## The rules

| Rule | Why |
|---|---|
| **Two buttons per row, max** | Full-width rows waste the screen; three-up shrinks the tap target below a comfortable thumb size. |
| **One primary action per screen, full width** | "Mark all present" is the reason the teacher opened the bot; it gets the whole row. |
| **`⬅️ Back` always goes to the parent** | Back never re-runs an action, so a double tap can't repeat a write. |
| **`🏠 Menu` closes every sub-screen** | Two taps from anywhere to the top. |
| **Verb-first labels, fixed emoji lexicon** | The same icon always means the same thing across screens. |
| **Toggles show state, not outcome** | `☐` open / `☑` done — the toast says what changed. |
| **Writes ask first** | Bulk or permanent actions get a confirm screen naming the object and the exact count. |
| **Lists paginate** | `‹ Prev` / `› Next` plus "showing 1–5 of 7". Nothing is silently dropped. |
| **Every tap answers** | Spinner-toast on success, alert only on failure — never a dead button. |
| **Old keyboards keep working** | Telegram keeps old messages forever; every legacy callback still resolves. |

### Emoji lexicon

| Icon | Meaning |
|---|---|
| 🏠 | back to the menu |
| ⬅️ | back to the parent screen |
| 📅 | today (lessons + tasks) |
| 🏫 | classes |
| 👥 | pupils / roster |
| ✅ | act on attendance (and the confirm button) |
| 📢 | notices |
| 🌐 | open the web app (always a URL button) |
| 🔄 | refresh this screen |
| ✖️ | cancel |
| ☐ / ☑ | task open / task done |
| ‹ › | pagination |

---

## Screens

### 1 · Menu — `menu` / `/start`

```
👋 Hello Meron!

What would you like to do?

 ┌──────────────┬──────────────┐
 │   📅 Today   │  🏫 Classes  │
 ├──────────────┼──────────────┤
 │ ✅ Attendance│  📢 Notices  │
 ├──────────────┴──────────────┤
 │      🌐 Open the web app    │
 └─────────────────────────────┘
```

Previously four stacked full-width rows. Two rows of two doubles the number of
destinations visible without scrolling, and **✅ Attendance** is new here — the
most common daily action was three taps deep.

Staff who cannot record attendance (store, library, clinic) do not see it.

### 2 · Today — `today`

```
📅 Today — Thursday 22 Oct

🕒 Lessons
• 08:30–09:10  Mathematics (Year 4 - Magenta) · R12
• 10:30–11:10  Science (Year 4 - Magenta)

✅ Tasks
☐ Mark the register — due 2026-10-30
☑ Sports day photos

 ┌─────────────────────────────┐
 │ ☐ Mark the register         │
 ├─────────────────────────────┤
 │ ☑ Sports day photos         │
 ├─────────────────────────────┤
 │         🔄 Refresh          │
 ├─────────────────────────────┤
 │           🏠 Menu           │
 └─────────────────────────────┘
```

The button label is the object with its **state**, not the outcome — the old
`✅ <task title>` implied the task was already done. Tasks completed earlier
today stay on the screen so a mis-tap can be undone with a second tap.

### 3 · Classes — `cls`

```
🏫 Your classes

• Year 4 - Magenta
• Year 4 - Violet

 ┌──────────────────────┬──────────────────────┐
 │   🏫 Year 4 - Magenta│   🏫 Year 4 - Violet │
 ├──────────────────────┴──────────────────────┤
 │                    🏠 Menu                  │
 └─────────────────────────────────────────────┘
```

### 4 · Class — `c:<id>`

```
🏫 Year 4 - Magenta
👥 29 pupils

 ┌──────────────┬──────────────┐
 │  👥 Pupils   │ ✅ Attendance│
 ├──────────────┴──────────────┤
 │      🌐 Open the class      │
 ├──────────────┬──────────────┤
 │   ⬅️ Back    │   🏠 Menu    │
 └──────────────┴──────────────┘
```

### 5 · Roster — `cs:<id>[:page]`

```
👥 Year 4 - Magenta — 37 pupils (showing 1–15 of 37)

1. Abebe Tesfaye (BIS-1)
…

 ┌─────────────────────────────┐
 │ 1/3  › Next                 │
 ├─────────────────────────────┤
 │   ⬅️ Back    │   🏠 Menu    │
 └─────────────────────────────┘
```

The old roster cut off at 30 pupils with "…and N more" and no way to see them.

### 6 · Attendance — `ca:<id>`

```
✅ Attendance — Year 4 - Magenta
Thursday 22 Oct

Mark the whole class present in one tap, or open the register to record
absences and lateness.

 ┌─────────────────────────────┐
 │     ✅ Mark all present     │
 ├─────────────────────────────┤
 │    🌐 Open the register     │
 ├──────────────┬──────────────┤
 │   ⬅️ Back    │   🏠 Menu    │
 └──────────────┴──────────────┘
```

### 7 · Confirm — `ap:<id>` → `ap:<id>:y` / `ap:<id>:n`

```
⚠️ Mark all present?

🏫 Year 4 - Magenta
📅 Thursday 22 Oct

This records 29 pupils as present. You can still change individual pupils in
the web app.

 ┌─────────────────────────────┐
 │      ✅ Yes — 29 present    │
 ├─────────────────────────────┤
 │          ✖️ Cancel          │
 └─────────────────────────────┘
```

**This is the change I would not ship without.** One tap used to write 29
attendance records — the single most damaging mis-tap possible in this bot.
The guard runs on the *first* tap, so a locked month or a non-teacher is
refused before the screen even appears; the write re-checks when confirmed,
because a month can be submitted while the screen sits open.

### 8 · Notices — `nt[:page]`

```
📢 Notices — 2 need you
showing 1–5 of 7

• Staff meeting on Friday  ⚠️ needs acknowledgement
• Sports day photos

 ┌─────────────────────────────┐
 │  ☑ Acknowledge · Staff mee… │
 ├─────────────────────────────┤
 │ 1/2  › Next                 │
 ├─────────────────────────────┤
 │           🏠 Menu           │
 └─────────────────────────────┘
```

### 9 · Acknowledge — `na:<id>` → `na:<id>:y` / `na:<id>:n`

```
📢 Acknowledge this notice?

"Staff meeting on Friday"

The office will see that you have read it. It cannot be undone here.

 ┌─────────────────────────────┐
 │       ✅ Acknowledge        │
 ├─────────────────────────────┤
 │          ✖️ Cancel          │
 └─────────────────────────────┘
```

---

## Callback reference

`area[:action][:id][:page]` — ASCII, ≤ 64 bytes (Telegram's limit), asserted
for every button that can be rendered.

| Callback | Screen |
|---|---|
| `menu` | main menu |
| `today` | today |
| `task:done:<id>` | toggle a task, re-render today |
| `cls`, `cls:<page>` | class list |
| `c:<classId>` | class detail |
| `cs:<classId>[:page]` | roster |
| `at`, `at:<page>` | attendance shortcut (straight in when there is one class) |
| `ca:<classId>` | attendance options |
| `ap:<classId>` | **ask** to mark all present |
| `ap:<classId>:y` / `:n` | confirm / cancel |
| `nt`, `nt:<page>` | notices |
| `na:<noticeId>` | **ask** to acknowledge |
| `na:<noticeId>:y` / `:n` | confirm / cancel |

Any other payload answers with a toast and reopens the menu — a stale keyboard
can never leave the user stuck.

---

## Deliberate omissions

- **No "Undo" after marking present.** `mark_attendance` upserts a whole
  month; undoing it safely needs a server-side delete scoped to the exact rows
  this tap created. Until that exists, the confirm screen is the safeguard and
  individual pupils are corrected in the web app.
- **No inline navigation into registers.** Deep screens belong in the web app;
  the bot stays four taps deep at most.
- **No per-pupil attendance buttons.** 29 rows of buttons is not a phone UI.
