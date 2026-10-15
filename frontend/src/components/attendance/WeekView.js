import { useState } from 'react';
import {
    Alert, Box, ButtonBase, Paper, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import { attendanceApi } from '../../api/endpoints';
import useLiveApi from '../../hooks/useLiveApi';
import DataState from '../DataState';
import LiveStatus from '../LiveStatus';
import { StatCard, StatGrid } from '../DashboardSections';
import WeekNavigator from './WeekNavigator';
import { formatDay, schoolWeekStart } from '../../utils/schoolTime';

const dayHeading = (day) => `${day.label} ${Number(day.date.slice(-2))}`;

const cellTooltip = (cell, day) => {
    const when = formatDay(day.date, { weekday: 'short', day: 'numeric', month: 'short' });
    switch (cell.status) {
        case 'taken':
        case 'partial': {
            const parts = [`${cell.present} present`];
            if (cell.late) parts.push(`${cell.late} late`);
            if (cell.absent) parts.push(`${cell.absent} absent`);
            if (cell.excused) parts.push(`${cell.excused} excused`);
            return `${when} — ${cell.status === 'partial' ? 'partly taken: ' : ''}${parts.join(', ')}. Open the register.`;
        }
        case 'not_taken': return `${when} — no register taken. Open the register.`;
        case 'pending': return `${when} — not taken yet today. Open the register.`;
        case 'closed': return `${when} — ${day.closed}`;
        case 'upcoming': return `${when} — still to come`;
        default: return `${when} — no pupils in this class`;
    }
};

function Cell({ cell, day, roster, onOpen }) {
    const clickable = ['taken', 'partial', 'not_taken', 'pending'].includes(cell.status);
    const untaken = cell.status === 'not_taken' || cell.status === 'pending';
    let body;
    if (cell.status === 'taken') {
        body = (
            <>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} aria-label="Taken" />
                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.1, color: cell.absent ? 'error.main' : 'text.secondary', fontWeight: cell.absent ? 700 : 400 }}>
                    {cell.absent ? `${cell.absent} absent` : 'all in'}
                </Typography>
            </>
        );
    } else if (cell.status === 'partial') {
        body = (
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.dark' }} aria-label="Partly taken">
                {cell.marked}/{roster}
            </Typography>
        );
    } else if (cell.status === 'not_taken') {
        body = (
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'error.main' }} aria-label="Not taken">
                Missing
            </Typography>
        );
    } else if (cell.status === 'pending') {
        body = (
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.dark' }} aria-label="Not taken yet today">
                Not yet
            </Typography>
        );
    } else {
        body = <Typography variant="caption" color="text.disabled">{cell.status === 'upcoming' ? '·' : '—'}</Typography>;
    }

    const content = (
        <Box sx={{ minHeight: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            {body}
        </Box>
    );

    return (
        <TableCell align="center" sx={{
            p: 0.5,
            bgcolor: cell.status === 'not_taken' ? '#fef2f2' : cell.status === 'closed' ? 'action.hover' : undefined,
        }}>
            <Tooltip title={cellTooltip(cell, day)}>
                {clickable ? (
                    <ButtonBase onClick={onOpen} sx={{ width: '100%', borderRadius: 1 }}
                        aria-label={`${untaken ? 'Take' : 'Open'} register ${day.date}`}>
                        {content}
                    </ButtonBase>
                ) : content}
            </Tooltip>
        </TableCell>
    );
}

/**
 * Admin: every class's registers for one school week, Monday–Friday, with
 * previous/next navigation. The current week updates itself.
 */
export default function WeekView({ weekStart: shownWeek, onWeekChange, initialWeek, onOpenRegister, onOpenDay }) {
    // Controlled by the page when it passes weekStart/onWeekChange (so the
    // week survives a trip to a register and back); self-contained otherwise.
    const [ownWeek, setOwnWeek] = useState(() => schoolWeekStart(initialWeek || undefined));
    const weekStart = shownWeek || ownWeek;
    const setWeekStart = onWeekChange || setOwnWeek;
    const isCurrent = weekStart === schoolWeekStart();

    const report = useLiveApi(() => attendanceApi.week({ date: weekStart }), [weekStart], { live: isCurrent });
    const data = report.data?.weekStart === weekStart ? report.data : null;
    const totals = data?.totals;
    const noSchool = data && data.days.every((d) => d.closed);

    return (
        <>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}
                justifyContent="space-between" sx={{ mb: 2.5 }}>
                <WeekNavigator weekStart={weekStart} term={data?.term} onChange={setWeekStart} />
                <LiveStatus live={isCurrent} updatedAt={report.updatedAt} refreshing={report.refreshing}
                    stale={report.stale} onRefresh={report.refresh} />
            </Stack>

            <DataState loading={report.loading || !data} error={report.error}>
                {data && (
                    <>
                        <StatGrid>
                            <StatCard icon={<FactCheckIcon />} label="Registers taken"
                                value={`${totals.taken}/${totals.expected}`}
                                color={totals.missing === 0 ? 'success.main' : 'warning.main'}
                                hint={isCurrent ? 'school days so far this week' : 'school days this week'} />
                            <StatCard icon={<PendingActionsIcon />} label="Missing registers"
                                value={totals.missing} color={totals.missing ? 'error.main' : 'success.main'}
                                hint={totals.openToday ? `+ ${totals.openToday} still open today` : (isCurrent ? 'before today' : undefined)} />
                            <StatCard icon={<HowToRegIcon />} label="Present or late"
                                value={totals.rate === null ? '—' : `${totals.rate}%`}
                                hint={`${totals.present + totals.late} of ${totals.marked} marks`} />
                            <StatCard icon={<PersonOffIcon />} label="Absences"
                                value={totals.absent} color={totals.absent ? 'error.main' : 'success.main'}
                                hint={totals.excused ? `+ ${totals.excused} excused` : undefined} />
                        </StatGrid>

                        {noSchool && (
                            <Alert severity="info" sx={{ mb: 2 }}>No school days this week.</Alert>
                        )}

                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small" aria-label="Attendance by class and day">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ minWidth: 150 }}>Class</TableCell>
                                        {data.days.map((day) => (
                                            <TableCell key={day.date} align="center" sx={{
                                                minWidth: 84,
                                                bgcolor: day.isToday ? 'rgba(37,99,235,.06)' : undefined,
                                            }}>
                                                <ButtonBase
                                                    disabled={day.isFuture}
                                                    onClick={() => onOpenDay?.(day.date)}
                                                    aria-label={`Daily report ${day.date}`}
                                                    sx={{ flexDirection: 'column', borderRadius: 1, px: 1, py: 0.25 }}
                                                >
                                                    <Typography variant="body2" sx={{ fontWeight: 800, color: day.isToday ? 'primary.main' : 'text.primary' }}>
                                                        {dayHeading(day)}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{
                                                        color: day.closed ? 'text.secondary'
                                                            : day.taken >= day.expected ? 'success.main'
                                                                : day.isToday ? 'warning.dark' : 'error.main',
                                                        fontWeight: 600, lineHeight: 1.1, maxWidth: 110,
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {day.closed || (day.isFuture ? 'to come' : `${day.taken}/${day.expected} taken`)}
                                                    </Typography>
                                                </ButtonBase>
                                            </TableCell>
                                        ))}
                                        <TableCell align="center">Week</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.classes.map((klass) => (
                                        <TableRow key={klass.classId} hover>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{klass.className}</Typography>
                                                {klass.mainTeacher && (
                                                    <Typography variant="caption" color="text.secondary">{klass.mainTeacher}</Typography>
                                                )}
                                            </TableCell>
                                            {klass.days.map((cell, i) => (
                                                <Cell key={cell.date} cell={cell} day={data.days[i]} roster={klass.roster}
                                                    onOpen={() => onOpenRegister?.(klass.classId, cell.date)} />
                                            ))}
                                            <TableCell align="center" sx={{
                                                fontWeight: 800,
                                                color: klass.expected === 0 ? 'text.disabled'
                                                    : klass.taken < klass.expected ? 'error.main' : 'success.main',
                                            }}>
                                                {klass.expected === 0 ? '—' : `${klass.taken}/${klass.expected}`}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DataState>
        </>
    );
}
