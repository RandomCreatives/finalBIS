import { Link as RouterLink } from 'react-router-dom';
import {
    AppBar, Avatar, Box, Button, Card, CardContent, Chip, Container, Divider, Grid,
    LinearProgress, Stack, Switch, FormControlLabel, Toolbar, Typography, useTheme,
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LoginIcon from '@mui/icons-material/Login';
import GroupsIcon from '@mui/icons-material/Groups';
import ClassIcon from '@mui/icons-material/Class';
import BadgeIcon from '@mui/icons-material/Badge';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import StorageIcon from '@mui/icons-material/Storage';
import { datacenterApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import DataState from '../components/DataState';
import { useColorScheme } from '../theme';
import { useAuth } from '../auth/AuthContext';

const MEDAL_COLORS = ['#d4a017', '#9ca3af', '#b45309'];
const GRADE_COLORS = { 'A+': 'success', A: 'success', 'B+': 'primary', B: 'primary', C: 'warning', D: 'warning', F: 'error' };

function StatCard({ icon, label, value, hint, accent }) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <Box
                        sx={{
                            width: 40, height: 40, borderRadius: 2,
                            display: 'grid', placeItems: 'center',
                            bgcolor: accent || 'rgba(30, 64, 175, 0.12)',
                            color: accent ? '#fff' : 'primary.main',
                        }}
                    >
                        {icon}
                    </Box>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                </Stack>
                <Typography variant="h4">{value ?? '—'}</Typography>
                {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
            </CardContent>
        </Card>
    );
}

function GenderBar({ label, value, max, color }) {
    const pct = max ? Math.round((value / max) * 100) : 0;
    return (
        <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
                <Typography variant="body2" color="text.secondary">{value}</Typography>
            </Stack>
            <LinearProgress
                variant="determinate" value={pct} sx={{
                    height: 10, borderRadius: 999,
                    bgcolor: 'rgba(148, 163, 184, 0.18)',
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 },
                }}
            />
        </Box>
    );
}

function ClassBar({ name, count, max }) {
    const pct = max ? Math.round((count / max) * 100) : 0;
    return (
        <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                <Typography variant="body2">{name}</Typography>
                <Typography variant="body2" color="text.secondary">{count} students</Typography>
            </Stack>
            <LinearProgress
                variant="determinate" value={pct} sx={{
                    height: 8, borderRadius: 999,
                    bgcolor: 'rgba(148, 163, 184, 0.18)',
                    '& .MuiLinearProgress-bar': { bgcolor: 'secondary.main', borderRadius: 999 },
                }}
            />
        </Box>
    );
}

function SubjectBar({ name, average }) {
    const pct = average ?? 0;
    return (
        <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                <Typography variant="body2">{name}</Typography>
                <Typography variant="body2" color="text.secondary">{average ?? '—'}%</Typography>
            </Stack>
            <LinearProgress
                variant="determinate" value={pct} sx={{
                    height: 8, borderRadius: 999,
                    bgcolor: 'rgba(148, 163, 184, 0.18)',
                    '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 999 },
                }}
            />
        </Box>
    );
}

function LeaderboardCard({ title, icon, children }) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(30, 64, 175, 0.12)', color: 'primary.main' }}>
                        {icon}
                    </Box>
                    <Typography variant="h6">{title}</Typography>
                </Stack>
                {children}
            </CardContent>
        </Card>
    );
}

export default function DataCenter() {
    const { isAuthenticated } = useAuth();
    const { toggleColorScheme } = useColorScheme();
    const theme = useTheme();

    const stats = useApi(() => datacenterApi.stats(), []);
    const academic = useApi(() => datacenterApi.academic(), []);

    const s = stats.data;
    const a = academic.data;

    const genderMax = Math.max(s?.maleStudents || 0, s?.femaleStudents || 0, s?.otherGenderStudents || 0, 1);
    const classMax = Math.max(...(s?.studentsByClass || []).map((c) => c.count), 1);

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary' }}>
            <AppBar
                position="sticky" elevation={0}
                sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary', zIndex: (t) => t.zIndex.drawer + 1 }}
            >
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 72 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: '#fff' }}>
                                <StorageIcon sx={{ fontSize: 22 }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>BIS NOC Data Center</Typography>
                                <Typography variant="caption" color="text.secondary">Live school statistics</Typography>
                            </Box>
                        </Stack>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={theme.palette.mode === 'dark'}
                                        onChange={toggleColorScheme}
                                        icon={<LightModeIcon sx={{ fontSize: 20 }} />}
                                        checkedIcon={<DarkModeIcon sx={{ fontSize: 20 }} />}
                                    />
                                }
                                label=""
                                sx={{ m: 0 }}
                                aria-label="Toggle dark mode"
                            />
                            <Button variant="contained" component={RouterLink} to={isAuthenticated ? '/app' : '/login'} startIcon={<LoginIcon />} sx={{ fontWeight: 700, px: 2.5, borderRadius: 2 }}>
                                {isAuthenticated ? 'Dashboard' : 'Sign In'}
                            </Button>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            <Container maxWidth="xl" sx={{ py: 4, flex: 1 }}>
                <Typography variant="h4" sx={{ mb: 0.5 }}>School at a Glance</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {a?.termName
                        ? `Academic reporting for the current term — ${a.termName}.`
                        : 'Enrolment, staffing and academic reporting. Marksheets unlock the rankings.'}
                </Typography>

                <DataState loading={stats.loading} error={stats.error}>
                    {s && (
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                            <Grid item xs={6} md={3}>
                                <StatCard icon={<GroupsIcon />} label="Total Students" value={s.totalStudents} hint={`${s.maleStudents} boys · ${s.femaleStudents} girls`} />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <StatCard icon={<BadgeIcon />} label="Teachers" value={s.totalTeachers} accent="rgba(15, 118, 110, 0.85)" />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <StatCard icon={<ClassIcon />} label="Classes" value={s.totalClasses} accent="rgba(180, 83, 9, 0.85)" />
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <StatCard
                                    icon={<FactCheckIcon />} label="Attendance Rate"
                                    value={s.attendanceRate === null ? '—' : `${s.attendanceRate}%`}
                                    accent="rgba(22, 163, 74, 0.85)"
                                    hint="present + late records"
                                />
                            </Grid>
                        </Grid>
                    )}
                </DataState>

                <DataState loading={stats.loading} error={stats.error}>
                    {s && (
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={4}>
                                <LeaderboardCard title="Gender Split" icon={<GroupsIcon />}>
                                    <GenderBar label="Male" value={s.maleStudents} max={genderMax} color="#3b82f6" />
                                    <GenderBar label="Female" value={s.femaleStudents} max={genderMax} color="#ec4899" />
                                    {s.otherGenderStudents > 0 && (
                                        <GenderBar label="Other" value={s.otherGenderStudents} max={genderMax} color="#8b5cf6" />
                                    )}
                                    {s.totalStudents === 0 && (
                                        <Typography variant="body2" color="text.secondary">No students on roll yet.</Typography>
                                    )}
                                </LeaderboardCard>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <LeaderboardCard title="Students per Class" icon={<ClassIcon />}>
                                    {(s.studentsByClass || []).length > 0 ? (
                                        (s.studentsByClass || []).map((c) => (
                                            <ClassBar key={c.className} name={c.className} count={c.count} max={classMax} />
                                        ))
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">No class rolls yet.</Typography>
                                    )}
                                </LeaderboardCard>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <LeaderboardCard title="Subjects Offered" icon={<MenuBookIcon />}>
                                    <Typography variant="h3" sx={{ mb: 1 }}>{s.totalSubjects ?? '—'}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Core and elective subjects in the school catalogue.
                                    </Typography>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {Object.keys(s.teachersByRole || {}).length
                                            ? 'Teaching staff by role:'
                                            : 'Teacher roles will appear here.'}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
                                        {(s.teachersByRole ? Object.entries(s.teachersByRole) : []).map(([role, count]) => (
                                            <Chip key={role} size="small" label={`${role.replace(/_/g, ' ')} · ${count}`} variant="outlined" />
                                        ))}
                                    </Stack>
                                </LeaderboardCard>
                            </Grid>
                        </Grid>
                    )}
                </DataState>

                <DataState loading={academic.loading} error={academic.error}>
                    {a && (
                        <Grid container spacing={2.5} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={6}>
                                <LeaderboardCard title="School Top 10" icon={<EmojiEventsIcon />}>
                                    {a.schoolTop10.length > 0 ? (
                                        <Stack spacing={1}>
                                            {a.schoolTop10.map((row) => (
                                                <Stack
                                                    key={row.admissionNo}
                                                    direction="row" spacing={1.5} alignItems="center"
                                                    sx={{
                                                        p: 1.25, borderRadius: 2,
                                                        bgcolor: row.rank <= 3 ? 'rgba(30, 64, 175, 0.07)' : 'action.hover',
                                                        border: row.rank <= 3 ? '1px solid rgba(30, 64, 175, 0.25)' : '1px solid transparent',
                                                    }}
                                                >
                                                    <Avatar sx={{ width: 32, height: 32, fontSize: 14, fontWeight: 800, bgcolor: MEDAL_COLORS[row.rank - 1] || 'rgba(100,116,139,0.9)' }}>
                                                        {row.rank}
                                                    </Avatar>
                                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{row.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {row.className || 'No class'} · {row.admissionNo}
                                                        </Typography>
                                                    </Box>
                                                    <Chip size="small" color={GRADE_COLORS[row.grade] || 'default'} label={`${row.average}%`} sx={{ fontWeight: 800 }} />
                                                </Stack>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Box sx={{ textAlign: 'center', py: 4 }}>
                                            <WorkspacePremiumIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                            <Typography variant="body2" color="text.secondary">
                                                Enter marks for the current term to unlock the school leaderboard.
                                            </Typography>
                                        </Box>
                                    )}
                                </LeaderboardCard>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <LeaderboardCard title="Class Top 3" icon={<AutoStoriesIcon />}>
                                    {a.perClassTop3.length > 0 ? (
                                        <Stack spacing={2}>
                                            {a.perClassTop3.map((c) => (
                                                <Box key={c.className}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>{c.className}</Typography>
                                                    <Stack direction="row" spacing={1}>
                                                        {c.top3.map((row) => (
                                                            <Card key={row.admissionNo} variant="outlined" sx={{ flex: 1, p: 1, borderColor: 'divider', boxShadow: 'none' }}>
                                                                <CardContent sx={{ p: 1.25, textAlign: 'center' }}>
                                                                    <Typography variant="h6" sx={{ fontWeight: 900, color: MEDAL_COLORS[row.rank - 1] }}>{row.rank}</Typography>
                                                                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }} noWrap>{row.name}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{row.average}%</Typography>
                                                                </CardContent>
                                                            </Card>
                                                        ))}
                                                    </Stack>
                                                </Box>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Box sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Per-class leaders will appear once marks are entered.
                                            </Typography>
                                        </Box>
                                    )}
                                </LeaderboardCard>
                            </Grid>
                        </Grid>
                    )}
                </DataState>

                <DataState loading={academic.loading} error={academic.error}>
                    {a && a.subjectAverages.length > 0 && (
                        <Card>
                            <CardContent sx={{ p: 2.5 }}>
                                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                    <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(15, 118, 110, 0.12)', color: 'secondary.main' }}>
                                        <MenuBookIcon />
                                    </Box>
                                    <Box>
                                        <Typography variant="h6">Subject Performance</Typography>
                                        <Typography variant="caption" color="text.secondary">Average percentage across the current term</Typography>
                                    </Box>
                                </Stack>
                                <Grid container spacing={2}>
                                    {a.subjectAverages.map((sub) => (
                                        <Grid item xs={12} sm={6} md={4} key={sub.name}>
                                            <SubjectBar name={sub.name} average={sub.average} />
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    )}
                </DataState>
            </Container>

            <Box sx={{ py: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider', mt: 'auto' }}>
                <Typography variant="caption" color="text.secondary">
                    &copy; {new Date().getFullYear()} British International School, NOC Gerji Campus.
                    &nbsp;|&nbsp; Public statistics refresh as school data is recorded.
                </Typography>
            </Box>
        </Box>
    );
}
