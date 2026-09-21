/**
 * Year 3 timetable correction (admin decision, 2026-09-20).
 *
 * Source of truth = the class_subjects seats (curriculum), not the legacy
 * grid. The Y3 grid had drifted: GLS seats existed (2/wk) but no GLS slot
 * was ever placed, French had an unplanned extra slot, and SNS for Blue
 * was never placed.
 *
 *   1. Geography and History leave Year 3 — Year 3 mirrors Year 4's social
 *      studies: Global Citizenship (2/wk) only, taught by the main teacher.
 *      The eight Y3 GEO/HIS seats and their 16 slots are removed.
 *
 *   2. The grid is realigned to the seats: place the missing GLS (×2) and
 *      SNS (×2, Blue) sessions, drop the extra FRA session per class.
 *
 *   3. Main teachers open the day at period 1 (08:30–09:20) on at least
 *      THREE mornings a week in one of their three subjects (Maths, Science,
 *      Global Citizenship), so the teacher who takes the 08:10 registration
 *      usually keeps the class. Existing main-taught first periods are kept.
 *
 * Method: surgical. Untouched Y3 lessons keep their slots; Year 4 is loaded
 * read-only as busy facts so shared teachers are never double-booked; REG
 * rows move nowhere. Everything is verified in memory — clash-free, grid ==
 * seats for every Y3 subject, 3-day rule met — before a single write.
 *
 * Usage:
 *   node scripts/y3-global-citizenship-2026-27.js --dry-run
 *   node scripts/y3-global-citizenship-2026-27.js
 */

require('dotenv').config({ path: './.env' });
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const { LESSON_PERIODS } = require('../utils/timetableGenerator');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const DRY_RUN = process.argv.includes('--dry-run');
const MAIN_SUBJECTS = ['MAT', 'SCI', 'GLS'];
const DAYNAME = ['?', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const INSERT_CODES = ['GLS', 'SNS'];       // seats whose grid slots may be (re)created
const DROP_SEAT_CODES = ['GEO', 'HIS'];    // seats removed from Year 3

const fail = (msg) => { console.error(`\nABORT: ${msg}`); process.exit(1); };
const pIdx = (startsAt) => LESSON_PERIODS.findIndex(([start]) => startsAt.startsWith(start));

const main = async () => {
    const { data: year } = await supabase
        .from('academic_years').select('id, school_id').eq('is_current', true).single();
    if (!year) fail('no current academic year');

    const [{ data: classes }, { data: seats }, { data: staff }, { data: slots }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', year.school_id).order('name'),
        supabase.from('class_subjects')
            .select('id, class_id, subject_id, teacher_id, sessions_per_week, subject:subjects(code, name)')
            .eq('academic_year_id', year.id),
        supabase.from('class_staff').select('class_id, user_id, position').eq('academic_year_id', year.id),
        supabase.from('timetable_slots')
            .select('id, class_id, class_subject_id, day_of_week, starts_at, ends_at')
            .eq('academic_year_id', year.id),
    ]);
    for (const [name, rows] of Object.entries({ classes, seats, staff, slots })) {
        if (!rows) fail(`failed to load ${name}`);
    }

    const y3 = classes.filter((c) => c.name.startsWith('Year 3'));
    if (y3.length !== 4) fail(`expected 4 Year-3 classes, found ${y3.length}`);
    const y3Ids = new Set(y3.map((c) => c.id));
    const seatById = new Map(seats.map((s) => [s.id, s]));
    const mainOf = new Map(staff.filter((s) => s.position === 'main').map((s) => [s.class_id, s.user_id]));

    const geoHisSeats = seats.filter((s) => y3Ids.has(s.class_id) && DROP_SEAT_CODES.includes(s.subject?.code));
    if (geoHisSeats.length !== 8) fail(`expected 8 Y3 GEO/HIS seats, found ${geoHisSeats.length}`);
    const glsSeats = seats.filter((s) => y3Ids.has(s.class_id) && s.subject?.code === 'GLS');
    if (glsSeats.length !== 4) fail('expected exactly the 4 Y3 GLS seats');

    // Guard rail: nothing may depend on the seats we are deleting.
    const geoHisIds = geoHisSeats.map((s) => s.id);
    for (const table of ['schemes_of_work', 'lesson_plans', 'marks', 'assessments']) {
        const { data: refs, error } = await supabase
            .from(table).select('id').in('class_subject_id', geoHisIds).limit(1);
        if (!error && refs?.length) fail(`${table} already references Y3 GEO/HIS — clean that up first`);
    }

    // ── Working set: every lesson slot in the school ────────────────────────
    // Y3 slot ids are prefixed so we can tell originals from realignment inserts.
    let synthetic = 0;
    const work = slots
        .filter((s) => pIdx(s.starts_at) >= 0)
        .map((s) => ({
            id: s.id, classId: s.class_id, seatId: s.class_subject_id,
            day: s.day_of_week, period: pIdx(s.starts_at),
            code: seatById.get(s.class_subject_id)?.subject?.code ?? '?',
            teacher: seatById.get(s.class_subject_id)?.teacher_id ?? null,
        }));
    // Immutable snapshot of the starting positions — surgery mutates `work`
    // rows in place, so the apply phase diffs against this, not the objects.
    const origById = new Map(work.map((w) => [w.id, { day: w.day, period: w.period }]));

    // B. Realignment — drops: GEO/HIS (16) plus FRA above the 1/wk seat.
    const notes = [];
    const drop = new Set(work.filter((w) => geoHisIds.includes(w.seatId)).map((w) => w.id));
    if (drop.size > 16) fail(`expected at most 16 GEO/HIS slots, found ${drop.size}`);
    if (drop.size < 16) notes.push(`GEO/HIS slots already removed in an earlier run (${16 - drop.size} missing)`);
    for (const c of y3) {
        const fraSeat = seats.find((s) => s.class_id === c.id && s.subject?.code === 'FRA');
        const fraSlots = work.filter((w) => w.seatId === fraSeat?.id);
        const extra = fraSlots.length - (fraSeat?.sessions_per_week ?? 0);
        if (extra > 0) {
            // Remove the latest-in-week extras; P1 slots go first (frees a morning).
            const sorted = [...fraSlots].sort((a, b) => (b.period - a.period) || (b.day - a.day));
            for (let i = 0; i < extra; i += 1) {
                drop.add(sorted[i].id);
                notes.push(`${c.name}: dropped extra FRA ${DAYNAME[sorted[i].day]} P${sorted[i].period + 1}`);
            }
        }
    }

    const keep = work.filter((w) => !drop.has(w.id));

    const teacherBusy = (teacher, day, period, ignoreIds = new Set()) =>
        keep.some((w) => w.teacher === teacher && w.day === day && w.period === period && !ignoreIds.has(w.id));
    const classBusy = (classId, day, period) =>
        keep.some((w) => w.classId === classId && w.day === day && w.period === period);

    // B2. Realignment — inserts: GLS ×2 and SNS (Blue) ×2 where seats beat grid.
    for (const c of y3) {
        for (const code of INSERT_CODES) {
            const seat = seats.find((s) => s.class_id === c.id && s.subject?.code === code);
            if (!seat) continue;
            let missing = seat.sessions_per_week - keep.filter((w) => w.seatId === seat.id).length;
            // Period-major scan spreads a subject across the week rather than
            // doubling it up on the same day.
            for (let period = 0; period < LESSON_PERIODS.length && missing > 0; period += 1) {
                for (let day = 1; day <= 5 && missing > 0; day += 1) {
                    if (classBusy(c.id, day, period)) continue;
                    if (teacherBusy(seat.teacher_id, day, period)) continue;
                    keep.push({
                        id: `new-${synthetic += 1}`, classId: c.id, seatId: seat.id,
                        day, period, code, teacher: seat.teacher_id,
                    });
                    notes.push(`${c.name}: placed missing ${code} ${DAYNAME[day]} P${period + 1}`);
                    missing -= 1;
                }
            }
            if (missing > 0) fail(`${c.name}: cannot place ${missing} ${code} session(s)`);
        }
    }

    // ── First-period rule: ≥3 main-taught mornings per Y3 class ────────────
    const swaps = [];
    const daySummary = new Map();
    for (const c of y3) {
        const mainId = mainOf.get(c.id);
        if (!mainId) fail(`${c.name} has no main teacher`);

        const freeCells = [];
        for (let d = 1; d <= 5; d += 1) {
            for (let p = 0; p < LESSON_PERIODS.length; p += 1) {
                if (!classBusy(c.id, d, p)) freeCells.push([d, p]);
            }
        }
        const takeHole = (d, p) => freeCells.splice(freeCells.findIndex(([fd, fp]) => fd === d && fp === p), 1);

        const mainP1Days = () => {
            const days = [];
            for (let d = 1; d <= 5; d += 1) {
                const w = keep.find((x) => x.classId === c.id && x.day === d && x.period === 0);
                if (w && w.teacher === mainId && MAIN_SUBJECTS.includes(w.code)) days.push(d);
            }
            return days;
        };

        // Empty P1s get a main-taught donor pulled forward first.
        for (let day = 1; day <= 5; day += 1) {
            if (keep.some((w) => w.classId === c.id && w.day === day && w.period === 0)) continue;
            const donor = keep.find((w) => w.classId === c.id && w.period > 0
                && w.teacher === mainId && MAIN_SUBJECTS.includes(w.code));
            if (!donor) fail(`${c.name} ${DAYNAME[day]}: empty period 1 and no main-taught donor slot`);
            const from = { day: donor.day, period: donor.period };
            Object.assign(donor, { day, period: 0 });
            freeCells.push([from.day, from.period]);
            swaps.push(`${c.name} ${DAYNAME[day]}: ${donor.code} → P1 (was ${DAYNAME[from.day]} P${from.period + 1})`);
        }

        for (let day = 1; day <= 5 && mainP1Days().length < 3; day += 1) {
            const p1 = keep.find((w) => w.classId === c.id && w.day === day && w.period === 0);
            if (!p1) continue;
            if (p1.teacher === mainId && MAIN_SUBJECTS.includes(p1.code)) continue;

            const mains = keep.filter((w) => w.classId === c.id && w.id !== p1.id && w.period > 0
                && w.teacher === mainId && MAIN_SUBJECTS.includes(w.code));
            const byDayPref = (a, b) => (a.day === day ? 0 : 1) - (b.day === day ? 0 : 1);

            let moved = false;

            // A. slot-swap (period 1 <-> main slot), both teachers re-checked.
            for (const cand of [...mains].sort(byDayPref)) {
                const ignore = new Set([p1.id, cand.id]);
                if (teacherBusy(p1.teacher, cand.day, cand.period, ignore)) continue;
                if (teacherBusy(cand.teacher, p1.day, p1.period, ignore)) continue;
                [p1.day, cand.day] = [cand.day, p1.day];
                [p1.period, cand.period] = [cand.period, p1.period];
                swaps.push(`${c.name} ${DAYNAME[day]}: ${cand.code} ⇄ ${p1.code}`);
                moved = true;
                break;
            }

            // B. push the intruder into a freed hole; pull a main slot to P1.
            if (!moved) {
                for (const [hd, hp] of [...freeCells]) {
                    if (teacherBusy(p1.teacher, hd, hp, new Set([p1.id]))) continue;
                    const donor = [...mains].sort(byDayPref).find((m) => !teacherBusy(mainId, day, 0, new Set([m.id])));
                    if (!donor) continue;
                    takeHole(hd, hp);
                    Object.assign(p1, { day: hd, period: hp });
                    const from = { day: donor.day, period: donor.period };
                    Object.assign(donor, { day, period: 0 });
                    freeCells.push([from.day, from.period]);
                    swaps.push(`${c.name} ${DAYNAME[day]}: ${donor.code} → P1; ${p1.code} → ${DAYNAME[hd]} P${hp + 1}`);
                    moved = true;
                    break;
                }
            }

            // C. 3-cycle: donor → P1, intruder → slot X, X → donor's cell.
            if (!moved) {
                const others = keep.filter((w) => w.classId === c.id && w.id !== p1.id
                    && !(w.teacher === mainId && MAIN_SUBJECTS.includes(w.code)));
                outer:
                for (const donor of [...mains].sort(byDayPref)) {
                    if (teacherBusy(mainId, day, 0, new Set([p1.id, donor.id]))) continue;
                    for (const x of others) {
                        if (x.id === donor.id || x.period === 0) continue;
                        const ignore = new Set([p1.id, donor.id, x.id]);
                        if (teacherBusy(p1.teacher, x.day, x.period, ignore)) continue;
                        if (teacherBusy(x.teacher, donor.day, donor.period, ignore)) continue;
                        const [px, py] = [x.day, x.period];
                        Object.assign(x, { day: donor.day, period: donor.period });
                        Object.assign(donor, { day, period: 0 });
                        Object.assign(p1, { day: px, period: py });
                        swaps.push(`${c.name} ${DAYNAME[day]}: 3-cycle ${donor.code} → P1, ${p1.code} → ${DAYNAME[px]} P${py + 1}`);
                        moved = true;
                        break outer;
                    }
                }
            }

            if (!moved) fail(`${c.name} ${DAYNAME[day]}: cannot make period 1 main-taught (needed for the 3-day rule)`);
            const check = keep.find((w) => w.classId === c.id && w.day === day && w.period === 0);
            if (!check || check.teacher !== mainId || !MAIN_SUBJECTS.includes(check.code))
                fail(`${c.name} ${DAYNAME[day]}: fix did not take`);
        }

        if (mainP1Days().length < 3) fail(`${c.name}: only ${mainP1Days().length} main-taught mornings possible`);
        daySummary.set(c.name, mainP1Days());
    }

    // ── Verification ────────────────────────────────────────────────────────
    const tSeen = new Map();
    for (const w of keep) {
        if (!w.teacher) continue;
        const key = `${w.teacher}|${w.day}|${w.period}`;
        if (tSeen.has(key)) fail(`teacher clash at ${key} (${w.code} vs ${tSeen.get(key)})`);
        tSeen.set(key, w.code);
    }
    const cSeen = new Set();
    for (const w of keep) {
        const key = `${w.classId}|${w.day}|${w.period}`;
        if (cSeen.has(key)) fail(`class clash at ${key}`);
        cSeen.add(key);
    }
    // Postcondition: grid == seats for every non-deleted Y3 subject.
    for (const s of seats.filter((x) => y3Ids.has(x.class_id) && !geoHisIds.includes(x.id) && x.subject?.code !== 'REG')) {
        const actual = keep.filter((w) => w.seatId === s.id).length;
        if (actual !== s.sessions_per_week)
            fail(`${classes.find((c) => c.id === s.class_id).name} ${s.subject.code}: grid ${actual} != seat ${s.sessions_per_week}`);
    }
    for (const c of y3) {
        if ((daySummary.get(c.name) || []).length < 3)
            fail(`${c.name}: fewer than 3 main-taught mornings after surgery`);
    }
    // Year 4 must be byte-identical.
    for (const w of keep.filter((x) => !y3Ids.has(x.classId))) {
        const orig = work.find((o) => o.id === w.id);
        if (!orig || orig.day !== w.day || orig.period !== w.period) fail('a Year 4 slot moved — this must never happen');
    }

    console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}Y3 timetable correction`);
    console.log(`  GEO/HIS seats removed: 8 (slots removed: 16)`);
    for (const n of notes) console.log(`  ${n}`);
    console.log(`  P1-rule moves: ${swaps.length}`);
    for (const s of swaps) console.log(`    ${s}`);
    for (const [name, days] of daySummary)
        console.log(`  ${name}: main teacher opens ${DAYNAME.filter((_, i) => days.includes(i)).join(' + ')}`);

    for (const c of y3) {
        console.log(`\n  ${c.name}`);
        const grid = Array.from({ length: LESSON_PERIODS.length }, () => Array(5).fill('·'));
        for (const w of keep.filter((x) => x.classId === c.id)) grid[w.period][w.day - 1] = w.code;
        grid.forEach((row, i) => {
            const [s, e] = LESSON_PERIODS[i];
            console.log(`    P${i + 1} ${s}-${e}  ${row.map((x) => x.padEnd(4)).join(' ')}`);
        });
    }

    if (DRY_RUN) { console.log('\n(dry run — no database changes)'); return; }

    // ── Apply ───────────────────────────────────────────────────────────────
    const y3Final = keep.filter((w) => y3Ids.has(w.classId));
    const inserts = y3Final.filter((w) => w.id.startsWith('new-'));
    const updates = y3Final.filter((w) => {
        const o = origById.get(w.id);
        return o && (o.day !== w.day || o.period !== w.period);
    });

    // Slot rows move via delete+insert (never in-place updates): the
    // exclusion constraints reject any intermediate state where a moved row
    // still occupies a cell an insert targets.
    const toDelete = [...new Set([...drop, ...updates.map((w) => w.id)])];
    console.log(`\nDeleting ${toDelete.length} slot rows (${drop.size} removed sessions + ${updates.length} re-timed)…`);
    if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('timetable_slots').delete().in('id', toDelete);
        if (delErr) fail(delErr.message);
    }

    const finalRows = [...updates, ...inserts].map((w) => ({
        school_id: year.school_id,
        academic_year_id: year.id,
        class_id: w.classId,
        class_subject_id: w.seatId,
        day_of_week: w.day,
        starts_at: LESSON_PERIODS[w.period][0],
        ends_at: LESSON_PERIODS[w.period][1],
    }));
    console.log(`Inserting ${finalRows.length} final-position rows…`);
    if (finalRows.length > 0) {
        const { error } = await supabase.from('timetable_slots').insert(finalRows);
        if (error) fail(error.message);
    }

    console.log('Deleting 8 GEO/HIS seats…');
    const { error: seatErr } = await supabase.from('class_subjects').delete().in('id', geoHisIds);
    if (seatErr) fail(seatErr.message);

    console.log('Done. Y3: GEO/HIS out, GLS on the grid, grid == seats, main teachers open ≥3 mornings.');
};

main().catch((e) => fail(e.message));
