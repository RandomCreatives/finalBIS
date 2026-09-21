import Chip from '@mui/material/Chip';

/**
 * Week-one marker for every timetable surface — the 2026/27 grids may still
 * shift while Term 1 settles (Year 3 corrections, subject-teacher seating).
 * Remove this component once admin declares the timetables final.
 */
export default function TentativeChip({ sx = {} }) {
    return (
        <Chip
            size="small"
            color="warning"
            variant="outlined"
            label="Tentative — may adjust as Term 1 settles"
            sx={{ fontWeight: 700, ...sx }}
        />
    );
}
