import { useState } from 'react';
import {
    Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent,
    DialogTitle, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { libraryApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { StatGrid, StatCard } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';
import { useSearchParams } from 'react-router-dom';

const inTwoWeeks = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
};

export default function Library() {
    const { user } = useAuth();
    const canIssue = ['admin', 'librarian'].includes(user?.role);

    const [searchParams] = useSearchParams();
    const filter = searchParams.get('view') === 'returned' ? 'returned' : 'borrowed';
    const [student, setStudent] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const filters = { status: filter };
    const loans = useApi(() => libraryApi.loans(filters), [filter]);
    const summary = useApi(() => libraryApi.summary(), []);
    const students = useApi(() => libraryApi.students(), []);

    const refresh = () => { loans.reload(); summary.reload(); };

    const openIssue = () => {
        if (!student) return;
        setFormError('');
        setDialog({ studentId: student.id, studentName: student.name, bookTitle: '' });
    };

    const handleIssue = async () => {
        setSaving(true);
        setFormError('');
        try {
            await libraryApi.issue({
                studentId: dialog.studentId,
                bookTitle: dialog.bookTitle.trim(),
                // The office only needs the issue date for this simple flow.
                // The API stores borrowed_on automatically and uses a normal
                // two-week return window for the existing loan rule.
                dueOn: inTwoWeeks(),
            });
            setToast('Book issued');
            setDialog(null);
            setStudent(null);
            refresh();
        } catch (err) {
            setFormError(err.message || 'Could not issue the book');
        } finally {
            setSaving(false);
        }
    };

    const handleReturn = async (loan) => {
        try {
            const result = await libraryApi.returnBook(loan.id);
            setToast(result.message);
            refresh();
        } catch (err) {
            setToast(err.message || 'Could not return the book');
        }
    };

    const rows = loans.data || [];

    return (
        <>
            <PageHeader
                title="Library"
                subtitle="Search a student, record the book they take, and mark it returned."
            />

            {summary.data && (
                <StatGrid>
                    <StatCard label="On loan" value={summary.data.onLoan} />
                    <StatCard label="Overdue" value={summary.data.overdue} color={summary.data.overdue > 0 ? 'error.main' : 'success.main'} />
                    <StatCard label="Total loans" value={summary.data.totalLoans} color="secondary.main" />
                </StatGrid>
            )}

            {canIssue && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2.5 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                        <Autocomplete
                            options={students.data || []}
                            value={student}
                            onChange={(_, value) => setStudent(value)}
                            getOptionLabel={(option) => `${option.name} — ${option.class?.name || 'No class'}`}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            loading={students.loading}
                            sx={{ minWidth: { sm: 360 }, flexGrow: 1 }}
                            renderInput={(params) => (
                                <TextField {...params} label="Search student" placeholder="Name or class" size="small" />
                            )}
                        />
                        <Button
                            variant="contained" startIcon={<AddIcon />} onClick={openIssue}
                            disabled={!student} sx={{ whiteSpace: 'nowrap' }}
                        >
                            Add book
                        </Button>
                    </Stack>
                    {student && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Selected: <strong>{student.name}</strong> · {student.class?.name || 'No class'}
                        </Typography>
                    )}
                </Paper>
            )}

            <DataState
                loading={loans.loading}
                error={loans.error}
                empty={rows.length === 0}
                emptyMessage="No loans in this view."
            >
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Book</TableCell>
                                <TableCell>Student</TableCell>
                                <TableCell>Date taken</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((loan) => (
                                <TableRow key={loan.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{loan.bookTitle}</Typography>
                                    </TableCell>
                                    <TableCell>{loan.student?.name}</TableCell>
                                    <TableCell>{loan.borrowedOn || '—'}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={.75}>
                                            <Button
                                                size="small" variant={loan.status === 'borrowed' ? 'contained' : 'outlined'}
                                                disabled
                                                sx={{ minWidth: 82, textTransform: 'none', fontWeight: 700 }}
                                            >
                                                Borrowed
                                            </Button>
                                            <Button
                                                size="small" variant={loan.status === 'returned' ? 'contained' : 'outlined'}
                                                color="success"
                                                disabled={loan.status === 'returned' || !canIssue}
                                                onClick={() => handleReturn(loan)}
                                                sx={{ minWidth: 82, textTransform: 'none', fontWeight: 700 }}
                                            >
                                                Returned
                                            </Button>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Add book</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Student: <strong>{dialog?.studentName}</strong>
                        </Typography>
                        <TextField
                            label="Book title" required fullWidth autoFocus
                            value={dialog?.bookTitle || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, bookTitle: e.target.value }))}
                        />
                        <Typography variant="caption" color="text.secondary">
                            Today’s date is saved automatically. The normal return window is two weeks.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleIssue}
                        disabled={saving || !dialog?.bookTitle?.trim()}
                    >
                        Save book
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={4000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
