const supabase = require('../config/supabase');
const { resolveYearId } = require('./academicYear.controller');
const { NotFoundError, ConflictError, BadRequestError, asyncHandler } = require('../utils/errors');

/** Weeks in a term, derived from its dates rather than stored. */
const weekCount = (startsOn, endsOn) => {
    const days = (new Date(endsOn) - new Date(startsOn)) / 86400000 + 1;
    return Math.max(1, Math.ceil(days / 7));
};

/** The Monday-based date range of a given teaching week. */
const weekRange = (startsOn, weekNumber) => {
    const start = new Date(startsOn);
    start.setDate(start.getDate() + (weekNumber - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};

const shape = (t) => ({
    id: t.id,
    termIndex: t.term_index,
    name: t.name,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
    isCurrent: t.is_current,
    academicYearId: t.academic_year_id,
    weekCount: weekCount(t.starts_on, t.ends_on),
});

/**
 * Resolves the term to work in: an explicit ?termId, else the current one.
 * Shared by the planning controllers.
 */
const resolveTermId = async (req) => {
    if (req.query.termId || req.body?.termId) return req.query.termId || req.body.termId;

    const { data, error } = await supabase
        .from('terms')
        .select('id')
        .eq('school_id', req.user.school_id)
        .eq('is_current', true)
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new NotFoundError('No current term is set. Create one under Calendar → Terms.');
    }
    return data.id;
};

/** Loads a term row, or throws. */
const requireTerm = async (termId, schoolId) => {
    const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('id', termId)
        .eq('school_id', schoolId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Term not found');
    return data;
};

/** GET /api/terms */
const listTerms = asyncHandler(async (req, res) => {
    let query = supabase
        .from('terms')
        .select('*')
        .eq('school_id', req.user.school_id)
        .order('starts_on');

    if (req.query.academicYearId) query = query.eq('academic_year_id', req.query.academicYearId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ terms: data.map(shape) });
});

/**
 * GET /api/terms/current
 * The working term plus which teaching week today falls in.
 */
const getCurrentTerm = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('school_id', req.user.school_id)
        .eq('is_current', true)
        .maybeSingle();

    if (error) throw error;
    if (!data) return res.json({ term: null, currentWeek: null });

    const today = new Date().toISOString().slice(0, 10);
    const total = weekCount(data.starts_on, data.ends_on);

    let currentWeek = null;
    if (today >= data.starts_on && today <= data.ends_on) {
        const elapsed = (new Date(today) - new Date(data.starts_on)) / 86400000;
        currentWeek = Math.min(total, Math.floor(elapsed / 7) + 1);
    }

    res.json({ term: shape(data), currentWeek });
});

/**
 * GET /api/terms/:id/weeks
 * The teaching weeks of a term with their dates — drives the planner.
 */
const getTermWeeks = asyncHandler(async (req, res) => {
    const term = await requireTerm(req.params.id, req.user.school_id);
    const total = weekCount(term.starts_on, term.ends_on);
    const today = new Date().toISOString().slice(0, 10);

    const weeks = Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const { from, to } = weekRange(term.starts_on, n);
        return {
            weekNumber: n,
            startsOn: from,
            // Never advertise a week running past the end of term.
            endsOn: to > term.ends_on ? term.ends_on : to,
            isCurrent: today >= from && today <= to,
        };
    });

    res.json({ term: shape(term), weeks });
});

/** POST /api/terms */
const createTerm = asyncHandler(async (req, res) => {
    const { name, termIndex, startsOn, endsOn, isCurrent } = req.body;
    const yearId = req.body.academicYearId || (await resolveYearId(req));

    if (endsOn <= startsOn) throw new BadRequestError('A term must end after it starts');

    const { data, error } = await supabase
        .from('terms')
        .insert({
            school_id: req.user.school_id,
            academic_year_id: yearId,
            term_index: termIndex,
            name,
            starts_on: startsOn,
            ends_on: endsOn,
        })
        .select()
        .single();

    if (error?.code === '23505') throw new ConflictError(`Term ${termIndex} already exists this year`);
    // 23P01 = the no_overlapping_terms exclusion constraint.
    if (error?.code === '23P01') throw new ConflictError('These dates overlap another term');
    if (error) throw error;

    if (isCurrent) {
        await supabase.rpc('set_current_term', {
            p_term_id: data.id,
            p_school_id: req.user.school_id,
        });
        data.is_current = true;
    }

    res.status(201).json({ term: shape(data) });
});

/** PATCH /api/terms/:id */
const updateTerm = asyncHandler(async (req, res) => {
    const { name, startsOn, endsOn } = req.body;

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (startsOn !== undefined) patch.starts_on = startsOn;
    if (endsOn !== undefined) patch.ends_on = endsOn;

    const { data, error } = await supabase
        .from('terms')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error?.code === '23P01') throw new ConflictError('These dates overlap another term');
    if (error) throw error;
    if (!data) throw new NotFoundError('Term not found');

    res.json({ term: shape(data) });
});

/** POST /api/terms/:id/set-current */
const setCurrentTerm = asyncHandler(async (req, res) => {
    const { data, error } = await supabase.rpc('set_current_term', {
        p_term_id: req.params.id,
        p_school_id: req.user.school_id,
    });

    if (error) {
        if (error.message?.includes('TERM_NOT_FOUND')) throw new NotFoundError('Term not found');
        throw error;
    }

    res.json({ term: shape(data) });
});

/** DELETE /api/terms/:id */
const deleteTerm = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('terms')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Term not found');

    res.json({ message: 'Term deleted' });
});

module.exports = {
    listTerms, getCurrentTerm, getTermWeeks, createTerm, updateTerm,
    setCurrentTerm, deleteTerm, resolveTermId, requireTerm, weekCount, weekRange, shape,
};
