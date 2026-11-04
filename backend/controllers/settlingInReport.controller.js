const supabase = require('../config/supabase');
const {
    BadRequestError,
    NotFoundError,
    ServiceUnavailableError,
    asyncHandler,
} = require('../utils/errors');
const { normalizeStudentName, sortStudentsCanonically } = require('../utils/studentRolls');
const {
    getSettlingInTemplate,
    getSubjectForYear,
} = require('../config/settlingInCriteria');

const SECTION_TABLE = 'settling_in_report_sections';
const RATING_VALUES = new Set(['WT', 'WW', 'WA']);

const throwSettlingInStorageError = (error) => {
    if (['PGRST205', '42P01'].includes(error?.code)) {
        throw new ServiceUnavailableError(
            'Settling In Reports are not initialized. Apply supabase/migrations/034_settling_in_reports.sql first.',
        );
    }
    throw error;
};

const gradeForClass = (classRecord) => {
    if (classRecord.year_level !== null && classRecord.year_level !== undefined) {
        const configured = Number(classRecord.year_level);
        if ([3, 4].includes(configured)) return configured;
        throw new BadRequestError('Settling In Reports are configured for Year 3 and Year 4 only');
    }

    // Legacy classes can lack year_level. Only use an explicit class-name
    // pattern as a fallback; never infer a grade from unrelated digits.
    const match = String(classRecord.name || '').match(/\byear\s*([34])\b/i);
    if (match) return Number(match[1]);
    throw new BadRequestError('This class does not have Year 3 or Year 4 settling-in criteria');
};

const requireOwnedRecord = async (table, id, columns, schoolId, label) => {
    const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('id', id)
        .eq('school_id', schoolId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError(`${label} not found`);
    return data;
};

const requireClassAndTerm = async (req, classId, termId) => {
    if (!classId || !termId) {
        throw new BadRequestError('Choose both a class and a term');
    }

    const [classRecord, termRecord] = await Promise.all([
        requireOwnedRecord('classes', classId, 'id, name, year_level', req.user.school_id, 'Class'),
        requireOwnedRecord('terms', termId, 'id, name, academic_year_id', req.user.school_id, 'Term'),
    ]);

    const yearLevel = gradeForClass(classRecord);
    return {
        classRecord,
        termRecord,
        template: getSettlingInTemplate(yearLevel),
    };
};

const shapeSection = (row, template) => {
    const subject = template.subjects.find((item) => item.key === row.subject_key);
    const criteria = Array.isArray(row.criteria_snapshot) && row.criteria_snapshot.length
        ? row.criteria_snapshot
        : (subject?.criteria || []);
    const ratings = row.ratings && typeof row.ratings === 'object' && !Array.isArray(row.ratings)
        ? row.ratings
        : {};
    const ratedCount = criteria.filter((criterion) => RATING_VALUES.has(ratings[criterion.id])).length;

    return {
        id: row.id,
        subjectKey: row.subject_key,
        ratings,
        criteriaSnapshot: criteria,
        templateVersion: row.template_version,
        savedBy: row.saved_by,
        updatedAt: row.updated_at,
        ratedCount,
        totalCount: criteria.length,
        complete: criteria.length > 0 && ratedCount === criteria.length,
    };
};

/**
 * GET /api/settling-in/classes/:classId?termId=...
 * Admin-only class workspace, with grade-specific criteria and saved sections.
 */
const getClassReport = asyncHandler(async (req, res) => {
    const { classRecord, termRecord, template } = await requireClassAndTerm(
        req,
        req.params.classId,
        req.query.termId,
    );

    const [{ data: students, error: studentError }, { data: savedSections, error: sectionError }] = await Promise.all([
        supabase
            .from('students')
            .select('id, name, admission_no, roll_num, date_of_birth, gender, class_id, is_active')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classRecord.id)
            .eq('is_active', true)
            .order('roll_num', { ascending: true })
            .order('name', { ascending: true }),
        supabase
            .from(SECTION_TABLE)
            .select('id, student_id, subject_key, ratings, criteria_snapshot, template_version, saved_by, updated_at')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classRecord.id)
            .eq('term_id', termRecord.id),
    ]);

    if (studentError) throw studentError;
    if (sectionError) throwSettlingInStorageError(sectionError);

    const sectionsByStudent = new Map();
    (savedSections || []).forEach((row) => {
        if (!sectionsByStudent.has(row.student_id)) sectionsByStudent.set(row.student_id, {});
        sectionsByStudent.get(row.student_id)[row.subject_key] = shapeSection(row, template);
    });

    const orderedStudents = sortStudentsCanonically(students || []);
    res.json({
        class: {
            id: classRecord.id,
            name: classRecord.name,
            yearLevel: template.yearLevel,
        },
        term: {
            id: termRecord.id,
            name: termRecord.name,
            academicYearId: termRecord.academic_year_id,
        },
        template,
        students: orderedStudents.map((student) => ({
            id: student.id,
            name: normalizeStudentName(student.name),
            admissionNo: normalizeStudentName(student.admission_no) || student.admission_no,
            rollNum: student.roll_num,
            dateOfBirth: student.date_of_birth,
            gender: student.gender,
            sections: sectionsByStudent.get(student.id) || {},
        })),
    });
});

const normalizeRatings = (ratings, subject) => {
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
        throw new BadRequestError('Ratings must be an object keyed by criterion');
    }

    const criteriaIds = new Set(subject.criteria.map((criterion) => criterion.id));
    const unknownIds = Object.keys(ratings).filter((id) => !criteriaIds.has(id));
    if (unknownIds.length > 0) {
        throw new BadRequestError('Ratings include criteria that do not belong to this Year and subject');
    }

    return Object.fromEntries(subject.criteria.map(({ id }) => {
        const value = ratings[id] === '' || ratings[id] === undefined ? null : ratings[id];
        if (value !== null && !RATING_VALUES.has(value)) {
            throw new BadRequestError('Each criterion must be rated WT, WW, WA, or left blank');
        }
        return [id, value];
    }));
};

/**
 * PUT /api/settling-in/sections
 * Save one student's subject section. The database stores one row for the
 * student/class/term/subject, so the main-teacher card can later read the same
 * assessment without copying or overwriting marksheet data.
 */
const saveSection = asyncHandler(async (req, res) => {
    const {
        classId,
        studentId,
        termId,
        subjectKey,
        ratings,
    } = req.body;

    const { classRecord, termRecord, template } = await requireClassAndTerm(
        req,
        classId,
        termId,
    );
    const subject = getSubjectForYear(template.yearLevel, subjectKey);
    if (!subject) {
        throw new BadRequestError('That subject is not part of the selected Year settling-in report');
    }

    const student = await requireOwnedRecord(
        'students',
        studentId,
        'id, class_id, is_active',
        req.user.school_id,
        'Student',
    );
    if (student.class_id !== classRecord.id) {
        throw new BadRequestError('Student is not enrolled in the selected class');
    }
    if (!student.is_active) {
        throw new BadRequestError('Inactive students cannot be assessed in the current class report');
    }

    const normalizedRatings = normalizeRatings(ratings, subject);
    const payload = {
        school_id: req.user.school_id,
        class_id: classRecord.id,
        student_id: student.id,
        term_id: termRecord.id,
        grade_level: template.yearLevel,
        subject_key: subject.key,
        template_version: template.version,
        criteria_snapshot: subject.criteria,
        ratings: normalizedRatings,
        saved_by: req.user.id,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from(SECTION_TABLE)
        .upsert(payload, {
            onConflict: 'school_id,class_id,student_id,term_id,subject_key',
        })
        .select('id, subject_key, ratings, criteria_snapshot, template_version, saved_by, updated_at')
        .single();

    if (error) throwSettlingInStorageError(error);

    res.json({ section: shapeSection(data, template) });
});

module.exports = {
    getClassReport,
    saveSection,
    gradeForClass,
    normalizeRatings,
};
