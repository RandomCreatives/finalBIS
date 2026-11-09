import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { sortClassRoster } from './rosterSort';

const gradeFor = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
};

const hasNumericValue = (value) => value !== null && value !== undefined
    && value !== '' && Number.isFinite(Number(value));

const safeSegment = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'Report';

export const marksheetExportFilename = (data, klass = null, extension = 'xlsx', subject = null) => [
    'Teacher-Marksheets',
    data?.term?.name,
    data?.academicYear?.name,
    klass?.name || 'All-Classes',
    ...(subject?.name ? [subject.name] : []),
].map(safeSegment).join('_') + `.${extension}`;

const classSubjectDescriptors = (data, classId) => {
    const bySubject = new Map();
    const ensure = (subject) => {
        if (subject?.id && !bySubject.has(subject.id)) {
            bySubject.set(subject.id, { subject, assignments: [] });
        }
        return subject?.id ? bySubject.get(subject.id) : null;
    };

    (data.assignments || []).filter((row) => String(row.classId) === String(classId))
        .forEach((assignment) => {
            const descriptor = ensure(assignment.subject);
            if (descriptor) descriptor.assignments.push(assignment);
        });
    (data.assessments || []).filter((row) => String(row.classId) === String(classId))
        .forEach((assessment) => ensure(assessment.subject));
    (data.finals || []).filter((row) => String(row.classId) === String(classId))
        .forEach((mark) => ensure(mark.subject));

    return [...bySubject.values()].sort((a, b) =>
        (a.subject.name || '').localeCompare(b.subject.name || '')
        || String(a.subject.code || '').localeCompare(String(b.subject.code || '')),
    );
};

const teacherFor = (descriptor, klass) => {
    if (descriptor.subject.taughtBy === 'main_teacher') {
        return klass.mainTeacher?.name
            || descriptor.assignments.find((assignment) => assignment.teacher?.name)?.teacher.name
            || 'No main teacher assigned';
    }
    const teachers = [...new Set(descriptor.assignments
        .map((assignment) => assignment.teacher?.name)
        .filter(Boolean))];
    return teachers.join(' / ') || 'No current assignment';
};

const studentsForClass = (data, klass) => {
    const byId = new Map();
    const add = (student) => {
        if (!student?.id) return;
        const current = byId.get(student.id) || {};
        byId.set(student.id, {
            ...current,
            ...student,
            classId: klass.id,
            name: student.name || current.name || 'Unknown student',
        });
    };

    (data.students || []).filter((student) => String(student.classId) === String(klass.id))
        .forEach(add);
    (data.assessments || []).filter((assessment) => String(assessment.classId) === String(klass.id))
        .forEach((assessment) => (assessment.marks || []).forEach((mark) => add(mark.student || { id: mark.studentId })));
    (data.finals || []).filter((mark) => String(mark.classId) === String(klass.id))
        .forEach((mark) => add(mark.student || { id: mark.studentId }));

    return sortClassRoster([...byId.values()]);
};

const markedStudentIdsFor = (assessments, finals) => {
    const ids = new Set();
    (assessments || []).forEach((assessment) => (assessment.marks || []).forEach((mark) => {
        if (hasNumericValue(mark.marks) && mark.studentId) ids.add(String(mark.studentId));
    }));
    (finals || []).forEach((mark) => {
        if (hasNumericValue(mark.marks) && mark.studentId) ids.add(String(mark.studentId));
    });
    return ids;
};

const numericMarkCount = (marks) => (marks || []).filter((mark) => hasNumericValue(mark.marks)).length;

const coverageLabel = (entered, expected) => expected > 0
    ? `${entered}/${expected} (${Math.round((entered / expected) * 100)}%)`
    : '—';

const assessmentMarkFor = (assessment, studentId) =>
    (assessment.marks || []).find((mark) => String(mark.studentId) === String(studentId));

const finalMarkForStudent = (assessments, finalRows, studentId) => {
    const savedFinal = finalRows.find((row) => String(row.studentId) === String(studentId));
    let marks = 0;
    let maxMarks = 0;
    let hasAssessmentMark = false;

    assessments.forEach((assessment) => {
        const entry = assessmentMarkFor(assessment, studentId);
        if (!hasNumericValue(entry?.marks)) return;
        hasAssessmentMark = true;
        marks += Number(entry.marks);
        maxMarks += Number(assessment.maxMarks) || 0;
    });

    const finalMarks = savedFinal
        ? Number(savedFinal.marks)
        : hasAssessmentMark ? marks : null;
    const finalMax = savedFinal
        ? Number(savedFinal.maxMarks)
        : hasAssessmentMark ? maxMarks : null;
    const percentage = savedFinal && hasNumericValue(savedFinal.percentage)
        ? Number(savedFinal.percentage)
        : finalMax > 0 ? Number(((finalMarks / finalMax) * 100).toFixed(2)) : null;

    return {
        marks: finalMarks === null ? '' : finalMarks,
        maxMarks: finalMax === null ? '' : finalMax,
        percentage: percentage === null ? '' : percentage,
        grade: savedFinal?.grade || (percentage === null ? '' : gradeFor(percentage)),
    };
};

/** Build rows for one class worksheet; exposed for focused export tests. */
export const markSheetRowsForClass = (data, klass) => {
    const descriptors = classSubjectDescriptors(data, klass.id);
    const students = studentsForClass(data, klass);
    const rows = [
        [`Teacher marksheet summary — ${klass.name}`],
        ['Academic year', data.academicYear?.name || ''],
        ['Term', data.term?.name || ''],
        [],
        ['Class summary'],
        [
            'Subject', 'Code', 'Teacher', 'Assessment columns', 'Students with any marks',
            'Final marks saved', 'Assessment entries', 'Expected entries', 'Assessment mark-entry coverage',
        ],
    ];

    const detailBySubject = new Map();
    descriptors.forEach((descriptor) => {
        const subjectId = descriptor.subject.id;
        const assignments = descriptor.assignments;
        const assessments = (data.assessments || [])
            .filter((assessment) => String(assessment.classId) === String(klass.id)
                && String(assessment.subjectId) === String(subjectId))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                || (a.label || '').localeCompare(b.label || ''));
        const finals = (data.finals || []).filter((mark) =>
            String(mark.classId) === String(klass.id) && String(mark.subjectId) === String(subjectId));
        const marked = markedStudentIdsFor(assessments, finals);
        const assessmentEntries = assessments.reduce((total, assessment) =>
            total + numericMarkCount(assessment.marks), 0);
        const expectedAssessmentEntries = assessments.length * students.length;
        const finalMarksSaved = new Set(finals
            .filter((mark) => hasNumericValue(mark.marks))
            .map((mark) => String(mark.studentId))).size;
        const teacher = teacherFor({ ...descriptor, assignments }, klass);
        detailBySubject.set(subjectId, { descriptor, assessments, finals, teacher });
        rows.push([
            descriptor.subject.name || 'Unnamed subject',
            descriptor.subject.code || '',
            teacher,
            assessments.length,
            marked.size,
            finalMarksSaved,
            assessmentEntries,
            expectedAssessmentEntries,
            coverageLabel(assessmentEntries, expectedAssessmentEntries),
        ]);
    });

    if (descriptors.length === 0) {
        rows.push(['No subjects or saved marks were found for this class and term.']);
    }

    rows.push([], ['Assessment detail']);
    descriptors.forEach((descriptor) => {
        const { assessments, finals, teacher } = detailBySubject.get(descriptor.subject.id);
        rows.push([`${descriptor.subject.name || 'Unnamed subject'}${descriptor.subject.code ? ` (${descriptor.subject.code})` : ''}`,
            'Teacher', teacher]);
        if (assessments.length === 0) {
            rows.push(['No assessment columns were configured for this subject in the selected term.']);
        }

        rows.push([
            'Roll',
            'Admission No.',
            'Student',
            ...assessments.map((assessment) => `${assessment.label} (/${assessment.maxMarks})`),
            'Final marks',
            'Final max',
            'Final %',
            'Grade',
        ]);
        const finalMarksSaved = new Set(finals
            .filter((mark) => hasNumericValue(mark.marks))
            .map((mark) => String(mark.studentId))).size;
        rows.push([
            'Mark-entry coverage',
            '',
            '',
            ...assessments.map((assessment) => coverageLabel(
                new Set((assessment.marks || [])
                    .filter((mark) => hasNumericValue(mark.marks))
                    .map((mark) => String(mark.studentId))).size,
                students.length,
            )),
            `Finals: ${coverageLabel(finalMarksSaved, students.length)}`,
            '',
            '',
            '',
        ]);

        students.forEach((student) => {
            const rawMarks = assessments.map((assessment) => {
                const entry = assessmentMarkFor(assessment, student.id);
                return hasNumericValue(entry?.marks) ? Number(entry.marks) : '';
            });
            const final = finalMarkForStudent(assessments, finals, student.id);
            rows.push([
                student.rollNum ?? '',
                student.admissionNo || '',
                student.name || '',
                ...rawMarks,
                final.marks,
                final.maxMarks,
                final.percentage,
                final.grade,
            ]);
        });
        rows.push([]);
    });

    return rows;
};

const uniqueSheetName = (value, usedNames) => {
    const base = String(value || 'Class')
        .replace(/./g, (character) => '[]:*?/\\'.includes(character) ? '-' : character)
        .replace(/-+/g, '-')
        .trim()
        .slice(0, 31) || 'Class';
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate.toLocaleLowerCase())) {
        const ending = `-${suffix}`;
        candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
        suffix += 1;
    }
    usedNames.add(candidate.toLocaleLowerCase());
    return candidate;
};

const sheetForClass = (data, klass) => {
    const rows = markSheetRowsForClass(data, klass);
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const maxAssessmentColumns = Math.max(0, ...(data.assessments || [])
        .filter((assessment) => String(assessment.classId) === String(klass.id))
        .reduce((counts, assessment) => {
            counts.set(assessment.subjectId, (counts.get(assessment.subjectId) || 0) + 1);
            return counts;
        }, new Map()).values());
    const detailColumns = 3 + maxAssessmentColumns + 4;
    const columns = Math.max(9, detailColumns);
    worksheet['!cols'] = Array.from({ length: columns }, (_, index) => ({
        wch: index === 0 ? 10 : index === 1 ? 18 : index === 2 ? 28 : 18,
    }));
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns - 1 } }];
    return worksheet;
};

export const createMarksheetWorkbook = (data) => {
    const classes = data?.classes || [];
    if (classes.length === 0) throw new Error('There are no classes to export.');

    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();
    classes.forEach((klass) => {
        XLSX.utils.book_append_sheet(
            workbook,
            sheetForClass(data, klass),
            uniqueSheetName(klass.name, usedNames),
        );
    });
    return workbook;
};

export const downloadMarksheetWorkbook = (data, filename) =>
    XLSX.writeFile(createMarksheetWorkbook(data), filename);

export const createMarksheetZip = async (data) => {
    const classes = data?.classes || [];
    if (classes.length === 0) throw new Error('There are no classes to export.');

    const zip = new JSZip();
    const usedFilenames = new Set();
    classes.forEach((klass) => {
        const workbook = createMarksheetWorkbook({ ...data, classes: [klass] });
        const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const base = marksheetExportFilename(data, klass);
        const dot = base.lastIndexOf('.');
        const stem = base.slice(0, dot);
        const extension = base.slice(dot);
        let filename = base;
        let suffix = 2;
        while (usedFilenames.has(filename.toLocaleLowerCase())) {
            filename = `${stem}-${suffix}${extension}`;
            suffix += 1;
        }
        usedFilenames.add(filename.toLocaleLowerCase());
        zip.file(filename, content);
    });

    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });
};

export const downloadMarksheetBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
