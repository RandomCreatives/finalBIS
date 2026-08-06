const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, asyncHandler } = require('../utils/errors');

const shape = (y) => ({
    id: y.id,
    name: y.name,
    startsOn: y.starts_on,
    endsOn: y.ends_on,
    isCurrent: y.is_current,
});

/**
 * Resolves the year to operate on: an explicit ?academicYearId, else the
 * school's current year. Shared by every year-scoped controller.
 */
const resolveYearId = async (req) => {
    if (req.query.academicYearId) return req.query.academicYearId;

    const { data, error } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', req.user.school_id)
        .eq('is_current', true)
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new NotFoundError('No current academic year is set. Create one under Academic Years.');
    }
    return data.id;
};

/** GET /api/academic-years */
const listYears = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', req.user.school_id)
        .order('starts_on', { ascending: false });

    if (error) throw error;
    res.json({ academicYears: data.map(shape) });
});

/** POST /api/academic-years */
const createYear = asyncHandler(async (req, res) => {
    const { name, startsOn, endsOn, isCurrent } = req.body;

    // Only one year may be current; stand the others down first.
    if (isCurrent) {
        const { error: clearError } = await supabase
            .from('academic_years')
            .update({ is_current: false })
            .eq('school_id', req.user.school_id)
            .eq('is_current', true);
        if (clearError) throw clearError;
    }

    const { data, error } = await supabase
        .from('academic_years')
        .insert({
            school_id: req.user.school_id,
            name,
            starts_on: startsOn,
            ends_on: endsOn,
            is_current: Boolean(isCurrent),
        })
        .select()
        .single();

    if (error?.code === '23505') throw new ConflictError(`Academic year "${name}" already exists`);
    if (error) throw error;

    res.status(201).json({ academicYear: shape(data) });
});

/** POST /api/academic-years/:id/set-current */
const setCurrentYear = asyncHandler(async (req, res) => {
    const { error: clearError } = await supabase
        .from('academic_years')
        .update({ is_current: false })
        .eq('school_id', req.user.school_id)
        .eq('is_current', true);
    if (clearError) throw clearError;

    const { data, error } = await supabase
        .from('academic_years')
        .update({ is_current: true })
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Academic year not found');

    res.json({ academicYear: shape(data) });
});

module.exports = { listYears, createYear, setCurrentYear, resolveYearId, shape };
