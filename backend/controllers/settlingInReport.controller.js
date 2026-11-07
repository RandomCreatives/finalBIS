const supabase = require('../config/supabase');
const {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
    asyncHandler,
} = require('../utils/errors');
const { normalizeStudentName, sortStudentsCanonically } = require('../utils/studentRolls');
const {
    getSettlingInTemplate,
    getSubjectForYear,
    MAIN_TEACHER_CATEGORIES,
    MAIN_TEACHER_RATING_ORDER,
    MAIN_TEACHER_TEMPLATE_VERSION,
} = require('../config/settlingInCriteria');

const SECTION_TABLE = 'settling_in_report_sections';
const MAIN_SECTION_TABLE = 'settling_in_report_main_sections';
const RATING_VALUES = new Set(['WT', 'WW', 'WA']);
const MAIN_TEACHER_RATING_VALUES = new Set(MAIN_TEACHER_RATING_ORDER);
const SUBJECT_REPORT_CODES = { english: 'ENG', amharic: 'AMH' };

const throwSettlingInStorageError = (error) => {
    if (['PGRST205', '42P01'].includes(error?.code)) {
        throw new ServiceUnavailableError(
            'Settling In Reports are not initialized. Apply supabase/migrations/034_settling_in_reports.sql and supabase/migrations/035_settling_in_main_teacher_sections.sql first.',
        );
    }
    throw error;
};

const gradeForClass = (classRecord) => {
    const configuredYearLevel = classRecord.year_level;
    const configured = Number(configuredYearLevel);
    if ([3, 4].includes(configured)) return configured;

    // Use a literal Year 3/4 class name to recover legacy or misconfigured
    // year_level values, but never infer from unrelated digits in the name.
    const match = String(classRecord.name || '').match(/\byear\s*([34])\b/i);
    if (match) return Number(match[1]);

    if (configuredYearLevel !== null && configuredYearLevel !== undefined) {
        throw new BadRequestError('Settling In Reports are configured for Year 3 and Year 4 only');
    }
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

/** Main teachers may only access classes where they hold the main seat. */
const assertMainTeacherClassAccess = async (req, classRecord, termRecord) => {
    if (req.user.role === 'admin') return;
    if (req.user.role !== 'main_teacher') {
        throw new ForbiddenError('Only admins and assigned main teachers may access Settling In Reports');
    }

    const { data, error } = await supabase
        .from('class_staff')
        .select('id')
        .eq('school_id', req.user.school_id)
        .eq('academic_year_id', termRecord.academic_year_id)
        .eq('class_id', classRecord.id)
        .eq('user_id', req.user.id)
        .eq('position', 'main')
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new ForbiddenError('This class is not assigned to you as its main teacher');
    }
};

const getSubjectTeacherAssignments = async (req, classRecord, termRecord, template) => {
    if (req.user.role !== 'subject_teacher') {
        throw new ForbiddenError('Only subject teachers may access their assigned Settling In sections');
    }

    const templateSubjects = (template.subjects || []).filter((subject) =>
        SUBJECT_REPORT_CODES[subject.key] && subject.assessorRole === 'subject_teacher',
    );
    if (templateSubjects.length === 0) return [];

    const { data: subjectRecords, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name, code')
        .eq('school_id', req.user.school_id)
        .in('code', templateSubjects.map((subject) => SUBJECT_REPORT_CODES[subject.key]));
    if (subjectError) throw subjectError;

    const subjectByKey = new Map((subjectRecords || []).map((record) => {
        const key = Object.keys(SUBJECT_REPORT_CODES).find((item) =>
            SUBJECT_REPORT_CODES[item] === String(record.code || '').toUpperCase(),
        );
        return [key, record];
    }).filter(([key]) => key));
    if (subjectByKey.size === 0) return [];

    const { data: assignments, error: assignmentError } = await supabase
        .from('class_subjects')
        .select('id, subject_id')
        .eq('school_id', req.user.school_id)
        .eq('academic_year_id', termRecord.academic_year_id)
        .eq('class_id', classRecord.id)
        .eq('teacher_id', req.user.id)
        .in('subject_id', [...subjectByKey.values()].map((subject) => subject.id));
    if (assignmentError) throw assignmentError;

    const assignedSubjectIds = new Set((assignments || []).map((assignment) => String(assignment.subject_id)));
    return templateSubjects.filter((subject) => {
        const record = subjectByKey.get(subject.key);
        return record && assignedSubjectIds.has(String(record.id));
    });
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

const normalizeMainTeacherRatings = (ratings) => {
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
        throw new BadRequestError('Main teacher ratings must be an object keyed by category');
    }

    const categoryKeys = new Set(MAIN_TEACHER_CATEGORIES.map(({ key }) => key));
    const unknownKeys = Object.keys(ratings).filter((key) => !categoryKeys.has(key));
    if (unknownKeys.length > 0) {
        throw new BadRequestError('Main teacher ratings include an unknown category');
    }

    return Object.fromEntries(MAIN_TEACHER_CATEGORIES.map(({ key }) => {
        const value = ratings[key] === '' || ratings[key] === undefined ? null : ratings[key];
        if (value !== null && !MAIN_TEACHER_RATING_VALUES.has(value)) {
            throw new BadRequestError('Each main teacher rating must be Pleasing, Satisfactory, Cause for Concern, or left blank');
        }
        return [key, value];
    }));
};

const shapeMainTeacherSection = (row) => {
    if (!row) return null;
    const sourceRatings = row.ratings && typeof row.ratings === 'object' && !Array.isArray(row.ratings)
        ? row.ratings
        : {};
    const ratings = Object.fromEntries(MAIN_TEACHER_CATEGORIES.map(({ key }) => [key, sourceRatings[key] || null]));
    const ratedCount = MAIN_TEACHER_CATEGORIES.filter(({ key }) => MAIN_TEACHER_RATING_VALUES.has(ratings[key])).length;

    return {
        id: row.id,
        ratings,
        templateVersion: row.template_version,
        savedBy: row.saved_by,
        updatedAt: row.updated_at,
        ratedCount,
        totalCount: MAIN_TEACHER_CATEGORIES.length,
        complete: ratedCount === MAIN_TEACHER_CATEGORIES.length,
    };
};

/**
 * GET /api/settling-in/classes/:classId?termId=...
 * Admin and assigned main-teacher workspace, with grade-specific criteria
 * and saved subject and main-teacher sections.
 */
const getClassReport = asyncHandler(async (req, res) => {
    const { classRecord, termRecord, template } = await requireClassAndTerm(
        req,
        req.params.classId,
        req.query.termId,
    );
    await assertMainTeacherClassAccess(req, classRecord, termRecord);

    const [
        { data: students, error: studentError },
        { data: savedSections, error: sectionError },
        { data: savedMainSections, error: mainSectionError },
    ] = await Promise.all([
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
        supabase
            .from(MAIN_SECTION_TABLE)
            .select('id, student_id, ratings, template_version, saved_by, updated_at')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classRecord.id)
            .eq('term_id', termRecord.id),
    ]);

    if (studentError) throw studentError;
    if (sectionError) throwSettlingInStorageError(sectionError);
    if (mainSectionError) throwSettlingInStorageError(mainSectionError);

    const sectionsByStudent = new Map();
    (savedSections || []).forEach((row) => {
        if (!sectionsByStudent.has(row.student_id)) sectionsByStudent.set(row.student_id, {});
        sectionsByStudent.get(row.student_id)[row.subject_key] = shapeSection(row, template);
    });
    const mainSectionsByStudent = new Map((savedMainSections || []).map((row) => [
        row.student_id,
        shapeMainTeacherSection(row),
    ]));

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
            mainTeacherSection: mainSectionsByStudent.get(student.id) || null,
        })),
    });
});

/**
 * GET /api/settling-in/subject-classes/:classId?termId=...
 * Subject-teacher workspace data: active class roster plus completion counts
 * for only that teacher's assigned English/Amharic sections. Ratings are not
 * returned for unselected students; their individual detail uses the route below.
 */
const getSubjectClassReport = asyncHandler(async (req, res) => {
    const { classRecord, termRecord, template } = await requireClassAndTerm(
        req,
        req.params.classId,
        req.query.termId,
    );
    const subjects = await getSubjectTeacherAssignments(req, classRecord, termRecord, template);
    if (subjects.length === 0) {
        throw new ForbiddenError('You are not assigned to teach English or Amharic in this class for this term');
    }

    const subjectOnlyTemplate = {
        yearLevel: template.yearLevel,
        label: template.label,
        version: template.version,
        ratingOrder: template.ratingOrder,
        ratings: template.ratings,
        subjects,
    };
    const subjectKeys = subjects.map((subject) => subject.key);
    const [
        { data: students, error: studentError },
        { data: savedSections, error: sectionError },
    ] = await Promise.all([
        supabase
            .from('students')
            .select('id, name, admission_no, roll_num, class_id, is_active')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classRecord.id)
            .eq('is_active', true)
            .order('roll_num', { ascending: true })
            .order('name', { ascending: true }),
        supabase
            .from(SECTION_TABLE)
            .select('id, student_id, subject_key, ratings, updated_at')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classRecord.id)
            .eq('term_id', termRecord.id)
            .in('subject_key', subjectKeys),
    ]);
    if (studentError) throw studentError;
    if (sectionError) throwSettlingInStorageError(sectionError);

    const subjectByKey = new Map(subjects.map((subject) => [subject.key, subject]));
    const sectionsByStudent = new Map();
    (savedSections || []).forEach((row) => {
        const subject = subjectByKey.get(row.subject_key);
        if (!subject) return;
        const ratings = row.ratings && typeof row.ratings === 'object' && !Array.isArray(row.ratings)
            ? row.ratings
            : {};
        const ratedCount = subject.criteria.filter(({ id }) => RATING_VALUES.has(ratings[id])).length;
        if (!sectionsByStudent.has(row.student_id)) sectionsByStudent.set(row.student_id, {});
        sectionsByStudent.get(row.student_id)[row.subject_key] = {
            subjectKey: row.subject_key,
            ratedCount,
            totalCount: subject.criteria.length,
            complete: subject.criteria.length > 0 && ratedCount === subject.criteria.length,
            updatedAt: row.updated_at,
        };
    });

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
        template: subjectOnlyTemplate,
        students: sortStudentsCanonically(students || []).map((student) => ({
            id: student.id,
            name: normalizeStudentName(student.name),
            admissionNo: normalizeStudentName(student.admission_no) || student.admission_no,
            rollNum: student.roll_num,
            sections: sectionsByStudent.get(student.id) || {},
        })),
    });
});

/**
 * GET /api/settling-in/subject-reports/:classId?termId=...&subjectKey=...&studentId=...
 * Subject teachers get exactly one assigned English or Amharic section for
 * one active student. This intentionally uses a separate route from the
 * admin/main-teacher class report so no other report sections can leak.
 */
const getSubjectTeacherReport = asyncHandler(async (req, res) => {
    if (req.user.role !== 'subject_teacher') {
        throw new ForbiddenError('Only subject teachers may print their assigned Settling In section');
    }

    const { classRecord, termRecord, template } = await requireClassAndTerm(
        req,
        req.params.classId,
        req.query.termId,
    );
    const subjectKey = String(req.query.subjectKey || '').toLowerCase();
    const subject = getSubjectForYear(template.yearLevel, subjectKey);

    if (!SUBJECT_REPORT_CODES[subjectKey] || !subject || subject.assessorRole !== 'subject_teacher') {
        throw new BadRequestError('Only English and Amharic subject reports are available');
    }
    const assignedSubjects = await getSubjectTeacherAssignments(req, classRecord, termRecord, template);
    if (!assignedSubjects.some((item) => item.key === subjectKey)) {
        throw new ForbiddenError(`You are not assigned to teach ${subject.label} in this class for this term`);
    }

    const subjectOnlyTemplate = {
        yearLevel: template.yearLevel,
        label: template.label,
        version: template.version,
        ratingOrder: template.ratingOrder,
        ratings: template.ratings,
        subjects: [subject],
    };
    const student = await requireOwnedRecord(
        'students',
        req.query.studentId,
        'id, name, admission_no, roll_num, class_id, is_active',
        req.user.school_id,
        'Student',
    );
    if (student.class_id !== classRecord.id) {
        throw new BadRequestError('Student is not enrolled in the selected class');
    }
    if (!student.is_active) {
        throw new BadRequestError('Inactive students cannot be assessed in the current class report');
    }

    const { data: savedSection, error: sectionError } = await supabase
        .from(SECTION_TABLE)
        .select('id, student_id, subject_key, ratings, criteria_snapshot, template_version, saved_by, updated_at')
        .eq('school_id', req.user.school_id)
        .eq('class_id', classRecord.id)
        .eq('student_id', student.id)
        .eq('term_id', termRecord.id)
        .eq('subject_key', subjectKey)
        .maybeSingle();
    if (sectionError) throwSettlingInStorageError(sectionError);

    const ownCriteriaRatings = savedSection
        ? Object.fromEntries(subject.criteria.map(({ id }) => [id, savedSection.ratings?.[id] || null]))
        : null;
    const ownSection = savedSection
        ? shapeSection({
            ...savedSection,
            ratings: ownCriteriaRatings,
            criteria_snapshot: subject.criteria,
        }, subjectOnlyTemplate)
        : null;

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
        subject: { key: subject.key, label: subject.label },
        template: subjectOnlyTemplate,
        student: {
            id: student.id,
            name: normalizeStudentName(student.name),
            admissionNo: normalizeStudentName(student.admission_no) || student.admission_no,
            rollNum: student.roll_num,
            sections: ownSection ? { [subjectKey]: ownSection } : {},
        },
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
    if (req.user.role === 'subject_teacher') {
        if (!SUBJECT_REPORT_CODES[subject.key] || subject.assessorRole !== 'subject_teacher') {
            throw new ForbiddenError('Subject teachers may edit only English or Amharic sections');
        }
        const assignedSubjects = await getSubjectTeacherAssignments(req, classRecord, termRecord, template);
        if (!assignedSubjects.some((item) => item.key === subject.key)) {
            throw new ForbiddenError(`You are not assigned to teach ${subject.label} in this class for this term`);
        }
    } else {
        await assertMainTeacherClassAccess(req, classRecord, termRecord);
        if (req.user.role === 'main_teacher' && subject.assessorRole !== 'main_teacher') {
            throw new ForbiddenError('Main teachers cannot edit English or Amharic subject-teacher sections');
        }
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

/**
 * PUT /api/settling-in/main-teacher
 * Save the three form-tutor ratings separately from subject attainment.
 * Admins may correct any section; assigned main teachers may save their own.
 */
const saveMainTeacherSection = asyncHandler(async (req, res) => {
    const { classId, studentId, termId, ratings } = req.body;
    const { classRecord, termRecord, template } = await requireClassAndTerm(req, classId, termId);
    await assertMainTeacherClassAccess(req, classRecord, termRecord);

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

    const normalizedRatings = normalizeMainTeacherRatings(ratings);
    const payload = {
        school_id: req.user.school_id,
        class_id: classRecord.id,
        student_id: student.id,
        term_id: termRecord.id,
        grade_level: template.yearLevel,
        template_version: MAIN_TEACHER_TEMPLATE_VERSION,
        ratings: normalizedRatings,
        saved_by: req.user.id,
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
        .from(MAIN_SECTION_TABLE)
        .upsert(payload, {
            onConflict: 'school_id,class_id,student_id,term_id',
        })
        .select('id, ratings, template_version, saved_by, updated_at')
        .single();

    if (error) throwSettlingInStorageError(error);
    res.json({ section: shapeMainTeacherSection(data) });
});

module.exports = {
    getClassReport,
    getSubjectClassReport,
    getSubjectTeacherReport,
    saveSection,
    saveMainTeacherSection,
    gradeForClass,
    normalizeRatings,
    normalizeMainTeacherRatings,
};
