import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { settlingInApi, studentApi, termApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import { sortClassRoster } from '../utils/rosterSort';

const subjectKeyFor = (assignment) => {
    const code = String(assignment?.subject?.code || '').trim().toUpperCase();
    const name = String(assignment?.subject?.name || '').trim().toLowerCase();
    if (code === 'ENG' || name === 'english') return 'english';
    if (code === 'AMH' || name === 'amharic') return 'amharic';
    return null;
};

const supportsSettlingIn = (klass) => {
    const configuredYear = klass?.yearLevel ?? klass?.year_level;
    if (configuredYear !== null && configuredYear !== undefined && configuredYear !== '') {
        return [3, 4].includes(Number(configuredYear));
    }
    return /\byear\s*([34])\b/i.test(String(klass?.name || ''));
};

function SubjectSectionSheet({ report, student, teacherName }) {
    const subject = report.template.subjects[0];
    const section = student.sections?.[subject.key];
    const ratings = section?.ratings || {};
    const ratingOrder = report.template.ratingOrder || ['WT', 'WW', 'WA'];

    return (
        <Paper className="subject-report-sheet" variant="outlined" sx={{
            width: '100%', maxWidth: 780, mx: 'auto', p: { xs: 2, sm: 3 },
            borderRadius: 1.5, color: '#111', bgcolor: '#fff',
        }}>
            <Typography sx={{ fontWeight: 900, fontSize: '14pt', textAlign: 'center' }}>
                British International School P.L.C.
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '13pt', textAlign: 'center', mt: 0.25 }}>
                Settling In — {subject.label}
            </Typography>
            <Typography sx={{ fontSize: '12pt', textAlign: 'center', color: '#444', mb: 2 }}>
                {report.template.label} · {report.term.name}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2, fontSize: '12pt' }}>
                <Typography sx={{ fontSize: '12pt' }}><strong>Student:</strong> {student.name}</Typography>
                <Typography sx={{ fontSize: '12pt' }}><strong>Class:</strong> {report.class.name}</Typography>
                <Typography sx={{ fontSize: '12pt' }}><strong>Roll number:</strong> {student.rollNum ?? '—'}</Typography>
                <Typography sx={{ fontSize: '12pt' }}><strong>Admission no.:</strong> {student.admissionNo || '—'}</Typography>
            </Box>

            <TableContainer>
                <Table size="small" aria-label={`${subject.label} Settling In ratings`} sx={{
                    tableLayout: 'fixed', borderCollapse: 'collapse',
                    '& th, & td': {
                        border: '1px solid #333', color: '#111',
                        fontFamily: '"Times New Roman", Georgia, serif', fontSize: '12pt',
                        lineHeight: 1.2, px: 1, py: 0.75,
                    },
                    '& th:first-of-type, & td:first-of-type': { width: '70%' },
                    '& th:not(:first-of-type), & td:not(:first-of-type)': { width: '10%', textAlign: 'center' },
                }}>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#e8e8e8' }}>
                            <TableCell sx={{ fontWeight: 900 }}>Learning objective</TableCell>
                            {ratingOrder.map((rating) => (
                                <TableCell key={rating} sx={{ fontWeight: 900 }}>{rating}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {subject.criteria.map((criterion) => (
                            <TableRow key={criterion.id}>
                                <TableCell>{criterion.text}</TableCell>
                                {ratingOrder.map((rating) => (
                                    <TableCell key={rating}>
                                        {ratings[criterion.id] === rating ? '✓' : ''}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction="row" justifyContent="space-between" gap={2} sx={{ mt: 1.5 }}>
                <Typography sx={{ fontSize: '12pt' }}>
                    Saved ratings: {section?.ratedCount || 0} of {subject.criteria.length}
                </Typography>
                {teacherName && (
                    <Typography sx={{ fontSize: '12pt' }}>Subject teacher: {teacherName}</Typography>
                )}
            </Stack>
        </Paper>
    );
}

export default function SubjectReportPrinting({ assignments = [], loading: assignmentsLoading = false, error: assignmentsError = null, teacherName = '' }) {
    const [pairKey, setPairKey] = useState('');
    const [termId, setTermId] = useState('');
    const [studentId, setStudentId] = useState('');

    const reportPairs = useMemo(() => {
        const pairs = new Map();
        (assignments || []).forEach((assignment) => {
            const subjectKey = subjectKeyFor(assignment);
            const klass = assignment?.class;
            if (!subjectKey || !klass?.id || !supportsSettlingIn(klass)) return;
            const key = `${klass.id}|${subjectKey}`;
            if (!pairs.has(key)) {
                pairs.set(key, {
                    key,
                    classId: klass.id,
                    className: klass.name || 'Class',
                    subjectKey,
                    subjectName: assignment.subject?.name || (subjectKey === 'english' ? 'English' : 'Amharic'),
                });
            }
        });
        return [...pairs.values()].sort((a, b) =>
            a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName),
        );
    }, [assignments]);

    useEffect(() => {
        if (!reportPairs.some((pair) => pair.key === pairKey)) {
            setPairKey(reportPairs[0]?.key || '');
        }
    }, [reportPairs, pairKey]);
    const pair = reportPairs.find((option) => option.key === pairKey) || null;

    const termsApi = useApi(() => termApi.list(), []);
    const currentTermApi = useApi(() => termApi.current(), []);
    const currentTerm = currentTermApi.data?.term || null;
    const termsForYear = useMemo(() => {
        const allTerms = Array.isArray(termsApi.data) ? termsApi.data : [];
        const yearId = currentTerm?.academicYearId;
        const matching = yearId
            ? allTerms.filter((term) => String(term.academicYearId) === String(yearId))
            : allTerms;
        if (matching.length > 0) return matching;
        return currentTerm?.id ? [currentTerm] : [];
    }, [termsApi.data, currentTerm]);

    useEffect(() => {
        const validTerm = termsForYear.some((term) => String(term.id) === String(termId));
        if (!validTerm) {
            const preferred = termsForYear.find((term) => String(term.id) === String(currentTerm?.id))
                || termsForYear[0];
            setTermId(preferred?.id || '');
        }
    }, [termsForYear, termId, currentTerm?.id]);

    const rosterApi = useApi(
        () => (pair?.classId ? studentApi.list({ classId: pair.classId }) : Promise.resolve([])),
        [pair?.classId],
        { syncTopic: 'students' },
    );
    const students = useMemo(() => sortClassRoster(rosterApi.data).filter((student) =>
        !pair?.classId || String(student.classId || student.class_id || pair.classId) === String(pair.classId),
    ), [rosterApi.data, pair?.classId]);

    useEffect(() => {
        if (!students.some((student) => String(student.id) === String(studentId))) {
            setStudentId(students[0]?.id || '');
        }
    }, [students, studentId]);
    const selectedStudent = students.find((student) => String(student.id) === String(studentId)) || null;

    const reportApi = useApi(
        () => (pair && termId && selectedStudent
            ? settlingInApi.subjectReport(pair.classId, termId, pair.subjectKey, selectedStudent.id)
            : Promise.resolve(null)),
        [pair?.classId, pair?.subjectKey, termId, selectedStudent?.id],
    );
    const candidateReport = reportApi.data;
    const report = candidateReport
        && candidateReport.class?.id === pair?.classId
        && candidateReport.term?.id === termId
        && candidateReport.subject?.key === pair?.subjectKey
        && candidateReport.student?.id === selectedStudent?.id
        ? candidateReport
        : null;
    const student = report?.student || null;
    const savedSection = student?.sections?.[pair?.subjectKey] || null;

    if (assignmentsLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} /></Box>;
    if (assignmentsError) return <Alert severity="error">Could not load your subject assignments.</Alert>;
    if (reportPairs.length === 0) {
        return <Alert severity="info">Settling In reports are configured for Year 3 and Year 4 only. No eligible assigned English or Amharic class was found.</Alert>;
    }

    return (
        <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 20, mb: 0.5 }}>Individual Settling In report</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Select an assigned English or Amharic class and one student. Only that subject’s saved section can be previewed and printed.
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                    select fullWidth label="Assigned class and subject" value={pair?.key || ''}
                    onChange={(event) => setPairKey(event.target.value)}
                    inputProps={{ 'data-testid': 'subject-report-class-select' }}
                >
                    {reportPairs.map((option) => (
                        <MenuItem key={option.key} value={option.key}>
                            {option.className} — {option.subjectName}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select fullWidth label="Term" value={termId}
                    onChange={(event) => setTermId(event.target.value)}
                    disabled={termsForYear.length === 0}
                    inputProps={{ 'data-testid': 'subject-report-term-select' }}
                >
                    {termsForYear.map((term) => (
                        <MenuItem key={term.id} value={term.id}>{term.name}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    select fullWidth label="Student" value={selectedStudent?.id || ''}
                    onChange={(event) => setStudentId(event.target.value)}
                    disabled={rosterApi.loading || students.length === 0}
                    inputProps={{ 'data-testid': 'subject-report-student-select' }}
                >
                    {students.map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                            {option.rollNum ? `${option.rollNum}. ` : ''}{option.name}
                        </MenuItem>
                    ))}
                </TextField>
            </Stack>

            {(termsApi.error || currentTermApi.error) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Could not load all term choices. The current term will be used when available.
                </Alert>
            )}
            {rosterApi.error && <Alert severity="error" sx={{ mb: 2 }}>Could not load students for this assigned class.</Alert>}
            {!rosterApi.loading && pair && students.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>There are no active students in this assigned class.</Alert>
            )}
            {!termId && !termsApi.loading && !currentTermApi.loading && (
                <Alert severity="warning" sx={{ mb: 2 }}>No academic term is available for printing.</Alert>
            )}
            {reportApi.error && <Alert severity="error" sx={{ mb: 2 }}>{reportApi.error}</Alert>}
            {reportApi.loading && pair && termId && selectedStudent && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} /></Box>
            )}
            {report && student && !savedSection && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    No saved {report.subject.label} section exists for {student.name} in {report.term.name} yet.
                </Alert>
            )}
            {report && student && (
                <>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
                        <Button
                            variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}
                            disabled={!savedSection}
                            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 1 }}
                        >
                            Print saved section
                        </Button>
                    </Stack>
                    <Box data-testid="subject-report-preview">
                        <SubjectSectionSheet report={report} student={student} teacherName={teacherName} />
                    </Box>
                    <Box id="subject-report-print-area" className="subject-report-print-area" data-testid="subject-report-print-area">
                        <SubjectSectionSheet report={report} student={student} teacherName={teacherName} />
                    </Box>
                </>
            )}

            <style>{`
                #subject-report-print-area { display: none; }
                @page { size: A4 portrait; margin: 12mm; }
                @media print {
                    body * { visibility: hidden !important; }
                    #subject-report-print-area, #subject-report-print-area * { visibility: visible !important; }
                    #subject-report-print-area {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    #subject-report-print-area .subject-report-sheet {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: 0 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </Box>
    );
}
