import { Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { addDays, formatDay, schoolWeekStart } from '../../utils/schoolTime';

/** "12–16 Oct 2026" for a Monday–Friday week. */
export const weekRangeLabel = (weekStart) => {
    const weekEnd = addDays(weekStart, 4);
    const sameMonth = weekStart.slice(0, 7) === weekEnd.slice(0, 7);
    const from = formatDay(weekStart, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    return `${from}–${formatDay(weekEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

/** "Week 4 · Term 1", or "This week" / "Week of 12 Oct" outside a term. */
export const weekTitle = (weekStart, term) => {
    if (term?.weekNumber) return `Week ${term.weekNumber} · ${term.name}`;
    return weekStart === schoolWeekStart() ? 'This week' : `Week of ${formatDay(weekStart, { day: 'numeric', month: 'short' })}`;
};

/**
 * ◀ Week 4 · Term 1 ▶ — step through school weeks (Monday–Friday). The next
 * arrow stops at the current week; "This week" jumps back from the past.
 * `term` comes from the week report once it has loaded.
 */
export default function WeekNavigator({ weekStart, term, onChange, dense = false }) {
    const current = schoolWeekStart();
    const isCurrent = weekStart === current;

    return (
        <Stack direction="row" alignItems="center" spacing={dense ? 0.25 : 0.75} sx={{ minWidth: 0 }}>
            <Tooltip title="Previous week">
                <IconButton size="small" aria-label="Previous week" onClick={() => onChange(addDays(weekStart, -7))}>
                    <ChevronLeftIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Stack sx={{ minWidth: dense ? 0 : 150, textAlign: 'center' }}>
                <Typography variant={dense ? 'body2' : 'subtitle1'} sx={{ fontWeight: 800, lineHeight: 1.2 }} data-testid="week-title">
                    {weekTitle(weekStart, term)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                    {weekRangeLabel(weekStart)}
                </Typography>
            </Stack>
            <Tooltip title={isCurrent ? 'This is the current week' : 'Next week'}>
                <span>
                    <IconButton size="small" aria-label="Next week" disabled={isCurrent}
                        onClick={() => onChange(addDays(weekStart, 7))}>
                        <ChevronRightIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            {!isCurrent && (
                <Button size="small" onClick={() => onChange(current)} sx={{ whiteSpace: 'nowrap' }}>
                    This week
                </Button>
            )}
        </Stack>
    );
}
