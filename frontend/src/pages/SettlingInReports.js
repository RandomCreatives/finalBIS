import { Fragment, useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, MenuItem, Paper, Stack, Table,
    TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton,
    ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import PrintIcon from '@mui/icons-material/Print';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import {
    academicYearApi, classApi, settlingInApi, termApi,
} from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const INPUT_RATING_ORDER = ['WT', 'WW', 'WA'];
const PRINT_SUBJECT_PANELS = [
    { pageNumber: 2, subjectKeys: ['english', 'mathematics', 'science'] },
    { pageNumber: 3, subjectKeys: ['global_citizenship', 'amharic'] },
];
const PRINT_SIDES = ['outside', 'inside'];
const MAIN_TEACHER_RATING_ORDER = ['pleasing', 'satisfactory', 'cause_for_concern'];
const MAIN_TEACHER_RATING_LABELS = {
    pleasing: 'Pleasing',
    satisfactory: 'Satisfactory',
    cause_for_concern: 'Cause for Concern',
};
const DEFAULT_MAIN_TEACHER_CATEGORIES = [
    { key: 'conduct', label: 'Conduct' },
    { key: 'organisation', label: 'Organisation' },
    { key: 'attendance', label: 'Attendance' },
];
const SCHOOL_ADDRESS = [
    'British International School P.L.C.',
    'Sherif Building,',
    'Bole Ring Road,',
    'P. O. Box 5583',
    'Addis Ababa, Ethiopia',
    'Telephone 011-663-0707',
    'Fax: 011-661-4098',
];
const RATING_LABELS = {
    WT: 'Working Towards',
    WW: 'Working Within',
    WA: 'Working Above',
};

const isSupportedClass = (klass) => [3, 4].includes(Number(klass?.yearLevel));
const DEFAULT_MAIN_TEACHER_TEMPLATE = {
    version: 'settling-in-main-teacher-2026-27-v1',
    categories: DEFAULT_MAIN_TEACHER_CATEGORIES,
    ratingOrder: MAIN_TEACHER_RATING_ORDER,
    ratings: MAIN_TEACHER_RATING_LABELS,
};
const getMainTeacherTemplate = (template) => template?.mainTeacherSection
    || (template?.categories ? template : DEFAULT_MAIN_TEACHER_TEMPLATE);
const countRatings = (criteria = [], ratings = {}) => criteria.filter(
    ({ id }) => ['WT', 'WW', 'WA'].includes(ratings?.[id]),
).length;
const cleanRatings = (criteria = [], ratings = {}) => Object.fromEntries(
    criteria.map(({ id }) => [id, ratings?.[id] || null]),
);
const cleanMainTeacherRatings = (template, ratings = {}) => Object.fromEntries(
    getMainTeacherTemplate(template).categories.map(({ key }) => [key, ratings?.[key] || null]),
);
const formatPrintAcademicYear = (name) => {
    const match = String(name || '').match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
    return match ? `${match[1]}-${match[2].slice(-2)}` : (name || '');
};
const countMainTeacherRatings = (template, ratings = {}) => getMainTeacherTemplate(template).categories.filter(
    ({ key }) => MAIN_TEACHER_RATING_ORDER.includes(ratings?.[key]),
).length;

function PrintSubjectPanel({ student, report, subjectKeys, pageNumber }) {
    const subjectMap = new Map(report.template.subjects.map((subject) => [subject.key, subject]));
    const subjects = subjectKeys.map((key) => subjectMap.get(key)).filter(Boolean);
    const ratingOrder = report.template.ratingOrder;

    return (
        <Box className="settling-in-panel settling-in-subject-panel" data-testid={`settling-in-page-${student.id}-${pageNumber}`}>
            <Table size="small" data-testid={`settling-in-subject-panel-${student.id}-${pageNumber}`} sx={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                '& th, & td': {
                    border: '0.6pt solid #333',
                    fontFamily: '"Times New Roman", Georgia, serif',
                    fontSize: '12pt',
                    lineHeight: 1,
                    px: '0.4mm',
                    py: '0.15mm',
                    verticalAlign: 'top',
                },
                '& .criterion-cell': { width: '76%', overflowWrap: 'anywhere' },
                '& .rating-cell': { width: '8%', textAlign: 'center', verticalAlign: 'middle', px: 0 },
            }}>
                <TableBody>
                    {subjects.map((subject, subjectIndex) => (
                        <Fragment key={subject.key}>
                            <TableRow>
                                <TableCell className="criterion-cell" sx={{ fontWeight: 900, bgcolor: '#d6d6d6', fontSize: '12pt' }}>
                                    {subject.label}
                                </TableCell>
                                {ratingOrder.map((rating) => (
                                    <TableCell
                                        key={rating}
                                        className="rating-cell"
                                        sx={subjectIndex === 0
                                            ? { fontWeight: 900, bgcolor: '#d6d6d6', verticalAlign: 'middle' }
                                            : { bgcolor: '#4a4a4a', color: '#fff' }}
                                    >
                                        {subjectIndex === 0 ? rating : ''}
                                    </TableCell>
                                ))}
                            </TableRow>
                            {subject.criteria.map((criterion) => (
                                <TableRow key={criterion.id}>
                                    <TableCell className="criterion-cell">{criterion.text}</TableCell>
                                    {ratingOrder.map((rating) => (
                                        <TableCell key={rating} className="rating-cell">
                                            {student.sections?.[subject.key]?.ratings?.[criterion.id] === rating ? '✓' : ''}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </Fragment>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

function PageFourPanel({ student, report }) {
    const mainTeacherTemplate = getMainTeacherTemplate(report.template);
    const ratings = student.mainTeacherSection?.ratings || {};
    const attainmentKey = ['WT', 'WW', 'WA'];

    return (
        <Box className="settling-in-panel settling-in-page-four" data-testid={`settling-in-page-${student.id}-4`}>
            <Table size="small" data-testid={`settling-in-main-teacher-print-${student.id}`} sx={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                '& th, & td': {
                    border: '0.6pt solid #333',
                    fontFamily: '"Times New Roman", Georgia, serif',
                    fontSize: '12pt',
                    lineHeight: 1,
                    px: '0.4mm',
                    py: '0.45mm',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                },
                '& th:first-of-type, & td:first-of-type': { width: '27%', textAlign: 'left', fontWeight: 700 },
            }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontSize: '12pt' }} />
                        {mainTeacherTemplate.ratingOrder.map((rating) => (
                            <TableCell key={rating} sx={{ fontWeight: 700, fontSize: '12pt' }}>
                                {mainTeacherTemplate.ratings[rating]}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {mainTeacherTemplate.categories.map((category) => (
                        <TableRow key={category.key}>
                            <TableCell sx={{ fontSize: '12pt' }}>{category.label}</TableCell>
                            {mainTeacherTemplate.ratingOrder.map((rating) => (
                                <TableCell key={rating} sx={{ fontSize: '12pt' }}>
                                    {ratings[category.key] === rating ? '✓' : ''}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Table size="small" sx={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                mt: '24mm',
                '& th, & td': {
                    border: '0.6pt solid #333',
                    fontFamily: '"Times New Roman", Georgia, serif',
                    fontSize: '12pt',
                    lineHeight: 1,
                    px: '0.7mm',
                    py: '0.35mm',
                    verticalAlign: 'middle',
                },
                '& th:first-of-type, & td:first-of-type': { width: '27%', fontWeight: 900 },
            }}>
                <TableBody>
                    <TableRow>
                        <TableCell sx={{ bgcolor: '#666', color: '#fff' }}>Letter Grade</TableCell>
                        <TableCell colSpan={3} sx={{ bgcolor: '#c8c8c8', fontWeight: 900, fontSize: '12pt' }}>
                            Curriculum Attainment
                        </TableCell>
                    </TableRow>
                    {attainmentKey.map((rating) => (
                        <TableRow key={rating}>
                            <TableCell sx={{ bgcolor: '#666', color: '#fff', fontWeight: 900 }}>{rating}</TableCell>
                            <TableCell colSpan={3} sx={{ bgcolor: '#d1d1d1', fontWeight: 700 }}>
                                {RATING_LABELS[rating]}:- the expected level for the grade.
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Box sx={{ mt: 'auto', pt: 3, pb: 1, textAlign: 'center', fontFamily: 'cursive' }}>
                {SCHOOL_ADDRESS.map((line, index) => (
                    <Typography key={line} sx={{ fontFamily: 'inherit', fontStyle: 'italic', fontSize: '12pt', fontWeight: index === 0 ? 700 : 500, lineHeight: 1.28 }}>
                        {line}
                    </Typography>
                ))}
            </Box>
        </Box>
    );
}

function PageOnePanel({ student, report, classRecord, yearName }) {
    const formTutor = classRecord?.mainTeacher?.name || '—';
    return (
        <Box className="settling-in-panel settling-in-page-one" data-testid={`settling-in-page-${student.id}-1`}>
            <Box component="img" src="/bis-logo.png" alt="British International School Addis Ababa"
                sx={{ width: '100%', height: '36%', objectFit: 'contain', border: '0.4pt solid #ddd' }} />
            <Box sx={{ textAlign: 'center', mt: '10%', fontFamily: '"Times New Roman", Georgia, serif' }}>
                <Typography sx={{ fontFamily: 'inherit', fontSize: '17pt', lineHeight: 1.4 }}>
                    {report.term?.name || 'Term'}
                </Typography>
                <Typography sx={{ fontFamily: 'inherit', fontSize: '17pt', lineHeight: 1.4 }}>
                    {formatPrintAcademicYear(yearName)}
                </Typography>
                <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '16pt', mt: '13%', lineHeight: 1.25 }}>
                    SETTLING IN REPORT
                </Typography>
            </Box>
            <Stack spacing={1.2} sx={{ mt: 'auto', mb: '18%', px: '10%', fontFamily: '"Times New Roman", Georgia, serif' }}>
                <Typography sx={{ fontFamily: 'inherit', fontSize: '12pt' }}><b>Name:</b> {student.name}</Typography>
                <Typography sx={{ fontFamily: 'inherit', fontSize: '12pt' }}><b>Class:</b> {classRecord?.name || report.class.name}</Typography>
                <Typography sx={{ fontFamily: 'inherit', fontSize: '12pt' }}><b>Form Tutor:</b> {formTutor}</Typography>
            </Stack>
        </Box>
    );
}

function PrintReportSide({ student, report, classRecord, yearName, side, isLast }) {
    return (
        <Paper
            square
            elevation={0}
            className={`settling-in-sheet${isLast ? ' settling-in-last-sheet' : ''}`}
            data-testid={`settling-in-side-${student.id}-${side}`}
            sx={{
                boxSizing: 'border-box',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                width: '100%',
                maxWidth: 1120,
                aspectRatio: '297 / 210',
                minHeight: 680,
                mx: 'auto',
                mb: 2,
                bgcolor: '#fff',
                color: '#0f172a',
                overflow: 'hidden',
                pageBreakInside: 'avoid',
            }}
        >
            {side === 'outside' ? (
                <>
                    <PageFourPanel student={student} report={report} />
                    <PageOnePanel student={student} report={report} classRecord={classRecord} yearName={yearName} />
                </>
            ) : (
                <>
                    <PrintSubjectPanel
                        student={student}
                        report={report}
                        subjectKeys={PRINT_SUBJECT_PANELS[0].subjectKeys}
                        pageNumber={PRINT_SUBJECT_PANELS[0].pageNumber}
                    />
                    <PrintSubjectPanel
                        student={student}
                        report={report}
                        subjectKeys={PRINT_SUBJECT_PANELS[1].subjectKeys}
                        pageNumber={PRINT_SUBJECT_PANELS[1].pageNumber}
                    />
                </>
            )}
        </Paper>
    );
}

export default function SettlingInReports({ initialClassId = '' } = {}) {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isMainTeacher = user?.role === 'main_teacher';
    const [academicYearId, setAcademicYearId] = useState('');
    const [classId, setClassId] = useState(() => String(initialClassId || ''));
    const [termId, setTermId] = useState('');
    const [studentId, setStudentId] = useState('');
    const [subjectKey, setSubjectKey] = useState('english');
    const [draftRatings, setDraftRatings] = useState({});
    const [draftMainTeacherRatings, setDraftMainTeacherRatings] = useState({});
    const [mode, setMode] = useState('assess');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [savingMainTeacher, setSavingMainTeacher] = useState(false);
    const [mainTeacherSaveError, setMainTeacherSaveError] = useState('');
    const [mainTeacherSaveSuccess, setMainTeacherSaveSuccess] = useState('');

    const classes = useApi(
        () => classApi.list(isMainTeacher
            ? { mine: true, ...(academicYearId ? { academicYearId } : {}) }
            : undefined),
        [isMainTeacher, academicYearId],
    );
    const terms = useApi(() => termApi.list(), []);
    const years = useApi(() => academicYearApi.list(), []);
    const current = useApi(() => termApi.current(), []);

    const resolvedAcademicYearId = academicYearId
        || current.data?.term?.academicYearId
        || (years.data || []).find((item) => item.isCurrent)?.id
        || (years.data || [])[0]?.id
        || '';
    const termsForYear = useMemo(
        () => (terms.data || []).filter((item) => String(item.academicYearId) === String(resolvedAcademicYearId)),
        [terms.data, resolvedAcademicYearId],
    );
    const resolvedTermId = termsForYear.some((item) => String(item.id) === String(termId))
        ? termId
        : termsForYear.find((item) => String(item.id) === String(current.data?.term?.id))?.id
            || termsForYear[0]?.id
            || '';

    const supportedClasses = useMemo(
        () => (classes.data || []).filter((item) => isSupportedClass(item)
            && (isAdmin || (isMainTeacher && item.mainTeacher?.id === user?.id))),
        [classes.data, isAdmin, isMainTeacher, user?.id],
    );
    const selectedClass = supportedClasses.find((item) => String(item.id) === String(classId)) || null;
    const reportState = useApi(
        () => (classId && resolvedTermId
            ? settlingInApi.classReport(classId, resolvedTermId)
            : Promise.resolve(null)),
        [classId, resolvedTermId],
    );
    const fetchedReport = reportState.data;
    const report = fetchedReport?.class?.id === classId
        && fetchedReport?.term?.id === resolvedTermId
        ? fetchedReport
        : null;
    const students = useMemo(() => report?.students || [], [report?.students]);
    const selectedStudent = students.find((item) => String(item.id) === String(studentId)) || null;
    const editableSubjects = useMemo(
        () => (report?.template?.subjects || []).filter((subject) => isAdmin
            || (isMainTeacher && subject.assessorRole === 'main_teacher')),
        [report?.template?.subjects, isAdmin, isMainTeacher],
    );
    const selectedSubject = editableSubjects.find((item) => item.key === subjectKey)
        || editableSubjects[0]
        || null;
    const selectedSection = selectedStudent?.sections?.[selectedSubject?.key] || null;
    const savedRatings = selectedSection?.ratings;
    const savedSectionUpdatedAt = selectedSection?.updatedAt;
    const selectedMainTeacherSection = selectedStudent?.mainTeacherSection || null;
    const mainTeacherTemplate = getMainTeacherTemplate(report?.template);
    const savedMainTeacherRatings = selectedMainTeacherSection?.ratings;
    const savedMainTeacherUpdatedAt = selectedMainTeacherSection?.updatedAt;
    const yearName = (years.data || []).find((item) => String(item.id) === String(resolvedAcademicYearId))?.name
        || (years.data || []).find((item) => String(item.id) === String(report?.term?.academicYearId))?.name
        || '';

    useEffect(() => {
        if (String(termId) !== String(resolvedTermId)) setTermId(resolvedTermId);
    }, [resolvedTermId, termId]);

    useEffect(() => {
        if (classes.loading) return;
        if (!supportedClasses.some((item) => String(item.id) === String(classId))) {
            const preferredClass = supportedClasses.find(
                (item) => String(item.id) === String(initialClassId),
            );
            setClassId(String(preferredClass?.id || supportedClasses[0]?.id || ''));
        }
    }, [classes.loading, supportedClasses, classId, initialClassId]);

    useEffect(() => {
        if (editableSubjects.length && !editableSubjects.some((item) => item.key === subjectKey)) {
            setSubjectKey(editableSubjects[0].key);
        }
    }, [editableSubjects, subjectKey]);

    useEffect(() => {
        if (!students.length) {
            setStudentId('');
            return;
        }
        if (!students.some((item) => String(item.id) === String(studentId))) {
            setStudentId(students[0].id);
        }
    }, [students, studentId]);

    useEffect(() => {
        if (!selectedSubject) {
            setDraftRatings({});
            return;
        }
        setDraftRatings(cleanRatings(selectedSubject.criteria, savedRatings));
        setSaveError('');
        setSaveSuccess('');
    }, [classId, resolvedTermId, studentId, selectedSubject, report?.template?.version, savedRatings, savedSectionUpdatedAt]);

    useEffect(() => {
        setDraftMainTeacherRatings(cleanMainTeacherRatings(mainTeacherTemplate, savedMainTeacherRatings));
        setMainTeacherSaveError('');
        setMainTeacherSaveSuccess('');
    }, [classId, resolvedTermId, studentId, mainTeacherTemplate, savedMainTeacherRatings, savedMainTeacherUpdatedAt]);

    const formTutorClass = selectedClass || (report ? { name: report.class.name } : null);
    const printStudents = students;

    const saveCurrentSection = async () => {
        if (!selectedStudent || !selectedSubject || !classId || !resolvedTermId) return;
        setSaving(true);
        setSaveError('');
        setSaveSuccess('');
        try {
            await settlingInApi.saveSection({
                classId,
                studentId: selectedStudent.id,
                termId: resolvedTermId,
                subjectKey: selectedSubject.key,
                ratings: cleanRatings(selectedSubject.criteria, draftRatings),
            });
            await reportState.silentReload();
            setSaveSuccess(`${selectedSubject.label} saved for ${selectedStudent.name}.`);
        } catch (error) {
            setSaveError(error?.response?.data?.message || error.message || 'Could not save this section.');
        } finally {
            setSaving(false);
        }
    };

    const saveCurrentMainTeacherSection = async () => {
        if (!selectedStudent || !classId || !resolvedTermId) return;
        setSavingMainTeacher(true);
        setMainTeacherSaveError('');
        setMainTeacherSaveSuccess('');
        try {
            await settlingInApi.saveMainTeacherSection({
                classId,
                studentId: selectedStudent.id,
                termId: resolvedTermId,
                ratings: cleanMainTeacherRatings(mainTeacherTemplate, draftMainTeacherRatings),
            });
            await reportState.silentReload();
            setMainTeacherSaveSuccess(`Main teacher section saved for ${selectedStudent.name}.`);
        } catch (error) {
            setMainTeacherSaveError(error?.response?.data?.message || error.message || 'Could not save the main teacher section.');
        } finally {
            setSavingMainTeacher(false);
        }
    };

    const resetCurrentMainTeacherDraft = () => {
        setDraftMainTeacherRatings(cleanMainTeacherRatings(mainTeacherTemplate, selectedMainTeacherSection?.ratings));
        setMainTeacherSaveError('');
        setMainTeacherSaveSuccess('Draft reset to the last saved main teacher ratings.');
    };

    const resetCurrentDraft = () => {
        if (!selectedSubject) return;
        setDraftRatings(cleanRatings(selectedSubject.criteria, selectedSection?.ratings));
        setSaveError('');
        setSaveSuccess('Draft reset to the last saved ratings.');
    };

    const startAssessment = (nextStudentId, nextSubjectKey) => {
        setStudentId(nextStudentId);
        setSubjectKey(nextSubjectKey);
        setMode('assess');
    };

    return (
        <>
            <style>{`
                #settling-in-print-area { display: none; }
                .settling-in-sheet .settling-in-panel {
                    box-sizing: border-box; height: 100%; min-width: 0; overflow: hidden;
                    border: 1px solid #1e293b; padding: 12px; background: #fff;
                }
                .settling-in-page-four, .settling-in-page-one { display: flex; flex-direction: column; }
                .settling-in-subject-panel { display: block; }
                @page { size: A4 landscape; margin: 4mm; }
                @media print {
                    html, body { margin: 0 !important; }
                    body * { visibility: hidden; }
                    #settling-in-print-area, #settling-in-print-area * { visibility: visible; }
                    #settling-in-print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
                    #settling-in-print-area .settling-in-sheet {
                        display: grid !important; grid-template-columns: 1fr 1fr !important;
                        width: 100% !important; max-width: none !important; height: 202mm !important;
                        min-height: 0 !important; aspect-ratio: auto !important; margin: 0 !important;
                        padding: 0 !important; border: 0 !important; overflow: hidden !important;
                        page-break-inside: avoid; break-inside: avoid;
                    }
                    #settling-in-print-area .settling-in-sheet:not(.settling-in-last-sheet) {
                        page-break-after: always; break-after: page;
                    }
                    #settling-in-print-area .settling-in-last-sheet { page-break-after: auto; break-after: auto; }
                    #settling-in-print-area .settling-in-panel { height: 202mm !important; padding: 2mm !important; }
                    #settling-in-print-area table { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>

            <PageHeader
                title="Settling In Report"
                subtitle={isMainTeacher
                    ? 'Main-teacher pilot · assigned classes only · edit Maths, Science, Global Citizenship and the main-teacher section; English and Amharic are read-only.'
                    : 'Subject and main-teacher ratings saved per student · one duplex A4 sheet per student, folded into a four-page A5 booklet.'}
                action={mode === 'preview' && report && (
                    <Button
                        variant="contained"
                        startIcon={<PrintIcon />}
                        onClick={() => window.print()}
                        data-testid="settling-in-print-button"
                    >
                        Print class reports
                    </Button>
                )}
            />

            <Card sx={{ p: 2, mb: 2.5 }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }}>
                    <TextField
                        select label="Academic year" size="small" sx={{ minWidth: 190 }}
                        value={resolvedAcademicYearId}
                        disabled={years.loading || !(years.data || []).length}
                        onChange={(event) => {
                            setAcademicYearId(event.target.value);
                            setTermId('');
                        }}
                        data-testid="settling-in-year-select"
                    >
                        <MenuItem value=""><em>Choose an academic year…</em></MenuItem>
                        {(years.data || []).map((year) => (
                            <MenuItem key={year.id} value={year.id}>{year.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select label="Term" size="small" sx={{ minWidth: 170 }}
                        value={resolvedTermId}
                        disabled={!termsForYear.length}
                        onChange={(event) => setTermId(event.target.value)}
                        data-testid="settling-in-term-select"
                    >
                        <MenuItem value=""><em>Choose a term…</em></MenuItem>
                        {termsForYear.map((term) => (
                            <MenuItem key={term.id} value={term.id}>{term.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select label="Class" size="small" sx={{ minWidth: 240 }}
                        value={classId}
                        onChange={(event) => {
                            setClassId(event.target.value);
                            setStudentId('');
                        }}
                        data-testid="settling-in-class-select"
                    >
                        <MenuItem value=""><em>Choose a Year 3 or Year 4 class…</em></MenuItem>
                        {supportedClasses.map((klass) => (
                            <MenuItem key={klass.id} value={klass.id}>
                                {klass.name} · Year {klass.yearLevel}
                            </MenuItem>
                        ))}
                    </TextField>
                    {report?.template && (
                        <Chip
                            color="primary"
                            variant="outlined"
                            label={`${report.template.label} criteria · ${report.template.subjects.reduce((n, subject) => n + subject.criteria.length, 0)} objectives`}
                            data-testid="settling-in-grade-badge"
                        />
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <ToggleButtonGroup
                        exclusive size="small" value={mode}
                        onChange={(_, value) => value && setMode(value)}
                        data-testid="settling-in-mode-toggle"
                    >
                        <ToggleButton value="assess" sx={{ textTransform: 'none', fontWeight: 700 }}>Assess</ToggleButton>
                        <ToggleButton value="preview" sx={{ textTransform: 'none', fontWeight: 700 }}>Preview / print</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
                <Alert severity="info" sx={{ mt: 1.5 }}>
                    Year 3 and Year 4 use different teacher-provided criteria. Ratings start blank and are not copied from sample ticks. {isMainTeacher
                        ? 'This pilot is limited to your assigned classes. You can edit Maths, Science, Global Citizenship, and Conduct, Organisation, and Attendance. English and Amharic remain subject-teacher sections and are read-only; admins can make corrections.'
                        : 'Admins can edit every section. Main teachers are limited to their assigned classes and cannot edit the English or Amharic subject-teacher sections.'}
                </Alert>
            </Card>

            {!classId ? (
                <Alert severity="info">Choose a Year 3 or Year 4 class to begin.</Alert>
            ) : (
                <DataState
                    loading={classes.loading || terms.loading || years.loading || current.loading || reportState.loading}
                    error={classes.error || terms.error || years.error || current.error || reportState.error}
                >
                    {!resolvedTermId ? (
                        <Alert severity="info">Choose an academic year with at least one term to load this class's Settling In Report cards.</Alert>
                    ) : !report ? (
                        <Alert severity="info">Choose a term to load this class's Settling In Report cards.</Alert>
                    ) : students.length === 0 ? (
                        <Alert severity="info">There are no active students in this class.</Alert>
                    ) : mode === 'assess' ? (
                        <Stack spacing={2}>
                            <Card sx={{ p: { xs: 1.5, md: 2 } }} data-testid="settling-in-assessment-editor">
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 1.5 }}>
                                    <TextField
                                        select label="Student" size="small" sx={{ minWidth: 260 }}
                                        value={studentId}
                                        onChange={(event) => setStudentId(event.target.value)}
                                        data-testid="settling-in-student-select"
                                    >
                                        {students.map((student) => (
                                            <MenuItem key={student.id} value={student.id}>
                                                {student.rollNum ? `${student.rollNum}. ` : ''}{student.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <ToggleButtonGroup
                                        exclusive size="small" value={subjectKey}
                                        onChange={(_, value) => value && setSubjectKey(value)}
                                        data-testid="settling-in-subject-select"
                                        sx={{ flexWrap: 'wrap' }}
                                    >
                                        {editableSubjects.map((subject) => (
                                            <ToggleButton key={subject.key} value={subject.key} sx={{ textTransform: 'none', fontWeight: 700 }}>
                                                {subject.label}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Stack>

                                {selectedStudent && selectedSubject ? (
                                    <>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                                            <Box>
                                                <Typography variant="h6">{selectedStudent.name} · {selectedSubject.label}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {report.template.label} criteria · choose one rating for each objective.
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={`${countRatings(selectedSubject.criteria, draftRatings)} of ${selectedSubject.criteria.length} rated`}
                                                color={countRatings(selectedSubject.criteria, draftRatings) === selectedSubject.criteria.length ? 'success' : 'default'}
                                                variant="outlined"
                                            />
                                        </Stack>

                                        <Box sx={{ overflowX: 'auto' }}>
                                            <Table size="small" data-testid="settling-in-criteria-table">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 800, minWidth: 300 }}>Teacher-provided criterion</TableCell>
                                                        {INPUT_RATING_ORDER.map((rating) => (
                                                            <TableCell key={rating} align="center" sx={{ fontWeight: 800, minWidth: 145 }}>
                                                                <Tooltip title={RATING_LABELS[rating]}><span>{rating}</span></Tooltip>
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {selectedSubject.criteria.map((criterion, index) => (
                                                        <TableRow key={criterion.id}>
                                                            <TableCell>
                                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                    {index + 1}. {criterion.text}
                                                                </Typography>
                                                            </TableCell>
                    {INPUT_RATING_ORDER.map((rating) => (
                        <TableCell key={rating} align="center">
                            <Button
                                size="small"
                                variant={draftRatings[criterion.id] === rating ? 'contained' : 'outlined'}
                                color={draftRatings[criterion.id] === rating ? 'primary' : 'inherit'}
                                aria-label={`${RATING_LABELS[rating]} for ${criterion.text}`}
                                aria-pressed={draftRatings[criterion.id] === rating}
                                data-testid={`settling-in-rating-${criterion.id}-${rating}`}
                                onClick={() => {
                                    setDraftRatings((previous) => ({
                                        ...previous,
                                        [criterion.id]: previous[criterion.id] === rating ? null : rating,
                                    }));
                                    setSaveSuccess('');
                                }}
                                sx={{ minWidth: 48, fontWeight: 800 }}
                            >
                                {draftRatings[criterion.id] === rating && <CheckIcon fontSize="small" sx={{ mr: 0.25 }} />}
                                {rating}
                            </Button>
                        </TableCell>
                    ))}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Box>

                                        {saveError && <Alert severity="error" sx={{ mt: 1.5 }}>{saveError}</Alert>}
                                        {saveSuccess && <Alert severity="success" sx={{ mt: 1.5 }}>{saveSuccess}</Alert>}
                                        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
                                            <Button startIcon={<RestartAltIcon />} onClick={resetCurrentDraft} disabled={saving}>
                                                Reset to saved
                                            </Button>
                                            <Button
                                                variant="contained" startIcon={<SaveIcon />}
                                                onClick={saveCurrentSection} disabled={saving}
                                                data-testid="settling-in-save-section"
                                            >
                                                {saving ? 'Saving…' : `Save ${selectedSubject.label}`}
                                            </Button>
                                        </Stack>
                                    </>
                                ) : <Alert severity="info">Select a student and subject to assess.</Alert>}
                            </Card>

                            <Card sx={{ p: { xs: 1.5, md: 2 } }} data-testid="settling-in-main-teacher-editor">
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 1.5 }}>
                                    <Box>
                                        <Typography variant="h6">Conduct, Organisation &amp; Attendance · {selectedStudent?.name || 'Select a student'}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Main-teacher ratings · choose Pleasing, Satisfactory, or Cause for Concern for each item.
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={`${countMainTeacherRatings(mainTeacherTemplate, draftMainTeacherRatings)} of ${mainTeacherTemplate.categories.length} rated`}
                                        color={countMainTeacherRatings(mainTeacherTemplate, draftMainTeacherRatings) === mainTeacherTemplate.categories.length ? 'success' : 'default'}
                                        variant="outlined"
                                    />
                                </Stack>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
                                    {mainTeacherTemplate.categories.map((category) => (
                                        <TextField
                                            key={category.key}
                                            select
                                            label={category.label}
                                            size="small"
                                            value={draftMainTeacherRatings[category.key] || ''}
                                            onChange={(event) => {
                                                setDraftMainTeacherRatings((previous) => ({
                                                    ...previous,
                                                    [category.key]: event.target.value || null,
                                                }));
                                                setMainTeacherSaveSuccess('');
                                            }}
                                            data-testid={`settling-in-main-rating-${category.key}`}
                                        >
                                            <MenuItem value=""><em>Not rated</em></MenuItem>
                                            {mainTeacherTemplate.ratingOrder.map((rating) => (
                                                <MenuItem key={rating} value={rating}>{mainTeacherTemplate.ratings[rating]}</MenuItem>
                                            ))}
                                        </TextField>
                                    ))}
                                </Box>
                                {mainTeacherSaveError && <Alert severity="error" sx={{ mt: 1.5 }}>{mainTeacherSaveError}</Alert>}
                                {mainTeacherSaveSuccess && <Alert severity="success" sx={{ mt: 1.5 }}>{mainTeacherSaveSuccess}</Alert>}
                                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
                                    <Button onClick={resetCurrentMainTeacherDraft} disabled={savingMainTeacher}>
                                        Reset to saved
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<SaveIcon />}
                                        onClick={saveCurrentMainTeacherSection}
                                        disabled={savingMainTeacher || !selectedStudent}
                                        data-testid="settling-in-save-main-teacher"
                                    >
                                        {savingMainTeacher ? 'Saving…' : 'Save main teacher section'}
                                    </Button>
                                </Stack>
                            </Card>

                            <Card sx={{ p: 1.5, overflowX: 'auto' }}>
                                <Typography variant="h6" sx={{ mb: 1 }}>Class progress · {report.class.name}</Typography>
                                <Table size="small" data-testid="settling-in-progress-table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Student</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, minWidth: 125 }}>Main teacher</TableCell>
                                            {report.template.subjects.map((subject) => (
                                                <TableCell key={subject.key} align="center" sx={{ fontWeight: 800, minWidth: 125 }}>
                                                    {subject.label}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {students.map((student) => (
                                            <TableRow key={student.id} hover selected={student.id === studentId}>
                                                <TableCell>
                                                    <Button
                                                        size="small"
                                                        onClick={() => setStudentId(student.id)}
                                                        sx={{ textTransform: 'none', fontWeight: 700, justifyContent: 'flex-start' }}
                                                    >
                                                        {student.rollNum ? `${student.rollNum}. ` : ''}{student.name}
                                                    </Button>
                                                </TableCell>
                                                <TableCell align="center">
                                                    {(() => {
                                                        const ratedCount = countMainTeacherRatings(mainTeacherTemplate, student.mainTeacherSection?.ratings);
                                                        return (
                                                            <Button
                                                                size="small"
                                                                color={ratedCount === mainTeacherTemplate.categories.length ? 'success' : 'primary'}
                                                                variant={student.id === studentId ? 'contained' : 'outlined'}
                                                                onClick={() => setStudentId(student.id)}
                                                                data-testid={`settling-in-open-main-${student.id}`}
                                                            >
                                                                {ratedCount}/{mainTeacherTemplate.categories.length}
                                                            </Button>
                                                        );
                                                    })()}
                                                </TableCell>
                                                {report.template.subjects.map((subject) => {
                                                    const canEditSubject = isAdmin
                                                        || (isMainTeacher && subject.assessorRole === 'main_teacher');
                                                    const tooltip = canEditSubject
                                                        ? `Open ${subject.label} criteria for ${student.name}`
                                                        : `${subject.label} is a subject-teacher section and is read-only for main teachers`;
                                                    return (
                                                        <TableCell key={subject.key} align="center">
                                                            <Tooltip title={tooltip}>
                                                                <span>
                                                                    <Button
                                                                        size="small"
                                                                        disabled={!canEditSubject}
                                                                        color={countRatings(subject.criteria, student.sections?.[subject.key]?.ratings) === subject.criteria.length ? 'success' : 'primary'}
                                                                        variant={student.id === studentId && subject.key === selectedSubject?.key ? 'contained' : 'outlined'}
                                                                        onClick={() => startAssessment(student.id, subject.key)}
                                                                        data-testid={`settling-in-open-${student.id}-${subject.key}`}
                                                                    >
                                                                        {countRatings(subject.criteria, student.sections?.[subject.key]?.ratings)}/{subject.criteria.length}
                                                                    </Button>
                                                                </span>
                                                            </Tooltip>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </Stack>
                    ) : (
                        <Stack spacing={2} data-testid="settling-in-selected-preview">
                            <Card sx={{ p: 2 }}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                                    <TextField
                                        select label="Preview student" size="small" sx={{ minWidth: 260 }}
                                        value={studentId}
                                        onChange={(event) => setStudentId(event.target.value)}
                                        data-testid="settling-in-preview-student-select"
                                    >
                                        {students.map((student) => (
                                            <MenuItem key={student.id} value={student.id}>{student.name}</MenuItem>
                                        ))}
                                    </TextField>
                                    <Typography variant="body2" color="text.secondary">
                                        Each student uses one A4 landscape sheet, printed double-sided and folded into four A5 panels: Page 4/Page 1 outside, Pages 2/3 inside. Print text is at least 12 pt; margins and row padding are tightened to make room. For printing, choose duplex and flip on the short edge.
                                    </Typography>
                                    <Box sx={{ flexGrow: 1 }} />
                                </Stack>
                            </Card>
                            {selectedStudent && PRINT_SIDES.map((side, sideIndex) => (
                                <PrintReportSide
                                    key={`${selectedStudent.id}-${side}`}
                                    student={selectedStudent}
                                    report={report}
                                    classRecord={formTutorClass || report.class}
                                    yearName={yearName}
                                    side={side}
                                    isLast={sideIndex === PRINT_SIDES.length - 1}
                                />
                            ))}
                        </Stack>
                    )}
                </DataState>
            )}

            {report && printStudents.length > 0 && (
                <Box id="settling-in-print-area" className="settling-in-print-only" aria-hidden="true">
                    {printStudents.flatMap((student, studentIndex) => PRINT_SIDES.map((side, sideIndex) => {
                        const isLast = studentIndex === printStudents.length - 1
                            && sideIndex === PRINT_SIDES.length - 1;
                        return (
                            <PrintReportSide
                                key={`${student.id}-${side}-print`}
                                student={student}
                                report={report}
                                classRecord={formTutorClass || report.class}
                                yearName={yearName}
                                side={side}
                                isLast={isLast}
                            />
                        );
                    }))}
                </Box>
            )}
        </>
    );
}
