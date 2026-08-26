const supabase = require('../config/supabase');
const { NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * School calendar: term dates, exams, meetings, holidays, trips, deadlines.
 *
 * Visibility: an event reaches a teacher if its audience is 'all' or matches
 * their role, and if it is school-wide or targeted at a class they are
 * attached to.
 */

const SELECT = `
    id, title, description, category, audience, starts_on, ends_on,
    starts_at, ends_at, all_day, location, term_id, class_id,
    class:classes(id, name),
    author:users!created_by(id, name)
`;

const shape = (e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    audience: e.audience,
    startsOn: e.starts_on,
    endsOn: e.ends_on,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    allDay: e.all_day,
    location: e.location,
    termId: e.term_id,
    classId: e.class_id,
    class: e.class ?? null,
    author: e.author ?? null,
});

/**
 * GET /api/calendar?from=&to=&category=&classId=
 *
 * Defaults to the current month when no range is given.
 */
const listEvents = asyncHandler(async (req, res) => {
    const now = new Date();
    const from = req.query.from
        || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = req.query.to
        || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    let query = supabase
        .from('calendar_events')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        // Any event overlapping the window, not merely starting inside it.
        .lte('starts_on', to)
        .gte('ends_on', from)
        .order('starts_on');

    if (req.query.category) query = query.eq('category', req.query.category);
    if (req.query.classId) query = query.eq('class_id', req.query.classId);

    const { data, error } = await query;
    if (error) throw error;

    let events = data;

    if (req.user.role !== 'admin') {
        // Role targeting.
        events = events.filter((e) => e.audience === 'all' || e.audience === req.user.role);

        // Class targeting: only events for classes they are attached to.
        const { data: staffRows, error: staffError } = await supabase
            .from('class_staff')
            .select('class_id')
            .eq('school_id', req.user.school_id)
            .eq('user_id', req.user.id);

        if (staffError) throw staffError;

        const { data: subjectRows, error: subjectError } = await supabase
            .from('class_subjects')
            .select('class_id')
            .eq('school_id', req.user.school_id)
            .eq('teacher_id', req.user.id);

        if (subjectError) throw subjectError;

        const myClasses = new Set([
            ...(staffRows || []).map((r) => r.class_id),
            ...(subjectRows || []).map((r) => r.class_id),
        ]);

        events = events.filter((e) => !e.class_id || myClasses.has(e.class_id));
    }

    res.json({ from, to, events: events.map(shape) });
});

/**
 * GET /api/calendar/upcoming?days=14
 * The short list for a dashboard.
 */
const getUpcoming = asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days) || 14, 90);
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('calendar_events')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .gte('ends_on', today)
        .lte('starts_on', horizon)
        .order('starts_on')
        .limit(20);

    if (error) throw error;

    const visible = req.user.role === 'admin'
        ? data
        : data.filter((e) => e.audience === 'all' || e.audience === req.user.role);

    res.json({ events: visible.map(shape) });
});

/** POST /api/calendar */
const createEvent = asyncHandler(async (req, res) => {
    const {
        title, description, category, audience, startsOn, endsOn,
        startsAt, endsAt, allDay, location, classId, termId,
    } = req.body;

    const isAllDay = allDay !== false;

    const { data, error } = await supabase
        .from('calendar_events')
        .insert({
            school_id: req.user.school_id,
            title,
            description: description ?? null,
            category: category ?? 'event',
            audience: audience ?? 'all',
            starts_on: startsOn,
            ends_on: endsOn ?? startsOn,
            starts_at: isAllDay ? null : (startsAt ?? null),
            ends_at: isAllDay ? null : (endsAt ?? null),
            all_day: isAllDay,
            location: location ?? null,
            class_id: classId ?? null,
            term_id: termId ?? null,
            created_by: req.user.id,
        })
        .select(SELECT)
        .single();

    if (error) throw error;

    res.status(201).json({ event: shape(data) });
});

/** PATCH /api/calendar/:id */
const updateEvent = asyncHandler(async (req, res) => {
    const map = {
        title: 'title', description: 'description', category: 'category',
        audience: 'audience', startsOn: 'starts_on', endsOn: 'ends_on',
        startsAt: 'starts_at', endsAt: 'ends_at', allDay: 'all_day',
        location: 'location', classId: 'class_id', termId: 'term_id',
    };

    const patch = {};
    for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) patch[column] = req.body[key];
    }

    // Clearing the times keeps an all-day event consistent.
    if (patch.all_day === true) {
        patch.starts_at = null;
        patch.ends_at = null;
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select(SELECT)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Event not found');

    res.json({ event: shape(data) });
});

/** DELETE /api/calendar/:id */
const deleteEvent = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Event not found');

    res.json({ message: 'Event deleted' });
});

module.exports = { listEvents, getUpcoming, createEvent, updateEvent, deleteEvent };
