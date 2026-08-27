import { useState } from 'react';
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { libraryApi, studentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { FilterChips, StatGrid, StatCard } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';

const FILTERS = [
    { value: 'onloan', label: 'On loan' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'returned', label: 'Returned' },
];

const inTwoWeeks = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
};

export default function Library() {
    const { user } = useAuth();
    const canIssue = ['admin', 'main_teacher', 'assistant_teacher'].includes(user?.role);

    const [filter, setFilter] = useState('onloan');
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const filters = filter === 'onloan' ? { status: 'borrowed' } : filter === 'overdue' ? { overdue: 'true' } : { status: 'returned' };

    const loans = useApi(() => libraryApi.loans(filters), [filter]);
    const summary = useApi(() => libraryApi.summary(), []);
    const students = useApi(() => studentApi.list(), []);

    const refresh = () => { loans.reload(); summary.reload(); };

    const handleIssue = async () => {
        setSaving(true);
        setFormError('');
        try {
            await libraryApi.issue({
                studentId: dialog.studentId,
                bookTitle: dialog.bookTitle.trim(),
                bookAuthor: dialog.bookAuthor || null,
                bookIsbn: dialog.bookIsbn || null,
                dueOn: dialog.dueOn,
            });
            setToast('Book issued');
            setDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
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
            setToast(err.message);
        }
    };

    const rows = loans.data || [];

    return (
        <>
            <PageHeader
                title="Library"
                subtitle="Book loans and returns — borrowing is free for all."
                action={canIssue && (
                    <Button
                        variant="contained" startIcon={<AddIcon />}
                        onClick={() => {
                            setFormError('');
                            setDialog({ studentId: '', bookTitle: '', bookAuthor: '', bookIsbn: '', dueOn: inTwoWeeks() });
                        }}
                    >
                        Issue book
                    </Button>
                )}
            />

            {summary.data && (
                <StatGrid>
                    <StatCard label="On loan" value={summary.data.onLoan} />
                    <StatCard label="Overdue" value={summary.data.overdue} color={summary.data.overdue > 0 ? 'error.main' : 'success.main'} />
                    <StatCard label="Total loans" value={summary.data.totalLoans} color="secondary.main" />
                </StatGrid>
            )}

            <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

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
                                <TableCell>Due</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((loan) => (
                                <TableRow key={loan.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{loan.bookTitle}</Typography>
                                        {loan.bookAuthor && (
                                            <Typography variant="caption" color="text.secondary">{loan.bookAuthor}</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{loan.student?.name}</TableCell>
                                    <TableCell>{loan.dueOn}</TableCell>
                                    <TableCell>
                                        {loan.status === 'returned' ? (
                                            <Chip size="small" label="Returned" color="success" variant="outlined" />
                                        ) : loan.isOverdue ? (
                                            <Chip size="small" label="Overdue" color="error" />
                                        ) : (
                                            <Chip size="small" label="On loan" variant="outlined" />
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            {loan.status === 'borrowed' && canIssue && (
                                                <Button size="small" onClick={() => handleReturn(loan)}>Return</Button>
                                            )}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Issue a book</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            select label="Student" required fullWidth
                            value={dialog?.studentId || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, studentId: e.target.value }))}
                        >
                            {(students.data || []).map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                    {s.name} — {s.class?.name || 'no class'}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Book title" required fullWidth
                            value={dialog?.bookTitle || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, bookTitle: e.target.value }))}
                        />
                        <TextField
                            label="Author" fullWidth
                            value={dialog?.bookAuthor || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, bookAuthor: e.target.value }))}
                        />
                        <TextField
                            label="ISBN" fullWidth
                            value={dialog?.bookIsbn || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, bookIsbn: e.target.value }))}
                        />
                        <TextField
                            label="Due date" type="date" required fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={dialog?.dueOn || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, dueOn: e.target.value }))}
                        />
                        <Typography variant="caption" color="text.secondary">
                            A student may hold up to 3 books, and none while a book is overdue.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleIssue}
                        disabled={saving || !dialog?.studentId || !dialog?.bookTitle?.trim() || !dialog?.dueOn}
                    >
                        Issue
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={4000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
