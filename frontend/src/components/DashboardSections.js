import { useState } from 'react';
import {
    Box, Card, CardContent, Chip, Collapse, IconButton, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

/** Top-of-page metric tile used across every section dashboard. */
export function StatCard({ icon, label, value, hint, color = 'primary.main' }) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                    <Stack
                        alignItems="center" justifyContent="center"
                        sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: color, color: 'white' }}
                    >
                        {icon}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                </Stack>
                <Typography variant="h4">{value}</Typography>
                {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
            </CardContent>
        </Card>
    );
}

/**
 * A collapsible card used to stack a section's former tabs as panels on one
 * scrollable dashboard page. `defaultExpanded` keeps the first/primary panel
 * open while the rest start collapsed to avoid an overwhelming wall of content.
 */
export function Section({ title, icon, action, children, defaultExpanded = false, sx }) {
    const [open, setOpen] = useState(defaultExpanded);

    return (
        <Card sx={{ mb: 2.5, ...sx }}>
            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 2.5, py: 1.75, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setOpen((v) => !v)}
            >
                {icon && (
                    <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
                )}
                <Typography variant="h6" sx={{ fontWeight: 800, flexGrow: 1 }}>
                    {title}
                </Typography>
                {action && (
                    <Box onClick={(e) => e.stopPropagation()} sx={{ mr: 1 }}>
                        {action}
                    </Box>
                )}
                <IconButton size="small" aria-label={open ? 'Collapse' : 'Expand'}>
                    {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            </Stack>
            <Collapse in={open}>
                <CardContent sx={{ pt: 0 }}>{children}</CardContent>
            </Collapse>
        </Card>
    );
}

/** Horizontal filter chip row used in place of "filter" tabs. */
export function FilterChips({ options, value, onChange, label = 'Filter' }) {
    return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>{label}:</Typography>
            {options.map((opt) => (
                <Chip
                    key={opt.value}
                    label={opt.label}
                    clickable
                    color={value === opt.value ? 'primary' : 'default'}
                    variant={value === opt.value ? 'filled' : 'outlined'}
                    onClick={() => onChange(opt.value)}
                />
            ))}
        </Stack>
    );
}

/** Simple stat grid wrapper so pages stay consistent. */
export function StatGrid({ children }) {
    return (
        <Box
            sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
                mb: 3,
            }}
        >
            {children}
        </Box>
    );
}
