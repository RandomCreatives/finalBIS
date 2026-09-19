import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, CircularProgress,
    Container, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton,
    InputAdornment, Paper, TextField, Typography, useTheme,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LoginIcon from '@mui/icons-material/Login';
import { authApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';

/*
 * Subject teacher sign-in: a wall of teacher cards grouped by subject.
 *
 * Tap your card, enter the password, land on your subject dashboard.
 * Main teachers use the class cards (public /classes wall) instead.
 */

/** "English Teacher 1" -> "English"; "Physical Education Teacher 2" -> "Physical Education". */
export const subjectOf = (name) => name.replace(/\s+teacher\s+\d+$/i, '') || 'Other';

/**
 * Placeholder seats are named "<Subject> Teacher N" (e.g. "English Teacher 1").
 * Only these get a card on the sign-in wall, labelled generically ("Teacher N").
 * Real names are revealed once staff are mapped to the seats — flip this predicate
 * (and teacherLabel) in the same change that renames the accounts.
 */
const PLACEHOLDER_RE = /\s+teacher\s+(\d+)$/i;
export const isWallCard = (teacher) => PLACEHOLDER_RE.test(teacher.name);

/** "English Teacher 2" -> "Teacher 2"; anything else keeps its full name. */
export const teacherLabel = (teacher) => {
    const m = teacher.name.match(PLACEHOLDER_RE);
    return m ? `Teacher ${m[1]}` : teacher.name;
};

/** Groups the flat teacher list into subject sections for the card wall. */
export const groupTeachers = (teachers) => {
    const groups = new Map();
    teachers.forEach((t) => {
        const subject = subjectOf(t.name);
        if (!groups.has(subject)) groups.set(subject, []);
        groups.get(subject).push(t);
    });
    return [...groups.entries()]
        .map(([subject, list]) => ({
            subject,
            teachers: list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
};

const SUBJECT_TINTS = ['#eef2ff', '#ecfdf5', '#f3e8ff', '#fef3c7', '#fce7f3', '#e0f2fe'];

export default function SubjectTeacherLogin() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const { loginWithToken } = useAuth();
    const navigate = useNavigate();

    // Back to wherever you came from; a fresh tab lands on the landing page.
    const goBack = () => {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate('/');
    };

    const directory = useApi(() => authApi.subjectTeachers(), []);
    const groups = useMemo(
        () => groupTeachers((directory.data || []).filter(isWallCard)),
        [directory.data],
    );

    const [selected, setSelected] = useState(null); // { teacher, label, subject }
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const openCard = (teacher, label, subject) => {
        setSelected({ teacher, label, subject });
        setPassword('');
        setError('');
    };

    const signIn = async (event) => {
        event?.preventDefault();
        if (!selected || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const { token, user } = await authApi.subjectTeacherLogin(selected.teacher.id, password);
            loginWithToken(token, user);
            navigate('/subject-home', { replace: true });
        } catch (err) {
            setError(err.message || 'Sign-in failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: dark ? 'background.default' : '#f8fafc', pb: 8 }}>
            {/* header */}
            <Box sx={{ bgcolor: dark ? 'background.paper' : '#ffffff', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                    <Button startIcon={<ArrowBackOutlinedIcon sx={{ fontSize: 17 }} />} onClick={goBack}
                        size="small"
                        sx={{ textTransform: 'none', fontWeight: 700, mr: -0.5 }}>
                        Back
                    </Button>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'primary.main', color: '#fff' }}>
                        <SchoolIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>BIS NOC Gerji</Typography>
                        <Typography variant="caption" color="text.secondary">Subject teacher sign-in</Typography>
                    </Box>
                    <Button component={RouterLink} to="/teacher-login" size="small"
                        sx={{ textTransform: 'none', fontWeight: 700, mr: 0.5 }}>
                        Class sign-in
                    </Button>
                    <IconButton size="small" onClick={toggleColorScheme}>
                        {dark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.01em', mb: 0.5 }}>
                    Who's teaching today?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Tap your card and enter your password. Main teachers use their{' '}
                    <RouterLink to="/classes" style={{ color: 'inherit', fontWeight: 700 }}>class cards</RouterLink>{' '}
                    instead — or{' '}
                    <RouterLink to="/login" style={{ color: 'inherit', fontWeight: 700 }}>
                        sign in with your staff email
                    </RouterLink>.
                </Typography>

                {directory.loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>
                )}
                {directory.error && (
                    <Alert severity="error">Could not load the teacher directory. Please refresh.</Alert>
                )}

                {groups.map((g, gi) => (
                    <Accordion
                        key={g.subject}
                        disableGutters
                        elevation={0}
                        sx={{
                            mb: 1.5, border: '1px solid', borderColor: 'divider',
                            borderRadius: '8px !important', overflow: 'hidden',
                            '&:before': { display: 'none' },
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                                px: 2, minHeight: 58,
                                '& .MuiAccordionSummary-content': { my: 1.25, alignItems: 'baseline', gap: 1.5 },
                            }}
                        >
                            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{g.subject}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {g.teachers.length === 1 ? '1 teacher' : `${g.teachers.length} teachers`}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                            <Grid container spacing={1.5}>
                                {g.teachers.map((t, ti) => {
                                    const label = teacherLabel(t);
                                    return (
                                        <Grid item xs={12} sm={6} md={4} lg={3} key={t.id}>
                                            <Paper
                                                variant="outlined"
                                                data-testid="subject-seat-card"
                                                onClick={() => openCard(t, label, g.subject)}
                                                sx={{
                                                    p: 2, borderRadius: 1.5, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 1.5,
                                                    transition: 'all .15s ease',
                                                    '&:hover': {
                                                        borderColor: 'primary.main',
                                                        boxShadow: dark ? 3 : 1,
                                                        transform: 'translateY(-1px)',
                                                    },
                                                }}
                                            >
                                                <Box sx={{
                                                    width: 42, height: 42, borderRadius: 1, flexShrink: 0,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 800, fontSize: 16, color: 'text.primary',
                                                    bgcolor: SUBJECT_TINTS[(gi + ti) % SUBJECT_TINTS.length],
                                                }}>
                                                    {label.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 800, fontSize: 15 }} noWrap>
                                                        {label}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {g.subject} · tap to sign in
                                                    </Typography>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                ))}

                {!directory.loading && !directory.error && groups.length === 0 && (
                    <Alert severity="info">No subject-teacher accounts are active yet.</Alert>
                )}
            </Container>

            {/* password dialog */}
            <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
                    Sign in as {selected?.label}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                        {selected?.subject}
                    </Typography>
                </DialogTitle>
                <Box component="form" onSubmit={signIn} noValidate>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <Typography variant="body2" color="text.secondary">
                            Enter the password for this teacher account.
                        </Typography>
                        <TextField
                            label="Password" type={showPassword ? 'text' : 'password'} size="small"
                            fullWidth value={password} onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setShowPassword((s) => !s)} edge="end">
                                            {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
                        <Button type="submit" variant="contained" disableElevation
                            disabled={submitting || password.length === 0}
                            startIcon={<LoginIcon sx={{ fontSize: 16 }} />}
                            sx={{ textTransform: 'none', fontWeight: 700 }}>
                            {submitting ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
