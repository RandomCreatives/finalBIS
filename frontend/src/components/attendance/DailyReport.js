import { useState } from 'react';
import {
    Alert, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { attendanceApi } from '../../api/endpoints';
import useLiveApi from '../../hooks/useLiveApi';
import DataState from '../DataState';
import LiveStatus from '../LiveStatus';
import { StatCard, StatGrid } from '../DashboardSections';
import { formatDay, formatTime, schoolToday } from '../../utils/schoolTime';

const STATUS_META = {
    not_taken: { label: 'Not taken', color: 'error', variant: 'outlined' },
    partial: { label: 'Partly taken', color: 'warning', variant: 'filled' },
    taken: { label: 'Taken', color: 'success', variant: 'filled' },
};

// Registers still owed first — they are what the office acts on.
const STATUS_ORDER = { not_taken: 0, partial: 1, taken: 2 };

const dash = <Typography component="span" variant="body2" color="text.disabled">—</Typography>;

/**
 * Admin: every class's homeroom register for one school day — taken or not,
 * the day's numbers, and who saved it when. Today's report updates itself.
 */
export default function DailyReport({ onOpenRegister, initialDate }) {
    const [date, setDate] = useState(initialDate || schoolToday());
    const isToday = date === schoolToday();

    const report = useLiveApi(() => attendanceApi.daily({ date }), [date], { live: isToday });
    const data = report.data;
    const totals = data?.totals;

    const rows = [...(data?.classes || [])].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
            || String(a.className).localeCompare(String(b.className))
    );

    return (
        <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}
                justifyContent="space-between" sx={{ mb: 2.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <TextField
                        label="Day" type="date" size="small" value={date}
                        onChange={(e) => e.target.value && setDate(e.target.value)}
                        InputLabelProps={{ shrink: true }} inputProps={{ max: schoolToday() }}
                        sx={{ width: 170 }}
                    />
                    {!isToday && (
                        <Button size="small" onClick={() => setDate(schoolToday())}>Back to today</Button>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                        {formatDay(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Typography>
                </Stack>
                <LiveStatus
                    live={isToday}
                    updatedAt={report.updatedAt}
                    refreshing={report.refreshing}
                    stale={report.stale}
                    onRefresh={report.refresh}
                />
            </Stack>

            <DataState loading={report.loading} error={report.error}
                empty={rows.length === 0} emptyMessage="No classes found.">
                {totals && (
                    <StatGrid>
                        <StatCard icon={<FactCheckIcon />} label="Registers taken"
                            value={`${totals.taken}/${totals.classes}`}
                            color={totals.notTaken === 0 ? 'success.main' : 'warning.main'}
                            hint={totals.partial ? `${totals.partial} only partly taken` : undefined} />
                        <StatCard icon={<HowToRegIcon />} label="Present or late"
                            value={totals.rate === null ? '—' : `${totals.rate}%`}
                            hint={`${totals.present + totals.late} of ${totals.marked} pupils marked`} />
                        <StatCard icon={<PersonOffIcon />} label="Absent"
                            value={totals.absent} color={totals.absent ? 'error.main' : 'success.main'}
                            hint={totals.excused ? `+ ${totals.excused} excused` : undefined} />
                        <StatCard icon={<PendingActionsIcon />} label="Still to take"
                            value={totals.notTaken} color={totals.notTaken ? 'error.main' : 'success.main'} />
                    </StatGrid>
                )}

                {isToday && totals?.notTaken > 0 && data?.reminderTime && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Class teachers whose register isn't in are reminded automatically at{' '}
                        {data.reminderTime} (Ethiopian time) — in the app's bell, and on Telegram if they've linked it.
                    </Alert>
                )}

                <TableContainer component={Paper} variant="outlined">
                    <Table size="small" aria-label="Daily attendance by class">
                        <TableHead>
                            <TableRow>
                                <TableCell>Class</TableCell>
                                <TableCell>Class teacher</TableCell>
                                <TableCell>Register</TableCell>
                                <TableCell align="right">Present</TableCell>
                                <TableCell align="right">Late</TableCell>
                                <TableCell align="right">Absent</TableCell>
                                <TableCell align="right">Excused</TableCell>
                                <TableCell align="right">Rate</TableCell>
                                <TableCell>Saved</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((r) => {
                                const meta = STATUS_META[r.status] || STATUS_META.not_taken;
                                const marked = r.status !== 'not_taken';
                                return (
                                    <TableRow key={r.classId} hover
                                        sx={r.status === 'not_taken' ? { bgcolor: '#fef7f7' } : undefined}>
                                        <TableCell sx={{ fontWeight: 600 }}>{r.className}</TableCell>
                                        <TableCell>{r.mainTeacher || dash}</TableCell>
                                        <TableCell>
                                            <Chip size="small" color={meta.color} variant={meta.variant}
                                                label={r.status === 'partial' ? `${meta.label} ${r.marked}/${r.roster}` : meta.label} />
                                        </TableCell>
                                        <TableCell align="right">{marked ? r.present : dash}</TableCell>
                                        <TableCell align="right">{marked ? r.late : dash}</TableCell>
                                        <TableCell align="right" sx={r.absent ? { color: 'error.main', fontWeight: 700 } : undefined}>
                                            {marked ? r.absent : dash}
                                        </TableCell>
                                        <TableCell align="right">{marked ? r.excused : dash}</TableCell>
                                        <TableCell align="right">{r.rate === null ? dash : `${r.rate}%`}</TableCell>
                                        <TableCell>
                                            {r.lastSavedAt ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    {formatTime(r.lastSavedAt)}{r.lastSavedBy ? ` · ${r.lastSavedBy}` : ''}
                                                </Typography>
                                            ) : dash}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Button size="small" onClick={() => onOpenRegister?.(r.classId, date)}>
                                                {marked ? 'View register' : 'Take register'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>
        </>
    );
}
