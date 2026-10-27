/**
 * Inline keyboards for @bisnocbot — one place for every button.
 *
 * DESIGN RULES (kept testable in tests/telegramMenus.test.js)
 *
 *  1. Two buttons per row at most (three only for compact pagers / weekday
 *     switchers); a single full-width button for primary actions.
 *  2. Fixed chrome. Sub-screens end with `⬅️ Back` + `🏠 Menu`; top-level
 *     screens end with `🏠 Menu` alone. Back always goes to the parent and
 *     never re-runs an action, so a stray tap can never repeat a write.
 *  3. Verb-first labels from a fixed emoji lexicon (`LEXICON`).
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

/** Shared emoji lexicon — every non-pager button starts with one of these. */
const LEXICON = [
    '🏠', '📅', '🏫', '👥', '✅', '📢', '🌐', '🔄',
    '⬅️', '✖️', '☐', '☑', '⚠️', '‹', '›',
    '📊', '📝', '📖', '👤',
];

const SHORT_WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const STATUS_META = {
    present: { icon: '✅', label: 'Present', next: 'a' },
    absent: { icon: '✖️', label: 'Absent', next: 'l' },
    late: { icon: '⚠️', label: 'Late', next: 'e' },
    excused: { icon: '☑', label: 'Excused', next: 'p' },
    unmarked: { icon: '☐', label: '', next: 'a' },
};

const btn = (text, callback_data) => ({ text, callback_data });
const urlBtn = (text, url) => ({ text, url });
const webAppBtn = (text, url) => ({ text, web_app: { url } });
const kb = (rows) => ({ inline_keyboard: rows.filter((row) => row.length > 0) });

/** Shorten a label without splitting a word awkwardly. */
const trunc = (value, max) => {
    const s = String(value ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

/** Byte length of a callback payload (UTF-8). */
const callbackBytes = (data) => Buffer.byteLength(String(data), 'utf8');

/** Group flat items into rows of `size`. */
const chunk = (list, size = 2) => {
    const out = [];
    for (let i = 0; i < list.length; i += size) {
        out.push(list.slice(i, i + size));
    }
    return out;
};

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
 * @param {{base: string, rowFor: (item:any, index:number, current:number) => any}} opts
 *   `base` is the callback prefix, e.g. 'nt' -> buttons 'nt:<page>'.
 *   `rowFor` may return one button, an array of buttons for that row, or null.
 */
const paginate = (items, page, per, { base, rowFor }) => {
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (current - 1) * per;
    const slice = items.slice(start, start + per);

    const rows = slice.map((item, i) => {
        const built = rowFor(item, start + i, current);
        return (Array.isArray(built) ? built : [built]).filter(Boolean);
    });

    const pager = [];
    if (pages > 1) {
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
        pager,
    };
};

/** "showing 1–8 of 23" (nothing when it all fits). */
const rangeLabel = (p) => (p.pages > 1 ? `showing ${p.from}–${p.to} of ${p.total}` : '');

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/**
 * Role-aware top-level menu.
 *
 * Keeps the familiar two-up primary grid while tailoring shortcuts by role:
 *  - Main / Assistant teachers: Today · Classes / Attendance · Notices (+ Marksheets for main)
 *  - Subject teachers: Today · My classes / Marksheets (Mini App) · Notices (no Attendance)
 *  - Admins: Today · Classes / Attendance · Notices / School pulse
 */
function buildMainMenu({
    firstName = 'there',
    isTeacher = true,
    role = null,
    webAppUrl,
    miniAppUrl,
    marksAppUrl,
} = {}) {
    const text = `👋 Hello ${firstName}!\n\nWhat would you like to do?`;

    const isSubjectTeacher = role === 'subject_teacher';
    const isAdmin = role === 'admin';
    const isMainTeacher = role === 'main_teacher';

    const rows = [
        [
            btn('📅 Today', 'today'),
            btn(isSubjectTeacher ? '🏫 My classes' : '🏫 Classes', 'cls'),
        ],
    ];

    if (isSubjectTeacher) {
        if (marksAppUrl) {
            rows.push([webAppBtn('📊 Marksheets', marksAppUrl), btn('📢 Notices', 'nt')]);
        } else {
            rows.push([btn('📢 Notices', 'nt')]);
        }
    } else if (isTeacher) {
        rows.push([btn('✅ Attendance', 'at'), btn('📢 Notices', 'nt')]);
    } else {
        rows.push([btn('📢 Notices', 'nt')]);
    }

    if (webAppUrl && miniAppUrl) {
        rows.push([urlBtn('🌐 Open the web app', webAppUrl), webAppBtn('🌐 Mini App', miniAppUrl)]);
    } else if (webAppUrl) {
        rows.push([urlBtn('🌐 Open the web app', webAppUrl)]);
    } else if (miniAppUrl) {
        rows.push([webAppBtn('🌐 Open Mini App', miniAppUrl)]);
    }

    if (isAdmin) {
        rows.push([btn('📊 School pulse', 'pulse')]);
    } else if (isMainTeacher && marksAppUrl) {
        rows.push([webAppBtn('📊 Marksheets', marksAppUrl)]);
    }

    return { text, replyMarkup: kb(rows) };
}

/**
 * Today / Weekday Timetable: lessons for the selected weekday (`dow` 1..7),
 * open tasks with inline completion toggles, and a Mon–Fri day switcher.
 */
function buildToday({
    dayLabel,
    slots = [],
    tasks = [],
    openTasks = 0,
    dow = null,
    isToday = true,
} = {}) {
    const headerIcon = isToday ? '📅 Today' : '📅 Schedule';
    let text = `${headerIcon} — ${dayLabel}\n`;

    if (slots.length) {
        text += '\n🕒 Lessons\n';
        slots.forEach((s) => {
            const subject = s.assignment?.subject?.name || s.subject?.name || 'Lesson';
            const className = s.class?.name || '';
            text += `• ${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)}  ${subject}`;
            if (className) text += ` (${className})`;
            if (s.room) text += ` · ${s.room}`;
            text += '\n';
        });
    } else {
        text += isToday
            ? '\n🕒 No lessons scheduled today.\n'
            : '\n🕒 No lessons scheduled on this day.\n';
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

    if (Number.isInteger(dow) && dow >= 1 && dow <= 7) {
        if (dow >= 1 && dow <= 5) {
            const prev = dow === 1 ? 5 : dow - 1;
            const next = dow === 5 ? 1 : dow + 1;
            const refreshCb = isToday ? 'today' : `day:${dow}`;
            rows.push([
                btn(`‹ ${SHORT_WEEKDAYS[prev]}`, `day:${prev}`),
                btn('🔄 Refresh', refreshCb),
                btn(`› ${SHORT_WEEKDAYS[next]}`, `day:${next}`),
            ]);
            if (!isToday) {
                rows.push([btn('📅 Back to today', 'today')]);
            }
        } else {
            rows.push([
                btn('‹ Fri', 'day:5'),
                btn('🔄 Refresh', 'today'),
                btn('› Mon', 'day:1'),
            ]);
        }
    } else {
        rows.push([btn('🔄 Refresh', 'today')]);
    }

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
    emptyText = 'You have no classes assigned this academic year.',
    back = 'menu',
    rowPrefix = 'c',
    page = 1,
    pageBase = 'cls',
    icon = '🏫',
} = {}) {
    const p = paginate(classes, page, 10, {
        base: pageBase,
        rowFor: (c) => btn(`${icon} ${trunc(c.buttonLabel || c.name, 26)}`, `${rowPrefix}:${c.id}`),
    });

    let text = `${title}\n`;
    if (rangeLabel(p)) text += `${rangeLabel(p)}\n`;
    text += '\n';

    if (p.items.length) {
        p.items.forEach((c) => {
            text += `• ${c.name}${c.subtitle ? ` · ${c.subtitle}` : ''}\n`;
        });
    } else {
        text += `${emptyText}\n`;
    }

    const rows = [...p.rows, ...nav({ back })];
    return { text, replyMarkup: kb(rows) };
}

/** One class: roster, homeroom attendance (if eligible), or direct marksheet link. */
function buildClassDetail({
    klass,
    studentCount = 0,
    subjects = [],
    webAppUrl,
    miniAppUrl,
    marksheetUrl,
    canTakeAttendance = true,
} = {}) {
    const name = klass?.name || 'Class';
    let text = `🏫 ${name}\n👥 ${studentCount} pupil${studentCount === 1 ? '' : 's'}`;
    if (subjects.length) {
        text += `\n📖 Subject${subjects.length === 1 ? '' : 's'}: ${subjects.join(', ')}`;
    }

    const actionRow = canTakeAttendance
        ? [btn('👥 Pupils', `cs:${klass.id}`), btn('✅ Attendance', `ca:${klass.id}`)]
        : marksheetUrl
            ? [btn('👥 Pupils', `cs:${klass.id}`), webAppBtn('📊 Marksheet', marksheetUrl)]
            : [btn('👥 Pupils', `cs:${klass.id}`)];

    const rows = [actionRow];
    if (canTakeAttendance && marksheetUrl) {
        rows.push([webAppBtn('📊 Open marksheet', marksheetUrl)]);
    }
    if (webAppUrl && miniAppUrl) {
        rows.push([urlBtn('🌐 Open the class', webAppUrl), webAppBtn('🌐 Mini App', miniAppUrl)]);
    } else if (webAppUrl) {
        rows.push([urlBtn('🌐 Open the class', webAppUrl)]);
    } else if (miniAppUrl) {
        rows.push([webAppBtn('🌐 Open Mini App', miniAppUrl)]);
    }

    const replyMarkup = kb([...rows, ...navTight({ back: 'cls' })]);
    return { text, replyMarkup };
}

/**
 * Paginated pupil roster with two-up pupil buttons that open guardian
 * contact cards (`st:<studentId>:<page>`).
 */
function buildRoster({ students = [], klassName = 'Class', classId, page = 1, back } = {}) {
    const p = paginate(students, page, 15, {
        base: `cs:${classId}`,
        rowFor: () => null,
    });

    let text = `👥 ${klassName} — ${students.length} pupil${students.length === 1 ? '' : 's'}`;
    if (rangeLabel(p)) text += ` (${rangeLabel(p)})`;
    text += '\n\n';
    p.items.forEach((s, i) => {
        const sen = s.special_needs ? ' · SEN' : '';
        text += `${p.from + i}. ${s.name}${s.admission_no ? ` (${s.admission_no})` : ''}${sen}\n`;
    });
    if (p.items.length) {
        text += '\nTap a pupil below for guardian contact details.';
    }

    const pupilButtons = p.items
        .filter((s) => s?.id)
        .map((s, i) => btn(`👤 ${p.from + i}. ${trunc(s.name, 12)}`, `st:${s.id}:${p.page}`));
    const rows = [...chunk(pupilButtons, 2)];
    if (p.pager.length) rows.push(p.pager);
    rows.push(...nav({ back: back || 'cls' }));

    return {
        text,
        replyMarkup: kb(rows),
    };
}

/** Single pupil profile & guardian contact card (`st:<studentId>:<page>`). */
function buildStudentDetail({ student, klassName = 'Class', back = 'cls' } = {}) {
    const name = student?.name || 'Pupil';
    let text = `👤 ${name}\n🏫 ${klassName}`;
    if (student?.admission_no) text += ` · ${student.admission_no}`;
    if (student?.roll_num != null) text += ` · Roll #${student.roll_num}`;
    text += '\n';

    if (student?.special_needs) {
        text += `\n⚠️ SEN support${student.sen_teacher_name ? ` — ${student.sen_teacher_name}` : ''}`;
        if (student.special_needs_note) {
            text += `\n   ${trunc(student.special_needs_note, 180)}`;
        }
        text += '\n';
    }

    text += '\n👪 Guardian Contact\n';
    text += `• Name: ${student?.guardian_name || 'Not recorded'}\n`;
    text += `• Phone: ${student?.guardian_phone || 'Not recorded'}\n`;
    if (student?.guardian_email) {
        text += `• Email: ${student.guardian_email}\n`;
    }

    return {
        text,
        replyMarkup: kb(navTight({ back })),
    };
}

/** Attendance hub for one class, with live status + inline & Mini App options. */
function buildAttendanceOptions({
    klass,
    dayLabel,
    summary = null,
    back,
    registerUrl,
    miniAppRegisterUrl,
} = {}) {
    const name = klass?.name || 'class';
    let text = `✅ Attendance — ${name}\n${dayLabel}\n\n`;

    if (summary) {
        if (summary.marked > 0) {
            text +=
                `📊 Today: ${summary.present} present · ${summary.absent} absent · ` +
                `${summary.late} late${summary.excused ? ` · ${summary.excused} excused` : ''} ` +
                `(${summary.marked}/${summary.total} marked)\n`;
            if (summary.exceptions?.length) {
                summary.exceptions.slice(0, 6).forEach((ex) => {
                    const meta = STATUS_META[ex.status] || STATUS_META.absent;
                    text += `  ${meta.icon} ${ex.name} — ${meta.label}\n`;
                });
                if (summary.exceptions.length > 6) {
                    text += `  …and ${summary.exceptions.length - 6} more\n`;
                }
            }
            text += '\n';
        } else {
            text += `⏳ Not recorded yet today (${summary.total} pupil${summary.total === 1 ? '' : 's'}).\n\n`;
        }
    }

    text += 'Mark everyone present in one tap, tap individual absences/lateness inline, or open the full register.';

    const rows = [
        [btn('✅ Mark all present', `ap:${klass.id}`)],
        [btn('📝 Mark absences / late', `ar:${klass.id}:1`)],
    ];
    if (registerUrl && miniAppRegisterUrl) {
        rows.push([urlBtn('🌐 Open the register', registerUrl), webAppBtn('🌐 Mini App', miniAppRegisterUrl)]);
    } else if (registerUrl) {
        rows.push([urlBtn('🌐 Open the register', registerUrl)]);
    } else if (miniAppRegisterUrl) {
        rows.push([webAppBtn('🌐 Mini App register', miniAppRegisterUrl)]);
    }
    const replyMarkup = kb([...rows, ...navTight({ back: back || `c:${klass.id}` })]);
    return { text, replyMarkup };
}

/**
 * Inline paginated pupil status picker (`ar:<classId>:<page>`).
 *
 * Each pupil row shows its current status glyph and cycles on tap:
 *   unmarked / present -> Absent -> Late -> Excused -> Present
 * Any remaining unmarked pupils can be saved as present in one tap (`arp:<classId>`).
 */
function buildInlineRegister({
    klass,
    dayLabel,
    students = [],
    statusByStudent = {},
    page = 1,
    back,
} = {}) {
    const name = klass?.name || 'Class';
    const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    students.forEach((s) => {
        const st = statusByStudent[s.id];
        if (st && counts[st] !== undefined) counts[st] += 1;
        else counts.unmarked += 1;
    });

    const p = paginate(students, page, 8, {
        base: `ar:${klass.id}`,
        rowFor: (s, idx, current) => {
            const st = statusByStudent[s.id] || 'unmarked';
            const meta = STATUS_META[st] || STATUS_META.unmarked;
            const suffix = meta.label ? ` · ${meta.label}` : '';
            const prefix = `${meta.icon} ${idx + 1}. `;
            const maxName = Math.max(6, 33 - prefix.length - suffix.length);
            return btn(`${prefix}${trunc(s.name, maxName)}${suffix}`, `am:${s.id}:${meta.next}:${current}`);
        },
    });

    let text = `📝 Register — ${name}\n${dayLabel}`;
    if (rangeLabel(p)) text += ` (${rangeLabel(p)})`;
    text += '\n\n';
    text += `✅ ${counts.present}P · ✖️ ${counts.absent}A · ⚠️ ${counts.late}L · ☑ ${counts.excused}E`;
    if (counts.unmarked > 0) text += ` · ☐ ${counts.unmarked} left`;
    text += '\n\nTap a pupil to cycle: Absent → Late → Excused → Present.';

    const rows = [...p.rows];
    if (counts.unmarked > 0) {
        rows.push([btn(`✅ Save ${counts.unmarked} rest present`, `arp:${klass.id}`)]);
    }
    rows.push(...navTight({ back: back || `ca:${klass.id}` }));

    return { text, replyMarkup: kb(rows) };
}

/**
 * Confirm before bulk-filling remaining unmarked pupils as present while
 * keeping already-marked absences/lateness intact.
 */
function buildFillPresentConfirm({ klass, dayLabel, unmarkedCount = 0, exceptionCount = 0 } = {}) {
    const name = klass?.name || 'this class';
    const text =
        `⚠️ Save remaining pupils as present?\n\n` +
        `🏫 ${name}\n📅 ${dayLabel}\n\n` +
        `This marks the remaining ${unmarkedCount} unmarked pupil${unmarkedCount === 1 ? '' : 's'} as present` +
        (exceptionCount > 0
            ? ` while keeping your ${exceptionCount} recorded absence/late mark${exceptionCount === 1 ? '' : 's'}.`
            : '.');

    const replyMarkup = kb([
        [btn(`✅ Yes — ${unmarkedCount} present`, `arp:${klass.id}:y`)],
        [backBtn(`arp:${klass.id}:n`, '✖️ Cancel')],
    ]);
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
        'You can still change individual pupils inline or in the Mini App.';

    const replyMarkup = kb([
        [btn(`✅ Yes — ${count} present`, `ap:${klass.id}:y`)],
        [backBtn(`ap:${klass.id}:n`, '✖️ Cancel')],
    ]);
    return { text, replyMarkup };
}

/** Admin live daily attendance overview across all active classes (`pulse`). */
function buildSchoolPulse({
    dayLabel,
    totals = { classes: 0, taken: 0, present: 0, absent: 0, late: 0, excused: 0 },
    missing = [],
    miniAppUrl,
} = {}) {
    let text = `📊 School Pulse — ${dayLabel}\n\n`;
    text += `🏫 Registers in: ${totals.taken} / ${totals.classes}\n`;
    text += `👥 Pupils marked: ${totals.present} present · ${totals.absent} absent · ${totals.late} late`;
    if (totals.excused) text += ` · ${totals.excused} excused`;
    text += '\n\n';

    if (totals.classes === 0) {
        text += 'No active classes with pupils yet.\n';
    } else if (missing.length === 0) {
        text += '🎉 Every homeroom register has been recorded today!\n';
    } else {
        text += `⚠️ Registers still missing (${missing.length}):\n`;
        missing.slice(0, 12).forEach((m) => {
            text += `• ${m.className}${m.teacherName ? ` (${m.teacherName})` : ''}\n`;
        });
        if (missing.length > 12) {
            text += `…and ${missing.length - 12} more\n`;
        }
    }

    const rows = [[btn('✅ Take a register', 'at'), btn('🔄 Refresh', 'pulse')]];
    if (miniAppUrl) rows.push([webAppBtn('🌐 Mini App', miniAppUrl)]);
    rows.push(...navTight());
    return { text, replyMarkup: kb(rows) };
}

/** Notices, paginated, with full-body Read buttons + 1-tap Acknowledge where needed. */
function buildNotices({ notices = [], acked = new Set(), page = 1 } = {}) {
    const pending = notices.filter((n) => n.requires_ack && !acked.has(n.id));
    const p = paginate(notices, page, 5, {
        base: 'nt',
        rowFor: (n, _i, current) => {
            const needsAck = n.requires_ack && !acked.has(n.id);
            if (needsAck) {
                return [
                    btn(`📖 Read · ${trunc(n.title, 14)}`, `nv:${n.id}:${current}`),
                    btn(`☑ Acknowledge · ${trunc(n.title, 12)}`, `na:${n.id}`),
                ];
            }
            return btn(`📖 Read · ${trunc(n.title, 22)}`, `nv:${n.id}:${current}`);
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

/** Full notice reader (`nv:<noticeId>:<page>`) showing body + posted date. */
function buildNoticeDetail({ notice, acked = false, back = 'nt:1' } = {}) {
    const title = notice?.title || 'Notice';
    const body = trunc(notice?.body || 'No additional text.', 2800);
    const posted = notice?.posted_on ? String(notice.posted_on).slice(0, 10) : '';

    let text = `📢 ${title}\n`;
    if (posted) text += `📅 Posted ${posted}`;
    if (notice?.requires_ack) {
        text += `${posted ? ' · ' : ''}${acked ? '✓ Acknowledged' : '⚠️ Needs acknowledgement'}`;
    }
    text += `\n\n${body}`;

    const rows = [];
    if (notice?.requires_ack && !acked) {
        rows.push([btn('☑ Acknowledge', `na:${notice.id}`)]);
    }
    rows.push(...navTight({ back }));
    return { text, replyMarkup: kb(rows) };
}

/** Confirm acknowledging one notice — it is a permanent record. */
function buildNoticeConfirm({ notice } = {}) {
    const title = notice?.title || 'this notice';
    const excerpt = notice?.body ? `\n\n${trunc(notice.body, 300)}` : '';
    const text =
        `📢 Acknowledge this notice?\n\n` +
        `"${trunc(title, 120)}"${excerpt}\n\n` +
        'The office will see that you have read it. It cannot be undone here.';

    const replyMarkup = kb([
        [btn('✅ Acknowledge', `na:${notice.id}:y`)],
        [backBtn(`na:${notice.id}:n`, '✖️ Cancel')],
    ]);
    return { text, replyMarkup };
}

/** Proactive outbound push when a new Notice is posted on the web app. */
function buildNoticePush({ notice } = {}) {
    const title = notice?.title || 'School notice';
    const body = trunc(notice?.body || '', 600);
    let text = `📢 New Notice\n\n${title}`;
    if (body) text += `\n\n${body}`;
    if (notice?.requires_ack) {
        text += '\n\n⚠️ Please read and acknowledge this notice.';
    }

    const rows = notice?.requires_ack
        ? [
            [btn('📖 Read full', `nv:${notice.id}:1`), btn('☑ Acknowledge', `na:${notice.id}`)],
            [btn('🏠 Menu', 'menu')],
        ]
        : [
            [btn('📖 Read notice', `nv:${notice.id}:1`), btn('🏠 Menu', 'menu')],
        ];
    return { text, replyMarkup: kb(rows) };
}

/** Proactive outbound push (and in-place toggle update) for an assigned Task. */
function buildTaskPush({ task, assignedByName } = {}) {
    const isDone = task?.status === 'done';
    const box = isDone ? '☑' : '☐';
    let text = isDone
        ? `✅ Task Completed\n\n${box} ${task?.title || 'Task'}`
        : `📝 New Task${assignedByName ? ` from ${assignedByName}` : ''}\n\n${box} ${task?.title || 'Task'}`;

    if (task?.description) text += `\n\n${trunc(task.description, 400)}`;
    if (task?.due_on) text += `\n📅 Due: ${String(task.due_on).slice(0, 10)}`;
    if (task?.priority && task.priority !== 'normal') text += `\n⚠️ Priority: ${task.priority}`;

    const toggleLabel = isDone
        ? `☑ Done · ${trunc(task?.title || 'Task', 22)}`
        : `☐ Mark done · ${trunc(task?.title || 'Task', 17)}`;

    const rows = [
        [btn(toggleLabel, `tt:${task.id}`)],
        [btn('📅 Today', 'today'), btn('🏠 Menu', 'menu')],
    ];
    return { text, replyMarkup: kb(rows) };
}

/** Generic informational screen (unlinked, no classes, errors) with an escape. */
function buildInfo({ text, rows = [], back = 'menu' } = {}) {
    return { text, replyMarkup: kb([...rows, ...nav({ back })]) };
}

module.exports = {
    MAX_CALLBACK_BYTES,
    MAX_MESSAGE_CHARS,
    LEXICON,
    btn,
    urlBtn,
    webAppBtn,
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
    buildStudentDetail,
    buildAttendanceOptions,
    buildInlineRegister,
    buildFillPresentConfirm,
    buildAttendanceConfirm,
    buildSchoolPulse,
    buildNotices,
    buildNoticeDetail,
    buildNoticeConfirm,
    buildNoticePush,
    buildTaskPush,
    buildInfo,
};
