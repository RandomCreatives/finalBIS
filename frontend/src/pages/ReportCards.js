import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, Divider, MenuItem, Stack, Table, TableBody,
    TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup,
    Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import GridViewIcon from '@mui/icons-material/GridView';
import {
    academicYearApi, classApi, marksheetApi, studentApi, subjectApi, termApi,
} from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { buildReportCards } from '../utils/reportCards';

/*
 * Term report cards — one printable sheet per student, straight from the
 * saved term finals. Pick a class and a term, check the summary grid, then
 * print: every student gets their own page with subjects, marks, grades,
 * the term average and signature lines, using the school's grading scale.
 */

const blankCell = '—';

function ReportSheet({ card, className, termName, yearName }) {
    const { student, rows, subjectsScored, average, overallGrade } = card;
    const font = { fontFamily: '"Times New Roman", Georgia, serif' };
    return (
        <Box
            className="report-sheet"
            data-testid={`report-card-${student.id}`}
            sx={{
                border: '2px solid #1e3a8a', borderRadius: 1, p: { xs: 2, sm: 3.5 },
                mb: 4, maxWidth: 820, mx: 'auto', bgcolor: '#fff', color: '#0f172a',
                pageBreakAfter: 'always', breakInside: 'avoid',
            }}
        >
            {/* School head */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{
                    width: 44, height: 44, borderRadius: 1, bgcolor: '#1e3a8a', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 18, ...font,
                }}>
                    B
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 20, lineHeight: 1.1, ...font }}>
                        BIS NOC Gerji
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569', ...font }}>
                        British International School — Gerji Primary II
                    </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 14, letterSpacing: 1, ...font }}>
                        {termName?.toUpperCase()} REPORT CARD
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569', ...font }}>
                        Academic year {yearName}
                    </Typography>
                </Box>
            </Box>
            <Divider sx={{ borderColor: '#1e3a8a', mb: 2 }} />

            {/* Student line */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 3 }, mb: 2, ...font }}>
                <Typography sx={{ ...font }}><b>Name:</b> {student.name}</Typography>
                <Typography sx={{ ...font }}><b>Admission no:</b> {student.admissionNo || blankCell}</Typography>
                <Typography sx={{ ...font }}><b>Class:</b> {className}</Typography>
                <Typography sx={{ ...font }}><b>Roll:</b> {student.rollNum || blankCell}</Typography>
            </Box>

            {/* Marks */}
            <Table
                size="small"
                sx={{
                    '& th, & td': { border: '1px solid #94a3b8', py: 0.75, ...font },
                    '& th': { bgcolor: '#eef2ff', fontWeight: 800 },
                }}
            >
                <TableHead>
                    <TableRow>
                        <TableCell>Subject</TableCell>
                        <TableCell align="right" sx={{ width: 90 }}>Marks</TableCell>
                        <TableCell align="right" sx={{ width: 90 }}>Out of</TableCell>
                        <TableCell align="right" sx={{ width: 80 }}>%</TableCell>
                        <TableCell align="center" sx={{ width: 80 }}>Grade</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.subject.id}>
                            <TableCell>{r.subject.name}</TableCell>
                            <TableCell align="right">{r.marks ?? blankCell}</TableCell>
                            <TableCell align="right">{r.maxMarks ?? blankCell}</TableCell>
                            <TableCell align="right">{r.percentage ?? blankCell}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>{r.grade ?? blankCell}</TableCell>
                        </TableRow>
                    ))}
                    <TableRow>
                        <TableCell sx={{ fontWeight: 900 }}>Term average</TableCell>
                        <TableCell colSpan={2} />
                        <TableCell align="right" sx={{ fontWeight: 900 }}>
                            {average === null ? blankCell : `${average}%`}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 900, bgcolor: '#eef2ff' }}>
                            {overallGrade ?? blankCell}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
            {subjectsScored < rows.length && (
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, ...font }}>
                    Some subjects have no saved marks yet — the average counts the {subjectsScored} that do.
                </Typography>
            )}

            {/* Comment + signatures */}
            <Box sx={{ mt: 3, ...font }}>
                <Typography sx={{ ...font, mb: 2 }}>
                    <b>Class teacher's comment:</b> ______________________________________________
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 4 }}>
                    <Typography sx={{ ...font }}>Class teacher: ________________</Typography>
                    <Typography sx={{ ...font }}>Principal: ________________</Typography>
                    <Typography sx={{ ...font }}>Date: ____________</Typography>
                </Box>
            </Box>
        </Box>
    );
}

const BIS_SUBJECT_GROUPS = [
    ['English'],
    ['Mathematics', 'Science'],
    ['History', 'Geography'],
    ['Amharic', 'Music', 'French'],
    ['Physical Education', 'Art', 'IT', 'ICT'],
];

const PREVIEW_OBJECTIVES = [
    'Principal-defined learning objective will appear here.',
    'Teacher progress rating will appear here.',
    'Target and next step will appear here.',
];

function PreviewSubject({ name, row }) {
    return (
        <Box sx={{ border: '1px solid #94a3b8', mb: 1.5, p: 1.5, ...{ fontFamily: '"Times New Roman", Georgia, serif' } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
                <Typography sx={{ fontWeight: 900, fontFamily: 'inherit', fontSize: 15 }}>{name}</Typography>
                <Typography sx={{ fontSize: 11, color: '#475569', fontFamily: 'inherit' }}>
                    Teacher: To be assigned
                </Typography>
            </Stack>
            <Table size="small" sx={{ '& th, & td': { border: '1px solid #cbd5e1', py: 0.5, fontFamily: 'inherit' } }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#eef2ff' }}>
                        <TableCell>Learning objective</TableCell>
                        <TableCell align="center" sx={{ width: 48 }}>WT</TableCell>
                        <TableCell align="center" sx={{ width: 48 }}>WW</TableCell>
                        <TableCell align="center" sx={{ width: 48 }}>WA</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {PREVIEW_OBJECTIVES.map((objective) => (
                        <TableRow key={objective}>
                            <TableCell sx={{ fontSize: 11 }}>{objective}</TableCell>
                            <TableCell align="center" sx={{ color: '#94a3b8' }}>□</TableCell>
                            <TableCell align="center" sx={{ color: '#94a3b8' }}>□</TableCell>
                            <TableCell align="center" sx={{ color: '#94a3b8' }}>□</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Stack direction="row" spacing={2} sx={{ mt: 1, fontSize: 11, color: '#475569' }}>
                <span>Effort: —</span>
                <span>Exam: {row?.percentage == null ? 'N/A' : `${row.percentage}%`}</span>
                <span>Targets: To be defined</span>
            </Stack>
        </Box>
    );
}

function BISPreviewPage({ pageNumber, title, children, student, className, termName, yearName }) {
    const font = { fontFamily: '"Times New Roman", Georgia, serif' };
    return (
        <Box sx={{
            bgcolor: '#fff', color: '#0f172a', border: '2px solid #1e3a8a',
            p: { xs: 2, sm: 3 }, mb: 3, maxWidth: 900, mx: 'auto',
            minHeight: { sm: 680 }, pageBreakAfter: 'always', ...font,
        }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                <Box sx={{ width: 40, height: 40, bgcolor: '#1e3a8a', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 18 }}>
                    B
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, lineHeight: 1.1, ...font }}>British International School</Typography>
                    <Typography sx={{ fontSize: 11, color: '#475569', ...font }}>Gerji Primary 2</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 13, ...font }}>{termName?.toUpperCase()} REPORT CARD</Typography>
                    <Typography sx={{ fontSize: 11, color: '#475569', ...font }}>Page {pageNumber} of 5 · {yearName}</Typography>
                </Box>
            </Stack>
            <Divider sx={{ borderColor: '#1e3a8a', mb: 1.5 }} />
            <Stack direction="row" spacing={2.5} flexWrap="wrap" sx={{ mb: 1.5, ...font }}>
                <Typography sx={{ fontFamily: 'inherit', fontSize: 12 }}><b>Student:</b> {student.name}</Typography>
                <Typography sx={{ fontFamily: 'inherit', fontSize: 12 }}><b>Class:</b> {className}</Typography>
                <Typography sx={{ fontFamily: 'inherit', fontSize: 12 }}><b>Roll:</b> {student.rollNum || '—'}</Typography>
            </Stack>
            <Typography sx={{ fontWeight: 900, fontSize: 15, mb: 1, ...font }}>{title}</Typography>
            {children}
        </Box>
    );
}

function BISReportPreview({ card, className, termName, yearName }) {
    const rowBySubject = Object.fromEntries(card.rows.map((row) => [row.subject.name, row]));
    const pageGroups = BIS_SUBJECT_GROUPS.map((group) => group.filter((name) =>
        name in rowBySubject || ['History', 'Geography', 'IT'].includes(name)
    ));
    return (
        <Box data-testid="bis-report-preview">
            <Alert severity="info" sx={{ mb: 2, maxWidth: 900, mx: 'auto' }}>
                Preview only. No report-card data is saved. Objectives, ratings, targets and teacher names will come from the Principal-approved report-card setup.
            </Alert>
            <BISPreviewPage pageNumber={1} title="English and Work Habits & Social Skills" student={card.student} className={className} termName={termName} yearName={yearName}>
                <PreviewSubject name="English" row={rowBySubject.English} />
                <Box sx={{ border: '1px solid #94a3b8', p: 1.5, mt: 2, ...{ fontFamily: '"Times New Roman", Georgia, serif' } }}>
                    <Typography sx={{ fontWeight: 900, mb: 1, fontFamily: 'inherit' }}>Work Habits and Social Skills</Typography>
                    <Typography sx={{ fontSize: 11, color: '#475569', mb: 1, fontFamily: 'inherit' }}>Rating scale: Pleasing (P) · Good (G) · Satisfactory (S) · Needs improvement (N)</Typography>
                    <Table size="small" sx={{ '& th, & td': { border: '1px solid #cbd5e1', py: 0.45, fontFamily: 'inherit', fontSize: 11 } }}>
                        <TableBody>
                            <TableRow><TableCell>Days absent</TableCell><TableCell align="center">—</TableCell><TableCell>Days late</TableCell><TableCell align="center">—</TableCell></TableRow>
                            {['Comes prepared and ready to learn', 'Uses class time effectively', 'Listens attentively', 'Participates in activities', 'Works cooperatively', 'Follows directions', 'Shows respect and kindness'].map((item) => (
                                <TableRow key={item}><TableCell colSpan={2}>{item}</TableCell><TableCell colSpan={2} align="center">—</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Typography sx={{ mt: 1, fontSize: 11, fontFamily: 'inherit' }}>Main teacher: __________________________</Typography>
                </Box>
            </BISPreviewPage>
            {pageGroups.slice(1).map((group, index) => (
                <BISPreviewPage key={group.join('-')} pageNumber={index + 2} title={group.join(' and ')} student={card.student} className={className} termName={termName} yearName={yearName}>
                    {group.length === 0
                        ? <Typography sx={{ color: '#64748b', fontFamily: 'inherit' }}>Subject sections will appear here when configured.</Typography>
                        : group.map((name) => <PreviewSubject key={name} name={name} row={rowBySubject[name]} />)}
                </BISPreviewPage>
            ))}
        </Box>
    );
}

export default function ReportCards() {
    const [classId, setClassId] = useState('');
    const [termId, setTermId] = useState('');
    const [view, setView] = useState('grid');
    const [previewStudentId, setPreviewStudentId] = useState('');

    const classes = useApi(() => classApi.list(), []);
    const subjects = useApi(() => subjectApi.list(), []);
    const terms = useApi(() => termApi.list(), []);
    const years = useApi(() => academicYearApi.list(), []);
    const current = useApi(() => termApi.current(), []);
    const resolvedTermId = termId || current.data?.term?.id || '';

    const students = useApi(
        () => (classId ? studentApi.list({ classId }) : Promise.resolve([])),
        [classId],
    );
    const marksheets = useApi(
        () => (classId && resolvedTermId
            ? marksheetApi.list({ classId, termId: resolvedTermId })
            : Promise.resolve([])),
        [classId, resolvedTermId],
    );

    const className = (classes.data || []).find((c) => c.id === classId)?.name || '';
    const termName = (terms.data || []).find((t) => t.id === resolvedTermId)?.name
        || current.data?.term?.name || '';
    const yearName = (years.data || []).find((y) => y.isCurrent)?.name || '';

    const cards = useMemo(
        () => buildReportCards(students.data || [], subjects.data || [], marksheets.data || []),
        [students.data, subjects.data, marksheets.data],
    );

    const cols = (subjects.data || []).slice().sort((a, b) => a.name.localeCompare(b.name));

    useEffect(() => {
        if (!cards.some((card) => card.student.id === previewStudentId)) {
            setPreviewStudentId(cards[0]?.student.id || '');
        }
    }, [cards, previewStudentId]);

    const previewCard = cards.find((card) => card.student.id === previewStudentId) || cards[0] || null;

    return (
        <>
            {/* Print rules: show only the card stack, one sheet per page. */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #report-print-area, #report-print-area * { visibility: visible; }
                    #report-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .report-sheet { margin: 0 auto !important; max-width: 100% !important; border-radius: 0 !important; }
                }
            `}</style>

            <PageHeader
                title="Report cards"
                subtitle="Term report sheets built from the saved marks — one page per student, ready to print."
                action={view === 'print' && cards.length > 0 && (
                    <Button
                        variant="contained" startIcon={<PrintIcon />}
                        onClick={() => window.print()}
                        data-testid="print-cards-button"
                    >
                        Print {cards.length} card{cards.length === 1 ? '' : 's'}
                    </Button>
                )}
            />

            <Card sx={{ p: 2, mb: 2.5 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                    <TextField
                        select label="Class" size="small" sx={{ minWidth: 220 }}
                        value={classId} onChange={(e) => setClassId(e.target.value)}
                        data-testid="report-class-select"
                    >
                        <MenuItem value=""><em>Choose a class…</em></MenuItem>
                        {(classes.data || []).map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select label="Term" size="small" sx={{ minWidth: 160 }}
                        value={resolvedTermId} onChange={(e) => setTermId(e.target.value)}
                        data-testid="report-term-select"
                    >
                        {(terms.data || []).map((t) => (
                            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                        ))}
                    </TextField>
                    <ToggleButtonGroup
                        exclusive size="small" value={view}
                        onChange={(_, v) => v && setView(v)}
                        data-testid="report-view-toggle"
                    >
                        <ToggleButton value="grid" sx={{ textTransform: 'none', fontWeight: 700 }}>
                            <GridViewIcon sx={{ mr: 0.5, fontSize: 18 }} /> Summary
                        </ToggleButton>
                        <ToggleButton value="print" sx={{ textTransform: 'none', fontWeight: 700 }}>
                            <PrintIcon sx={{ mr: 0.5, fontSize: 18 }} /> Print cards
                        </ToggleButton>
                        <ToggleButton value="bis-preview" sx={{ textTransform: 'none', fontWeight: 700 }}>
                            BIS preview
                        </ToggleButton>
                    </ToggleButtonGroup>
                    {view === 'bis-preview' && cards.length > 0 && (
                        <TextField
                            select label="Preview student" size="small" sx={{ minWidth: 220 }}
                            value={previewStudentId || cards[0].student.id}
                            onChange={(e) => setPreviewStudentId(e.target.value)}
                        >
                            {cards.map((card) => (
                                <MenuItem key={card.student.id} value={card.student.id}>{card.student.name}</MenuItem>
                            ))}
                        </TextField>
                    )}
                </Stack>
            </Card>

            {!classId ? (
                <Alert severity="info">Choose a class to build its report cards.</Alert>
            ) : (
                <DataState
                    loading={students.loading || marksheets.loading || subjects.loading
                        || current.loading || terms.loading}
                    error={students.error || marksheets.error || subjects.error || current.error || terms.error}
                >
                    {cards.length === 0 ? (
                        <Alert severity="info">No students in this class yet.</Alert>
                    ) : view === 'grid' ? (
                        <Card sx={{ overflowX: 'auto' }}>
                            <Table size="small" data-testid="report-summary-grid">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 800 }}>Student</TableCell>
                                        {cols.map((s) => (
                                            <TableCell key={s.id} align="center" sx={{ fontWeight: 800 }}>
                                                {s.name}
                                            </TableCell>
                                        ))}
                                        <TableCell align="center" sx={{ fontWeight: 800 }}>Average</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 800 }}>Grade</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {cards.map((card) => (
                                        <TableRow key={card.student.id} hover>
                                            <TableCell>{card.student.name}</TableCell>
                                            {card.rows.map((r) => (
                                                <TableCell key={r.subject.id} align="center">
                                                    {r.percentage === null ? blankCell : (
                                                        <Chip
                                                            size="small"
                                                            label={`${r.percentage}% · ${r.grade}`}
                                                            sx={{ fontWeight: 700, fontSize: 11 }}
                                                        />
                                                    )}
                                                </TableCell>
                                            ))}
                                            <TableCell align="center" sx={{ fontWeight: 800 }}>
                                                {card.average === null ? blankCell : `${card.average}%`}
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800 }}>
                                                {card.overallGrade ?? blankCell}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    ) : view === 'print' ? (
                        <div id="report-print-area" data-testid="report-print-area">
                            <Typography variant="caption" color="text.secondary"
                                sx={{ display: 'block', mb: 2 }}
                                data-testid="print-hint"
                            >
                                Everything below prints one sheet per page — use the Print button above.
                            </Typography>
                            {cards.map((card) => (
                                <ReportSheet
                                    key={card.student.id}
                                    card={card}
                                    className={className}
                                    termName={termName}
                                    yearName={yearName}
                                />
                            ))}
                        </div>
                    ) : previewCard ? (
                        <BISReportPreview
                            card={previewCard}
                            className={className}
                            termName={termName}
                            yearName={yearName}
                        />
                    ) : (
                        <Alert severity="info">Choose a student for the detailed preview.</Alert>
                    )}
                </DataState>
            )}
        </>
    );
}
