/**
 * Inline keyboards for @bisnocbot — one place for every button.
 *
 * DESIGN RULES (kept testable in tests/telegramMenus.test.js)
 *
 *  1. Two buttons per row at most; a single full-width button for the one
 *     primary action on a screen (longer labels, easier to hit on a phone).
 *  2. Fixed chrome. Sub-screens end with `⬅️ Back` + `🏠 Menu`; top-level
 *     screens end with `🏠 Menu` alone. Back always goes to the parent and
 *     never re-runs an action, so a stray tap can never repeat a write.
 *  3. Verb-first labels from a fixed emoji lexicon:
 *        🏠 menu   📅 today   🏫 classes   👥 pupils   ✅ confirm/act
 *        📢 notices   🌐 web app   🔄 refresh   ⬅️ back   ✖️ cancel
 *  4. Toggles show their *state* with a glyph, not their outcome:
 *        ☐ task still open   ☑ task done
 *     The toast after the tap says what changed.
 *  5. Irreversible or bulk writes get a confirm screen that names the object
 *     and the exact count. Cancel returns to the parent screen.
 *  6. Lists paginate instead of truncating silently: `‹ Prev`/`Next ›` plus
 *     "showing 1–8 of 23" in the message text.
 *  7. callback_data is `area[:action][:id][:page]`, ASCII, and must stay
 *     under Telegram's 64-byte limit (asserted for every button).
 *
 * Builders are pure: everything they need (dates, counts, rows) is passed in,
 * so the whole keyboard map can be unit-tested without a database.
 */

/** Telegram's hard limit on callback_data, in bytes. */
const MAX_CALLBACK_BYTES = 64;

/** Total characters Telegram accepts in a message; we aim well below it. */
const MAX_MESSAGE_CHARS = 4096;

const btn = (text, callback_data) => ({ text, callback_data });
const urlBtn = (text, url) => ({ text, url });
const kb = (rows) => ({ inline_keyboard: rows.filter((row) => row.length > 0) });

/** Shorten a label without splitting a word awkwardly. */
const trunc = (value, max) => {
    const s = String(value ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

/** Byte length of a callback payload (UTF-8). */
const callbackBytes = (data) => Buffer.byteLength(String(data), 'utf8');

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const MENU_ROW = [btn('🏠 Menu', 'menu')];
const backBtn = (callback_data, label = '⬅️ Back') => btn(label, callback_data);

/** Standard footer: Back + Menu (sub-screens) or Menu alone (top level). */
const nav = ({ back } = {}) => (back ? [[backBtn(back)], MENU_ROW] : [MENU_ROW]);

/** Back + Menu on one row — used where vertical space matters and both fit. */
const navTight = ({ back } = {}) => {
    if (!back) return [MENU_ROW];
    return [[backBtn(back), btn('🏠 Menu', 'menu')]];
};

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------
/**
 * Slice `items` into a page and build the pager row.
 *
 * @param {Array} items
 * @param {number} page 1-based; clamped into range.
 * @param {number} per
 * @param {{base: string, label?: (item:any, i:number) => any}} opts
 *   `base` is the callback prefix, e.g. 'nt' -> buttons 'nt:<page>'.
 */
const paginate = (items, page, per, { base, rowFor }) => {
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (current - 1) * per;
    const slice = items.slice(start, start + per);

    const rows = slice.map((item, i) => [rowFor(item, start + i)].filter(Boolean));

    if (pages > 1) {
        const pager = [];
        if (current > 1) pager.push(btn('‹ Prev', `${base}:${current - 1}`));
        pager.push(btn(`${current}/${pages}`, `${base}:${current}`));
        if (current < pages) pager.push(btn('› Next', `${base}:${current + 1}`));
        rows.push(pager);
    }

    return {
        items: slice,
        page: current,
        pages,
        total,
        from: total === 0 ? 0 : start + 1,
        to: Math.min(start + per, total),
        rows,
    };
};

/** "showing 1–8 of 23" (nothing when it all fits). */
const rangeLabel = (p) => (p.pages > 1 ? `showing ${p.from}–${p.to} of ${p.total}` : '');

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/**
 * Top-level menu. Two rows of two keeps every destination one tap away
 * without the vertical scroll the old one-per-row menu caused.
 */
function buildMainMenu({ firstName = 'there', isTeacher = true, webAppUrl } = {}) {
    const text = `👋 Hello ${firstName}!\n\nWhat would you like to do?`;

    const rows = [
        [btn('📅 Today', 'today'), btn('🏫 Classes', 'cls')],
    ];
    if (isTeacher) rows.push([btn('✅ Attendance', 'at'), btn('📢 Notices', 'nt')]);
    else rows.push([btn('📢 Notices', 'nt')]);
    if (webAppUrl) rows.push([urlBtn('🌐 Open the web app', webAppUrl)]);

    return { text, replyMarkup: kb(rows) };
}

/** Today: lessons, then one toggle row per pending task. */
function buildToday({ dayLabel, slots = [], tasks = [], openTasks = 0 } = {}) {
    let text = `📅 Today — ${dayLabel}\n`;

    if (slots.length) {
        text += '\n🕒 Lessons\n';
        slots.forEach((s) => {
            const subject = s.assignment?.subject?.name || 'Lesson';
            const className = s.class?.name || '';
            text += `• ${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)}  ${subject}`;
            if (className) text += ` (${className})`;
            if (s.room) text += ` · ${s.room}`;
            text += '\n';
        });
    } else {
        text += '\n🕒 No lessons scheduled today.\n';
    }

    text += '\n✅ Tasks\n';
    if (tasks.length) {
        tasks.slice(0, 8).forEach((t) => {
            const box = t.status === 'done' ? '☑' : '☐';
            text += `${box} ${t.title}${t.due_on ? ` — due ${t.due_on}` : ''}\n`;
        });
    } else {
        text += '• Nothing pending. 🎉\n';
    }
    if (openTasks > tasks.slice(0, 8).length) {
        text += `\n…and ${openTasks - tasks.slice(0, 8).length} more in the web app.\n`;
    }

    const rows = tasks.slice(0, 8).map((t) => [
        btn(`${t.status === 'done' ? '☑' : '☐'} ${trunc(t.title, 30)}`, `task:done:${t.id}`),
    ]);
    rows.push([btn('🔄 Refresh', 'today')]);
    rows.push(...navTight());

    return { text, replyMarkup: kb(rows) };
}

/**
 * "Which class?" — used by the Classes screen and by the Attendance shortcut.
 *
 * `rowPrefix` decides where a tap lands: `c:` opens the class, `ca:` goes
 * straight to that class's attendance. Paging always uses `pageBase`.
 */
function buildClassPicker({
    classes = [],
    title = '🏫 Your classes',
    back = 'menu',
    rowPrefix = 'c',
    pageBase = 'cls',
    icon = '🏫',
} = {}) {
    let text = `${title}\n\n`;
    if (classes.length) classes.forEach((c) => (text += `• ${c.name}\n`));
    else text += 'You are not a main teacher of any class this year.\n';

    const rows = paginate(classes, 1, 10, {
        base: pageBase,
        rowFor: (c) => btn(`${icon} ${trunc(c.name, 26)}`, `${rowPrefix}:${c.id}`),
    }).rows;

    rows.push(...nav({ back }));
    return { text, replyMarkup: kb(rows) };
}

/** One class: the two things a teacher does from the bus. */
function buildClassDetail({ klass, studentCount = 0, webAppUrl } = {}) {
    const name = klass?.name || 'Class';
    const text = `🏫 ${name}\n👥 ${studentCount} pupil${studentCount === 1 ? '' : 's'}`;

    const rows = [[btn('👥 Pupils', `cs:${klass.id}`), btn('✅ Attendance', `ca:${klass.id}`)]];
    if (webAppUrl) rows.push([urlBtn('🌐 Open the class', webAppUrl)]);
    const replyMarkup = kb([...rows, ...navTight({ back: 'cls' })]);
    return { text, replyMarkup };
}

/** Pupil roster, paginated — long classes no longer lose their tail. */
function buildRoster({ students = [], klassName = 'Class', classId, page = 1, back } = {}) {
    const p = paginate(students, page, 15, {
        base: `cs:${classId}`,
        rowFor: () => null, // roster entries are text, not buttons
    });

    let text = `👥 ${klassName} — ${students.length} pupils`;
    if (rangeLabel(p)) text += ` (${rangeLabel(p)})`;
    text += '\n\n';
    p.items.forEach((s, i) => {
        text += `${p.from + i}. ${s.name}${s.admission_no ? ` (${s.admission_no})` : ''}\n`;
    });

    return {
        text,
        replyMarkup: kb([...p.rows, ...nav({ back: back || 'cls' })]),
    };
}

/** Attendance options for one class. */
function buildAttendanceOptions({ klass, dayLabel, back, registerUrl } = {}) {
    const name = klass?.name || 'class';
    const text =
        `✅ Attendance — ${name}\n${dayLabel}\n\n` +
        'Mark the whole class present in one tap, or open the register to record absences and lateness.';

    const rows = [[btn('✅ Mark all present', `ap:${klass.id}`)]];
    if (registerUrl) rows.push([urlBtn('🌐 Open the register', registerUrl)]);
    const replyMarkup = kb([...rows, ...navTight({ back: back || `c:${klass.id}` })]);
    return { text, replyMarkup };
}

/**
 * Confirm before a bulk write. Names the class, the day and the exact number
 * of pupils, because "mark all present" is otherwise a one-tap, hard-to-spot
 * mistake for 29 records.
 */
function buildAttendanceConfirm({ klass, dayLabel, count = 0 } = {}) {
    const name = klass?.name || 'this class';
    const text =
        `⚠️ Mark all present?\n\n` +
        `🏫 ${name}\n📅 ${dayLabel}\n\n` +
        `This records ${count} pupil${count === 1 ? '' : 's'} as present. ` +
        'You can still change individual pupils in the web app.';

    const replyMarkup = kb([
        [btn(`✅ Yes — ${count} present`, `ap:${klass.id}:y`)],
        [backBtn(`ap:${klass.id}:n`, '✖️ Cancel')],
    ]);
    return { text, replyMarkup };
}

/** Notices, paginated, with one acknowledge button per notice that needs it. */
function buildNotices({ notices = [], acked = new Set(), page = 1 } = {}) {
    const pending = notices.filter((n) => n.requires_ack && !acked.has(n.id));
    const p = paginate(notices, page, 5, {
        base: 'nt',
        rowFor: (n) => {
            const needsAck = n.requires_ack && !acked.has(n.id);
            return needsAck ? btn(`☑ Acknowledge · ${trunc(n.title, 15)}`, `na:${n.id}`) : null;
        },
    });

    let text = '📢 Notices';
    if (pending.length) text += ` — ${pending.length} need${pending.length === 1 ? 's' : ''} you`;
    text += '\n';
    if (rangeLabel(p)) text += `${rangeLabel(p)}\n`;
    text += '\n';

    if (p.items.length) {
        p.items.forEach((n) => {
            const flag = n.requires_ack && !acked.has(n.id) ? '  ⚠️ needs acknowledgement'
                : n.requires_ack ? '  ✓ acknowledged' : '';
            text += `• ${n.title}${flag}\n`;
        });
    } else {
        text += 'Nothing new.\n';
    }

    return { text, replyMarkup: kb([...p.rows, ...nav({ back: 'menu' })]) };
}

/** Confirm acknowledging one notice — it is a permanent record. */
function buildNoticeConfirm({ notice } = {}) {
    const title = notice?.title || 'this notice';
    const text =
        `📢 Acknowledge this notice?\n\n` +
        `"${trunc(title, 120)}"\n\n` +
        'The office will see that you have read it. It cannot be undone here.';

    const replyMarkup = kb([
        [btn('✅ Acknowledge', `na:${notice.id}:y`)],
        [backBtn(`na:${notice.id}:n`, '✖️ Cancel')],
    ]);
    return { text, replyMarkup };
}

/** Generic informational screen (unlinked, no classes, errors) with an escape. */
function buildInfo({ text, rows = [], back = 'menu' } = {}) {
    return { text, replyMarkup: kb([...rows, ...nav({ back })]) };
}

module.exports = {
    MAX_CALLBACK_BYTES,
    MAX_MESSAGE_CHARS,
    btn,
    urlBtn,
    kb,
    trunc,
    callbackBytes,
    paginate,
    nav,
    navTight,
    buildMainMenu,
    buildToday,
    buildClassPicker,
    buildClassDetail,
    buildRoster,
    buildAttendanceOptions,
    buildAttendanceConfirm,
    buildNotices,
    buildNoticeConfirm,
    buildInfo,
};
