import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, LinearProgress, List, ListItem,
    ListItemText, Stack, Typography,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import ClassIcon from '@mui/icons-material/Class';
import BadgeIcon from '@mui/icons-material/Badge';
import ForumIcon from '@mui/icons-material/Forum';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CampaignIcon from '@mui/icons-material/Campaign';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import { dashboardApi, termApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

function StatCard({ icon, label, value, hint, color = 'primary.main' }) {
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


const FLOW_ICONS = {
    staffing: <AdminPanelSettingsIcon />,
    attendance: <FactCheckIcon />,
    planning: <AutoStoriesIcon />,
    tasks: <TaskAltIcon />,
    messages: <ForumIcon />,
    notices: <CampaignIcon />,
    clinic: <HealthAndSafetyIcon />,
};

const STATUS_META = {
    healthy: { label: 'On track', color: 'success', bar: '#16a34a' },
    attention: { label: 'Watch', color: 'warning', bar: '#d97706' },
    critical: { label: 'Act now', color: 'error', bar: '#dc2626' },
};

function FlowCard({ item }) {
    const meta = STATUS_META[item.status] || STATUS_META.attention;

    return (
        <Card
            sx={{
                height: '100%',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                bgcolor: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(10px)',
            }}
        >
            <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={1.75}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2.5,
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: 'rgba(30, 64, 175, 0.10)',
                                color: 'primary.main',
                                flexShrink: 0,
                            }}
                        >
                            {FLOW_ICONS[item.id] || <SyncAltIcon />}
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                                    {item.title}
                                </Typography>
                                <Chip size="small" color={meta.color} label={meta.label} sx={{ fontWeight: 700 }} />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                                {item.source} → {item.destination}
                            </Typography>
                        </Box>
                    </Stack>

                    <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900 }}>
                                {item.metric}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: meta.bar }}>
                                {item.progress}%
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={item.progress}
                            sx={{
                                height: 8,
                                borderRadius: 999,
                                bgcolor: 'rgba(148, 163, 184, 0.18)',
                                '& .MuiLinearProgress-bar': { bgcolor: meta.bar, borderRadius: 999 },
                            }}
                        />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ minHeight: 42 }}>
                        {item.detail}
                    </Typography>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {item.nextAction}
                        </Typography>
                        <Button size="small" component={RouterLink} to={item.href} sx={{ fontWeight: 800 }}>
                            Open
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function DataFlowCommandCenter() {
    const { data, loading, error } = useApi(() => dashboardApi.dataFlow(), []);

    return (
        <DataState loading={loading} error={error}>
            {data && (
                <Card
                    sx={{
                        mb: 3,
                        overflow: 'hidden',
                        border: 0,
                        color: '#f8fafc',
                        background:
                            'radial-gradient(circle at top left, rgba(20, 184, 166, 0.38), transparent 34%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 56%, #0f766e 100%)',
                        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
                    }}
                >
                    <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                        <Grid container spacing={3} alignItems="center" sx={{ mb: 2 }}>
                            <Grid item xs={12} md={7}>
                                <Chip
                                    size="small"
                                    label={data.role === 'admin' ? 'BRANCH OPERATIONS' : 'MY OPERATIONS FLOW'}
                                    sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: 'white', fontWeight: 800, mb: 1.5 }}
                                />
                                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
                                    Teacher ↔ Admin data flow command center
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.78)', mt: 0.75, maxWidth: 720 }}>
                                    A live operational map of attendance, planning reviews, tasks, messages, notices and safeguarding approvals.
                                </Typography>
                            </Grid>
                            <Grid item xs={12} md={5}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent={{ md: 'flex-end' }}>
                                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.12)', minWidth: 130 }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700 }}>
                                            Flow health
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                                            {data.healthScore}%
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.12)', minWidth: 130 }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700 }}>
                                            Open items
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 900 }}>
                                            {data.openItems}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                        </Grid>

                        <Grid container spacing={2}>
                            {(data.flows || []).map((item) => (
                                <Grid item xs={12} sm={6} lg={4} xl={3} key={item.id}>
                                    <FlowCard item={item} />
                                </Grid>
                            ))}
                        </Grid>
                    </CardContent>
                </Card>
            )}
        </DataState>
    );
}

/** School-wide view for administrators. */
function AdminDashboard() {
    const { data, loading, error } = useApi(() => dashboardApi.summary(), []);

    return (
        <DataState loading={loading} error={error}>
            {data && (
                <Grid container spacing={2.5}>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard icon={<GroupsIcon />} label="Active students" value={data.students} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard icon={<ClassIcon />} label="Classes" value={data.classes} color="secondary.main" />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard icon={<BadgeIcon />} label="Staff" value={data.staff} color="#7c3aed" />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <StatCard
                            icon={<ForumIcon />}
                            label="Open conversations"
                            value={data.openThreads}
                            hint={`${data.openTasks} open task(s)`}
                            color={data.openThreads > 0 ? 'warning.main' : 'success.main'}
                        />
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Attendance today</Typography>
                                {data.attendanceToday.marked === 0 ? (
                                    <Typography color="text.secondary" variant="body2">
                                        No homeroom attendance recorded yet today.
                                    </Typography>
                                ) : (
                                    <Stack direction="row" spacing={3} alignItems="baseline">
                                        <Typography variant="h4">{data.attendanceToday.rate}%</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {data.attendanceToday.present} present of {data.attendanceToday.marked} marked
                                        </Typography>
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Needs attention</Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip
                                        label={`${data.pendingLeaveRequests} pending leave`}
                                        color={data.pendingLeaveRequests > 0 ? 'warning' : 'default'}
                                        variant={data.pendingLeaveRequests > 0 ? 'filled' : 'outlined'}
                                    />
                                    <Chip
                                        label={`${data.overdueBooks} overdue book(s)`}
                                        color={data.overdueBooks > 0 ? 'error' : 'default'}
                                        variant={data.overdueBooks > 0 ? 'filled' : 'outlined'}
                                    />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </DataState>
    );
}

/** Personal view for teaching staff: my classes, my day, my work. */
function TeacherDashboard() {
    const { data, loading, error } = useApi(() => dashboardApi.me(), []);

    return (
        <DataState loading={loading} error={error}>
            {data && (
                <Grid container spacing={2.5}>
                    {data.attendanceOutstanding.length > 0 && (
                        <Grid item xs={12}>
                            <Alert
                                severity="warning"
                                action={
                                    <Button size="small" component={RouterLink} to="/app/attendance">
                                        Take attendance
                                    </Button>
                                }
                            >
                                Attendance not yet recorded for{' '}
                                {data.attendanceOutstanding.map((c) => c.name).join(', ')}.
                            </Alert>
                        </Grid>
                    )}

                    {data.planningGaps?.length > 0 && (
                        <Grid item xs={12}>
                            <Alert
                                severity="info"
                                action={
                                    <Button size="small" component={RouterLink} to="/app/planning">
                                        Open planning
                                    </Button>
                                }
                            >
                                {data.planningGaps.filter((g) => g.missingScheme).length > 0
                                    ? `${data.planningGaps.filter((g) => g.missingScheme).length} subject(s) have no scheme of work this term.`
                                    : `This week's lesson plan is missing for ${data.planningGaps.length} subject(s).`}
                            </Alert>
                        </Grid>
                    )}

                    {/* Today's schedule */}
                    <Grid item xs={12} md={7}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Today's schedule</Typography>
                                {data.todaySlots.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        No timetabled lessons today.
                                    </Typography>
                                ) : (
                                    <List dense disablePadding>
                                        {data.todaySlots.map((slot) => (
                                            <ListItem key={slot.id} disableGutters divider>
                                                <ListItemText
                                                    primary={`${slot.subject?.name} — ${slot.class?.name}`}
                                                    secondary={`${slot.startsAt?.slice(0, 5)}–${slot.endsAt?.slice(0, 5)}${slot.room ? ` · ${slot.room}` : ''}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* My classes */}
                    <Grid item xs={12} md={5}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>My classes</Typography>

                                {data.homerooms.length === 0 && data.teachingSubjects.length === 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        No classes assigned yet.
                                    </Typography>
                                )}

                                {data.homerooms.map((h) => (
                                    <Stack key={h.class?.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <Chip
                                            size="small"
                                            label={h.position === 'main' ? 'Homeroom' : 'Assistant'}
                                            color={h.position === 'main' ? 'primary' : 'default'}
                                        />
                                        <Typography variant="body2">{h.class?.name}</Typography>
                                    </Stack>
                                ))}

                                {data.teachingSubjects.length > 0 && (
                                    <>
                                        <Divider sx={{ my: 1.5 }} />
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                            Subject teaching
                                        </Typography>
                                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                            {data.teachingSubjects.map((s) => (
                                                <Chip
                                                    key={s.id}
                                                    size="small"
                                                    variant="outlined"
                                                    label={`${s.subject?.name} · ${s.class?.name}`}
                                                />
                                            ))}
                                        </Stack>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* My tasks */}
                    <Grid item xs={12} md={7}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="h6">My tasks</Typography>
                                    <Button size="small" component={RouterLink} to="/app/tasks">View all</Button>
                                </Stack>

                                {data.openTasks.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Nothing outstanding. 
                                    </Typography>
                                ) : (
                                    <List dense disablePadding>
                                        {data.openTasks.slice(0, 5).map((t) => (
                                            <ListItem key={t.id} disableGutters divider>
                                                <ListItemText
                                                    primary={t.title}
                                                    secondary={t.dueOn ? `Due ${t.dueOn}` : 'No due date'}
                                                />
                                                {t.isOverdue && <Chip label="Overdue" size="small" color="error" />}
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* What's coming up */}
                    <Grid item xs={12} md={7}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="h6">Coming up</Typography>
                                    <Button size="small" component={RouterLink} to="/app/calendar">Calendar</Button>
                                </Stack>

                                {(data.upcomingEvents || []).length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Nothing scheduled in the next two weeks.
                                    </Typography>
                                ) : (
                                    <List dense disablePadding>
                                        {data.upcomingEvents.map((e) => (
                                            <ListItem key={e.id} disableGutters divider>
                                                <ListItemText
                                                    primary={e.title}
                                                    secondary={`${e.startsOn}${e.location ? ` · ${e.location}` : ''}`}
                                                />
                                                <Chip size="small" label={e.category} variant="outlined" />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Messages */}
                    <Grid item xs={12} md={5}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Messages</Typography>
                                <Stack direction="row" alignItems="baseline" spacing={1.5}>
                                    <Typography variant="h4" color={data.unreadMessages ? 'primary.main' : 'text.primary'}>
                                        {data.unreadMessages}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">unread</Typography>
                                </Stack>
                                <Button
                                    size="small" component={RouterLink} to="/app/messages" sx={{ mt: 1 }}
                                >
                                    Open inbox
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </DataState>
    );
}

export default function Dashboard() {
    const { user, isAdmin } = useAuth();
    const { data: termData } = useApi(() => termApi.current(), []);

    const termLine = termData?.term
        ? `${termData.term.name}${termData.currentWeek ? ` · week ${termData.currentWeek} of ${termData.term.weekCount}` : ''}`
        : null;

    return (
        <>
            <PageHeader
                title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
                subtitle={termLine || (isAdmin ? 'School overview.' : 'Your classes, schedule and work for today.')}
            />
            <DataFlowCommandCenter />
            {isAdmin ? <AdminDashboard /> : <TeacherDashboard />}
        </>
    );
}
