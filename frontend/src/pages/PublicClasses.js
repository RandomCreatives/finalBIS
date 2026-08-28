import { Link as RouterLink } from 'react-router-dom';
import {
    Box, Button, Card, CardContent, Container, Typography, useTheme, Grid, Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import { useColorScheme } from '../theme';

/*
 * Public, login-free view of the school's classes.
 *
 * For now the 14 classes are seeded locally (the backend API requires a JWT,
 * and sign-in is being redesigned separately). The shape mirrors the real
 * `classApi.list()` rows so this can later be swapped for a live fetch.
 */
const CLASSES = [
    // Year 3 — 4 homerooms
    { id: 1, name: 'Year 3 Blue',   yearLevel: 3, mainTeacher: 'Mr. Abebe',     assistantTeacher: null, studentCount: 26 },
    { id: 2, name: 'Year 3 Red',    yearLevel: 3, mainTeacher: 'Ms. Hana',      assistantTeacher: null, studentCount: 24 },
    { id: 3, name: 'Year 3 Green',  yearLevel: 3, mainTeacher: 'Mr. Daniel',    assistantTeacher: null, studentCount: 25 },
    { id: 4, name: 'Year 3 Yellow', yearLevel: 3, mainTeacher: 'Ms. Sara',      assistantTeacher: null, studentCount: 23 },
    // Year 4 — 10 homerooms
    { id: 5,  name: 'Year 4 Blue',   yearLevel: 4, mainTeacher: 'Mr. Kebede',   assistantTeacher: null, studentCount: 29 },
    { id: 6,  name: 'Year 4 Red',    yearLevel: 4, mainTeacher: 'Ms. Ruth',     assistantTeacher: null, studentCount: 28 },
    { id: 7,  name: 'Year 4 Green',  yearLevel: 4, mainTeacher: 'Mr. Thomas',   assistantTeacher: null, studentCount: 30 },
    { id: 8,  name: 'Year 4 Yellow', yearLevel: 4, mainTeacher: 'Ms. Lydia',    assistantTeacher: null, studentCount: 27 },
    { id: 9,  name: 'Year 4 Orange', yearLevel: 4, mainTeacher: 'Mr. Samuel',   assistantTeacher: null, studentCount: 28 },
    { id: 10, name: 'Year 4 Purple', yearLevel: 4, mainTeacher: 'Ms. Helen',    assistantTeacher: null, studentCount: 26 },
    { id: 11, name: 'Year 4 Pink',   yearLevel: 4, mainTeacher: 'Mr. Yonas',    assistantTeacher: null, studentCount: 29 },
    { id: 12, name: 'Year 4 Teal',   yearLevel: 4, mainTeacher: 'Ms. Frehiwot', assistantTeacher: null, studentCount: 25 },
    { id: 13, name: 'Year 4 Indigo', yearLevel: 4, mainTeacher: 'Mr. Elias',    assistantTeacher: null, studentCount: 30 },
    { id: 14, name: 'Year 4 Cyan',   yearLevel: 4, mainTeacher: 'Ms. Betelehem',assistantTeacher: null, studentCount: 27 },
];

function ClassCard({ klass }) {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    return (
        <Card variant="outlined" sx={{ height: '100%', borderRadius: 3, bgcolor: surface,
            borderColor: border,
            transition: 'transform .18s, border-color .18s, box-shadow .18s',
            '&:hover': {
                transform: 'translateY(-4px)', borderColor: 'primary.main',
                boxShadow: dark ? '0 16px 40px rgba(0,0,0,.4)' : '0 16px 40px rgba(15,23,42,.08)',
            } }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                        <SchoolIcon />
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{klass.name}</Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Main Teacher
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.mainTeacher}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Assistant Teacher
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.assistantTeacher || 'Not assigned'}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: .5 }}>
                        <GroupsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Students
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.studentCount}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}

export default function PublicClasses() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const year3 = CLASSES.filter((c) => c.yearLevel === 3);
    const year4 = CLASSES.filter((c) => c.yearLevel === 4);

    const renderGroup = (title, list) => (
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                    {title}
                </Typography>
                <Chip label={`${list.length} classes`} size="small"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main' }} />
            </Box>
            <Grid container spacing={2.5}>
                {list.map((klass) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={klass.id}>
                        <ClassCard klass={klass} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: 'background.default', color: 'text.primary' }}>
            {/* ── header ── */}
            <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1px solid ${border}`, bgcolor: alpha(surface, 0.9),
                backdropFilter: 'blur(12px)' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 68, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: 'primary.main',
                                color: '#fff', display: 'flex', alignItems: 'center',
                                justifyContent: 'center' }}>
                                <SchoolIcon />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                                    BIS NOC Gerji
                                </Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary',
                                    letterSpacing: .5 }}>
                                    British International School
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 2,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 18 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button component={RouterLink} to="/login" variant="contained" size="small"
                                startIcon={<LoginIcon />} sx={{ fontWeight: 700, borderRadius: 2, px: 2.5,
                                    textTransform: 'none' }}>
                                Sign In
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── content ── */}
            <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
                <Box sx={{ mb: { xs: 5, md: 7 } }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                        Classes
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 600 }}>
                        The {CLASSES.length} homeroom groups at British International School, Gerji
                        Primary II — {year3.length} in Year 3 and {year4.length} in Year 4.
                    </Typography>
                </Box>

                {renderGroup('Year 3', year3)}
                {renderGroup('Year 4', year4)}
            </Container>

            {/* ── footer ── */}
            <Box sx={{ py: 4, borderTop: `1px solid ${border}`, bgcolor: surface, mt: 'auto' }}>
                <Container maxWidth="lg">
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
                        &copy; {new Date().getFullYear()} British International School, Gerji Primary II
                        &nbsp;·&nbsp; Internal Staff Use Only
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
}
