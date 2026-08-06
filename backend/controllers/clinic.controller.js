const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, asyncHandler } = require('../utils/errors');

const SELECT = `
    id, visit_date, complaint, incident_type, severity, diagnosis, treatment,
    outcome, parent_notified, leave_status, leave_reviewed_at,
    student:students(id, name, admission_no, class_id),
    attendant:users!attended_by(id, name)
`;

const shape = (v) => ({
    id: v.id,
    visitDate: v.visit_date,
    complaint: v.complaint,
    incidentType: v.incident_type,
    severity: v.severity,
    diagnosis: v.diagnosis,
    treatment: v.treatment,
    outcome: v.outcome,
    parentNotified: v.parent_notified,
    leaveStatus: v.leave_status,
    leaveReviewedAt: v.leave_reviewed_at,
    student: v.student,
    attendedBy: v.attendant,
});

/** POST /api/clinic/visits */
const recordVisit = asyncHandler(async (req, res) => {
    const {
        studentId, classId, complaint, incidentType, severity,
        diagnosis, treatment, outcome, parentNotified, requestLeave,
    } = req.body;

    const { data, error } = await supabase
        .from('clinic_visits')
        .insert({
            school_id: req.user.school_id,
            student_id: studentId,
            class_id: classId ?? null,
            complaint,
            incident_type: incidentType,
            severity: severity ?? 'minor',
            diagnosis: diagnosis ?? null,
            treatment: treatment ?? null,
            outcome,
            parent_notified: parentNotified ?? false,
            // A leave request starts life pending; only an admin can resolve it.
            leave_status: requestLeave ? 'pending' : null,
            attended_by: req.user.id,
        })
        .select(SELECT)
        .single();

    if (error) throw error;

    res.status(201).json({ visit: shape(data) });
});

/** GET /api/clinic/visits?studentId=&leaveStatus=&from=&to= */
const listVisits = asyncHandler(async (req, res) => {
    const { studentId, leaveStatus, from, to } = req.query;

    let query = supabase
        .from('clinic_visits')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('visit_date', { ascending: false });

    if (studentId) query = query.eq('student_id', studentId);
    if (leaveStatus) query = query.eq('leave_status', leaveStatus);
    if (from) query = query.gte('visit_date', from);
    if (to) query = query.lte('visit_date', to);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ visits: data.map(shape) });
});

/**
 * POST /api/clinic/visits/:id/leave — approve or reject. Admin only.
 */
const reviewLeaveRequest = asyncHandler(async (req, res) => {
    const { decision } = req.body; // 'approved' | 'rejected'

    const { data: visit, error: lookupError } = await supabase
        .from('clinic_visits')
        .select('leave_status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!visit) throw new NotFoundError('Clinic visit not found');
    if (!visit.leave_status) throw new ConflictError('No leave was requested for this visit');
    if (visit.leave_status !== 'pending') {
        throw new ConflictError(`Leave request was already ${visit.leave_status}`);
    }

    const { data, error } = await supabase
        .from('clinic_visits')
        .update({
            leave_status: decision,
            leave_reviewed_by: req.user.id,
            leave_reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select(SELECT)
        .single();

    if (error) throw error;

    res.json({ message: `Leave request ${decision}`, visit: shape(data) });
});

/** GET /api/clinic/summary */
const getClinicSummary = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('clinic_visits')
        .select('incident_type, severity, leave_status')
        .eq('school_id', req.user.school_id);

    if (error) throw error;

    const tally = (key) =>
        data.reduce((acc, v) => {
            if (v[key]) acc[v[key]] = (acc[v[key]] || 0) + 1;
            return acc;
        }, {});

    res.json({
        totalVisits: data.length,
        pendingLeaveRequests: data.filter((v) => v.leave_status === 'pending').length,
        byIncidentType: tally('incident_type'),
        bySeverity: tally('severity'),
    });
});

module.exports = { recordVisit, listVisits, reviewLeaveRequest, getClinicSummary };
