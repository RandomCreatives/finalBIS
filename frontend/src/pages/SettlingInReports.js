import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, Divider, MenuItem, Paper, Stack, Table,
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

const INPUT_RATING_ORDER = ['WT', 'WW', 'WA'];
const PRINT_SUBJECT_COLUMNS = [
    { left: ['english'], right: ['mathematics'] },
    { left: ['science', 'amharic'], right: ['global_citizenship'] },
];
const RATING_LABELS = {
    WT: 'Working Towards',
    WW: 'Working Within',
    WA: 'Working Above',
};

const isSupportedClass = (klass) => [3, 4].includes(Number(klass?.yearLevel));
const nameForSubject = (template, key) => template?.subjects?.find((item) => item.key === key);
const countRatings = (criteria = [], ratings = {}) => criteria.filter(
    ({ id }) => ['WT', 'WW', 'WA'].includes(ratings?.[id]),
).length;
const cleanRatings = (criteria = [], ratings = {}) => Object.fromEntries(
    criteria.map(({ id }) => [id, ratings?.[id] || null]),
);

function ReportSubjectTable({ subject, ratings = {}, ratingOrder = INPUT_RATING_ORDER, compact = false }) {
    return (
        <Box sx={{ mb: compact ? 1.2 : 2 }}>
            <Typography sx={{ fontWeight: 900, fontSize: compact ? 10 : 15, mb: 0.5, fontFamily: '"Times New Roman", Georgia, serif' }}>
                {subject.label}
            </Typography>
            <Table size="small" sx={{
                tableLayout: 'fixed',
                '& th, & td': {
                    border: '1px solid #64748b',
                    fontFamily: '"Times New Roman", Georgia, serif',
                    fontSize: compact ? 8.5 : 12,
                    lineHeight: compact ? 1.14 : 1.35,
                    px: compact ? 0.45 : 1,
                    py: compact ? 0.3 : 0.7,
                    verticalAlign: 'top',
                },
                '& th': { bgcolor: '#e2e8f0', fontWeight: 900 },
                '& .rating-cell': { width: compact ? 26 : 46, textAlign: 'center', verticalAlign: 'middle' },
            }}>
                <TableHead>
                    <TableRow>
                        <TableCell>Learning objective</TableCell>
                        {ratingOrder.map((rating) => (
                            <TableCell key={rating} className="rating-cell">{rating}</TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {subject.criteria.map((criterion) => (
                        <TableRow key={criterion.id}>
                            <TableCell sx={{ overflowWrap: 'anywhere' }}>{criterion.text}</TableCell>
                            {ratingOrder.map((rating) => (
                                <TableCell key={rating} className="rating-cell">
                                    {ratings?.[criterion.id] === rating ? '✓' : '□'}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

function ReportIdentity({ student, report, classRecord, yearName, continuation = false }) {
    const formTutor = classRecord?.mainTeacher?.name || '—';
    return (
        <>
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 0.6 }}>
                <Box component="img" src="/bis-logo.png" alt="British International School Addis Ababa"
                    sx={{ width: 78, height: 'auto', objectFit: 'contain' }} />
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 13, lineHeight: 1.1, fontFamily: '"Times New Roman", Georgia, serif' }}>
                        British International School · Gerji Campus
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: '#334155', fontFamily: '"Times New Roman", Georgia, serif' }}>
                        SETTLING IN REPORT {continuation ? '· CONTINUED' : ''}
                    </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 11, fontFamily: '"Times New Roman", Georgia, serif' }}>
                        {report.term?.name || 'Term'} · {yearName || 'Academic year'}
                    </Typography>
                    <Typography sx={{ fontSize: 9, fontFamily: '"Times New Roman", Georgia, serif' }}>
                        {report.template.label} · Page {continuation ? '2' : '1'} of 2
                    </Typography>
                </Box>
            </Stack>
            <Divider sx={{ borderColor: '#1e3a8a', mb: 0.8 }} />
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 1, fontFamily: '"Times New Roman", Georgia, serif' }}>
                <Typography sx={{ fontSize: 10, fontFamily: 'inherit' }}><b>Name:</b> {student.name}</Typography>
                <Typography sx={{ fontSize: 10, fontFamily: 'inherit' }}><b>Class:</b> {classRecord.name}</Typography>
                <Typography sx={{ fontSize: 10, fontFamily: 'inherit' }}><b>Form tutor:</b> {formTutor}</Typography>
                {student.admissionNo && <Typography sx={{ fontSize: 10, fontFamily: 'inherit' }}><b>Admission no.:</b> {student.admissionNo}</Typography>}
            </Stack>
        </>
    );
}

function PrintReportPage({ student, report, classRecord, yearName, pageIndex, isLast }) {
    const columns = PRINT_SUBJECT_COLUMNS[pageIndex];
    const subjectMap = new Map(report.template.subjects.map((subject) => [subject.key, subject]));
    const sectionRatings = (key) => student.sections?.[key]?.ratings || {};

    return (
        <Paper
            square
            elevation={0}
            className={`settling-in-page${isLast ? ' settling-in-last-page' : ''}`}
            data-testid={`settling-in-page-${student.id}-${pageIndex + 1}`}
            sx={{
                boxSizing: 'border-box', width: '100%', maxWidth: 1120, minHeight: 680,
                mx: 'auto', mb: 2, p: { xs: 1.5, md: 2.5 }, border: '1px solid #1e3a8a',
                bgcolor: '#fff', color: '#0f172a', pageBreakInside: 'avoid',
            }}
        >
            <ReportIdentity
                student={student}
                report={report}
                classRecord={classRecord}
                yearName={yearName}
                continuation={pageIndex === 1}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, alignItems: 'start' }}>
                {[columns.left, columns.right].map((subjectKeys, columnIndex) => (
                    <Box key={columnIndex}>
                        {subjectKeys.map((key) => {
                            const subject = subjectMap.get(key);
                            return subject ? (
                                <ReportSubjectTable
                                    key={key}
                                    subject={subject}
                                    ratings={sectionRatings(key)}
                                    ratingOrder={report.template.ratingOrder}
                                    compact
                                />
                            ) : null;
                        })}
                    </Box>
                ))}
            </Box>
            {pageIndex === 1 && (
                <Box sx={{ mt: 0.5, pt: 0.4, borderTop: '1px solid #94a3b8', fontFamily: '"Times New Roman", Georgia, serif' }}>
                    <Typography sx={{ fontSize: 8.5, fontFamily: 'inherit' }}>
                        <b>Curriculum attainment:</b> WT — Working Towards · WW — Working Within · WA — Working Above
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

export default function SettlingInReports() {
    const [academicYearId, setAcademicYearId] = useState('');
    const [classId, setClassId] = useState('');
    const [termId, setTermId] = useState('');
    const [studentId, setStudentId] = useState('');
    const [subjectKey, setSubjectKey] = useState('english');
    const [draftRatings, setDraftRatings] = useState({});
    const [mode, setMode] = useState('assess');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    const classes = useApi(() => classApi.list(), []);
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
        () => (classes.data || []).filter(isSupportedClass),
        [classes.data],
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
    const selectedSubject = nameForSubject(report?.template, subjectKey) || report?.template?.subjects?.[0] || null;
    const selectedSection = selectedStudent?.sections?.[selectedSubject?.key] || null;
    const savedRatings = selectedSection?.ratings;
    const savedSectionUpdatedAt = selectedSection?.updatedAt;
    const yearName = (years.data || []).find((item) => String(item.id) === String(resolvedAcademicYearId))?.name
        || (years.data || []).find((item) => String(item.id) === String(report?.term?.academicYearId))?.name
        || '';

    useEffect(() => {
        if (String(termId) !== String(resolvedTermId)) setTermId(resolvedTermId);
    }, [resolvedTermId, termId]);

    useEffect(() => {
        if (supportedClasses.length && !supportedClasses.some((item) => String(item.id) === String(classId))) {
            setClassId(supportedClasses[0].id);
        }
    }, [supportedClasses, classId]);

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
                @page { size: A4 landscape; margin: 8mm; }
                @media print {
                    body * { visibility: hidden; }
                    #settling-in-print-area, #settling-in-print-area * { visibility: visible; }
                    #settling-in-print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
                    #settling-in-print-area .settling-in-page {
                        width: 100% !important; max-width: none !important; height: 190mm !important;
                        min-height: 0 !important; margin: 0 !important; padding: 0 !important;
                        border: 0 !important; overflow: hidden !important; page-break-inside: avoid;
                    }
                    #settling-in-print-area .settling-in-page:not(.settling-in-last-page) {
                        page-break-after: always; break-after: page;
                    }
                    #settling-in-print-area .settling-in-last-page { page-break-after: auto; break-after: auto; }
                    #settling-in-print-area .settling-in-page > div { max-width: none !important; }
                }
            `}</style>

            <PageHeader
                title="Settling In Report"
                subtitle="Admin-only assessment workspace · one saved section per student and subject · two landscape pages per student."
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
                    Year 3 and Year 4 use different teacher-provided criteria. The selected class determines which template is loaded; ratings start blank and are not copied from the sample PDFs.
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
                            <Card sx={{ p: 1.5, overflowX: 'auto' }}>
                                <Typography variant="h6" sx={{ mb: 1 }}>Class progress · {report.class.name}</Typography>
                                <Table size="small" data-testid="settling-in-progress-table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Student</TableCell>
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
                                                {report.template.subjects.map((subject) => (
                                                    <TableCell key={subject.key} align="center">
                                                        <Tooltip title={`Open ${subject.label} criteria for ${student.name}`}>
                                                            <Button
                                                                size="small"
                                                                color={countRatings(subject.criteria, student.sections?.[subject.key]?.ratings) === subject.criteria.length ? 'success' : 'primary'}
                                                                variant={student.id === studentId && subject.key === subjectKey ? 'contained' : 'outlined'}
                                                                onClick={() => startAssessment(student.id, subject.key)}
                                                                data-testid={`settling-in-open-${student.id}-${subject.key}`}
                                                            >
                                                                {countRatings(subject.criteria, student.sections?.[subject.key]?.ratings)}/{subject.criteria.length}
                                                            </Button>
                                                        </Tooltip>
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>

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
                                        {report.template.subjects.map((subject) => (
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
                                        Preview uses the selected class's Year {report.template.yearLevel} criteria. Print class reports prints two landscape pages for every active student.
                                    </Typography>
                                    <Box sx={{ flexGrow: 1 }} />
                                </Stack>
                            </Card>
                            {selectedStudent && PRINT_SUBJECT_COLUMNS.map((_, pageIndex) => (
                                <PrintReportPage
                                    key={`${selectedStudent.id}-${pageIndex}`}
                                    student={selectedStudent}
                                    report={report}
                                    classRecord={formTutorClass || report.class}
                                    yearName={yearName}
                                    pageIndex={pageIndex}
                                    isLast={pageIndex === PRINT_SUBJECT_COLUMNS.length - 1}
                                />
                            ))}
                        </Stack>
                    )}
                </DataState>
            )}

            {report && printStudents.length > 0 && (
                <Box id="settling-in-print-area" className="settling-in-print-only" aria-hidden="true">
                    {printStudents.flatMap((student, studentIndex) => PRINT_SUBJECT_COLUMNS.map((_, pageIndex) => {
                        const isLast = studentIndex === printStudents.length - 1
                            && pageIndex === PRINT_SUBJECT_COLUMNS.length - 1;
                        return (
                            <PrintReportPage
                                key={`${student.id}-${pageIndex}-print`}
                                student={student}
                                report={report}
                                classRecord={formTutorClass || report.class}
                                yearName={yearName}
                                pageIndex={pageIndex}
                                isLast={isLast}
                            />
                        );
                    }))}
                </Box>
            )}
        </>
    );
}
