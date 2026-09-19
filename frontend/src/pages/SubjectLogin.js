import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box, Button, Chip, Container, Grid, IconButton, Paper, Tooltip, Typography, useTheme,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useColorScheme } from '../theme';
import { CLASSES } from '../data/classes';
import { ClassCard, ClassLoginDialog } from '../components/ClassLoginCard';

/*
 * The staff sign-in wall: every class of the school as a compact card —
 * class name, class teachers, student count, and a sign-in button.
 *
 * Main teachers tap their own class; subject teachers sign in through the
 * card of the class they are working with. All of them share the same
 * class-card password flow (shared with the public /classes page via the
 * ClassCard + ClassLoginDialog components). Staff who prefer their own
 * account use the email sign-in. The old per-subject teacher stacks made
 * the page a long, uneven directory — the wall now shows classes only.
 */

/** Group classes into year bands, e.g. [{ year: 3, classes: [...] }, …]. */
export const yearBands = (classes) => {
    const bands = new Map();
    classes.forEach((c) => {
        if (!bands.has(c.yearLevel)) bands.set(c.yearLevel, []);
        bands.get(c.yearLevel).push(c);
    });
    return [...bands.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, list]) => ({ year, classes: list }));
};

/** Band heading shown above each grid. */
export const sectionLabel = (year) => `Year ${year}`;

export default function SubjectLogin() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();

    const bands = useMemo(() => yearBands(CLASSES), []);

    // Which class card opened the shared password dialog.
    const [loginClass, setLoginClass] = useState(null);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: dark ? 'background.default' : '#f8fafc', pb: 8,
            display: 'flex', flexDirection: 'column' }}>
            {/* header */}
            <Box sx={{ bgcolor: dark ? 'background.paper' : '#ffffff', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'primary.main', color: '#fff' }}>
                        <SchoolIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>BIS NOC Gerji</Typography>
                        <Typography variant="caption" color="text.secondary">Staff sign-in</Typography>
                    </Box>
                    <Button component={RouterLink} to="/login" size="small"
                        sx={{ textTransform: 'none', fontWeight: 700, mr: 0.5, minHeight: 40 }}>
                        Staff email sign-in
                    </Button>
                    <Tooltip title={dark ? 'Light mode' : 'Dark mode'}>
                        <IconButton size="small" onClick={toggleColorScheme}
                            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
                            {dark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </Tooltip>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ mt: 4, flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.01em', mb: 0.5 }}>
                    Sign in with your class
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 560 }}>
                    Tap your class card and enter the class password — it opens that class's
                    dashboard as its main teacher. Subject teachers:{' '}
                    <RouterLink to="/subject-login" style={{ color: 'inherit', fontWeight: 700 }}>
                        sign in with your teacher card
                    </RouterLink>{' '}
                    instead — it opens your own subject dashboard.
                </Typography>

                {bands.map((band) => (
                    <Box key={band.year} sx={{ mb: 5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                                {sectionLabel(band.year)}
                            </Typography>
                            <Chip label={`${band.classes.length} classes`} size="small"
                                sx={{ fontWeight: 700, bgcolor: (t) =>
                                    (t.palette.mode === 'dark' ? 'rgba(59,130,246,.15)' : 'rgba(30,64,175,.08)'),
                                    color: 'primary.main' }} />
                        </Box>
                        <Grid container spacing={2}>
                            {band.classes.map((klass) => (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={klass.id}>
                                    <ClassCard klass={klass} onLogin={setLoginClass}
                                        actionLabel="Class Sign-In" />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                ))}

                {/* attendance lives behind every class card */}
                <Paper variant="outlined" sx={{
                    mt: 1, p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                    borderStyle: 'dashed',
                }}>
                    <FactCheckOutlinedIcon sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                        <strong>Taking attendance?</strong> Tap your class card above — the
                        attendance sheet is the first thing inside.
                    </Typography>
                </Paper>
            </Container>

            {/* shared class-card password dialog (resets per class via key) */}
            <ClassLoginDialog
                key={loginClass?.id || 'none'}
                loginClass={loginClass}
                onClose={() => setLoginClass(null)}
            />
        </Box>
    );
}
