import { Fragment } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
    Badge, Box, Button, Chip, Divider, Stack, Typography, useTheme,
} from '@mui/material';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import ClassIcon from '@mui/icons-material/Class';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import TodayIcon from '@mui/icons-material/Today';
import GradeIcon from '@mui/icons-material/Grade';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BadgeIcon from '@mui/icons-material/Badge';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolIcon from '@mui/icons-material/School';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../auth/AuthContext';
import NotificationBell from './NotificationBell';
import { useColorScheme } from '../theme';
import useApi from '../hooks/useApi';
import { communicationsApi } from '../api/endpoints';

/*
 * The staff workspace shell — shared look & feel with the teacher
 * dashboards (Class Home / Subject Home): a slim brand header, a grouped
 * side-nav card on desktop, one horizontal scroll row on mobile, and the
 * settings card pinned to the bottom of the nav.
 *
 * Which items show depends on the signed-in role; admins see everything.
 */

const NAV_GROUPS = [
    {
        label: 'School Today',
        items: [
            { label: 'Dashboard', to: '/app', icon: <DashboardIcon fontSize="small" />, end: true },
            { label: 'Calendar', to: '/app/calendar', icon: <CalendarMonthIcon fontSize="small" /> },
            { label: 'Timetable', to: '/app/timetable', icon: <CalendarMonthIcon fontSize="small" /> },
            { label: 'Notices', to: '/app/notices', icon: <NotificationsNoneIcon fontSize="small" /> },
        ],
    },
    {
        label: 'Classwork',
        items: [
            { label: 'Daily Planner', to: '/app/planner', icon: <TodayIcon fontSize="small" />, roles: ['main_teacher', 'subject_teacher'] },
            { label: 'Tasks', to: '/app/tasks', icon: <TaskAltIcon fontSize="small" /> },
            { label: 'Planning', to: '/app/planning', icon: <MenuBookOutlinedIcon fontSize="small" /> },
            { label: 'Attendance', to: '/app/attendance', icon: <FactCheckIcon fontSize="small" /> },
            {
                label: 'Marksheets', to: '/app/marksheets', icon: <GradeIcon fontSize="small" />,
                roles: ['admin', 'main_teacher', 'subject_teacher'],
            },
            {
                label: 'Report Cards', to: '/app/report-cards', icon: <SummarizeOutlinedIcon fontSize="small" />,
                roles: ['admin', 'main_teacher', 'subject_teacher'],
            },
        ],
    },
    {
        label: 'People & Classes',
        items: [
            { label: 'Students', to: '/app/students', icon: <GroupsIcon fontSize="small" /> },
            { label: 'Classes', to: '/app/classes', icon: <ClassIcon fontSize="small" /> },
            { label: 'Staff', to: '/app/staff', icon: <BadgeIcon fontSize="small" />, roles: ['admin'] },
            { label: 'Assignments', to: '/app/assignments', icon: <AssignmentIndIcon fontSize="small" />, roles: ['admin'] },
            { label: 'Subjects', to: '/app/subjects', icon: <MenuBookIcon fontSize="small" />, roles: ['admin'] },
            { label: 'Files', to: '/app/files', icon: <FolderIcon fontSize="small" /> },
            { label: 'Library', to: '/app/library', icon: <MenuBookIcon fontSize="small" />, roles: ['admin', 'librarian'] },
        ],
    },
    {
        label: 'Admin Communications',
        items: [
            {
                label: 'Communications', to: '/app/communications',
                icon: <CampaignOutlinedIcon fontSize="small" />, badge: 'communications', roles: ['admin'],
            },
        ],
    },
];

const SETTINGS_ITEM = { label: 'Settings', to: '/app/settings', icon: <SettingsIcon fontSize="small" /> };

const ROLE_CAPTION = {
    admin: 'Administration',
    main_teacher: 'Main teacher workspace',
    assistant_teacher: 'Assistant teacher workspace',
    subject_teacher: 'Subject teacher workspace',
    store_manager: 'Store workspace',
    librarian: 'Library workspace',
};

function NavButton({ item }) {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    return (
        <Button
            component={NavLink}
            to={item.to}
            end={item.end}
            fullWidth
            startIcon={item.badge ? (
                <Badge color="error" variant="dot" invisible={!item.unread}>{item.icon}</Badge>
            ) : item.icon}
            sx={{
                justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700,
                borderRadius: 2, px: 1.5, minHeight: 40, color: 'text.secondary',
                '&.active': {
                    bgcolor: 'primary.main', color: '#fff',
                    '&:hover': { bgcolor: 'primary.dark' },
                },
                '&:not(.active):hover': {
                    bgcolor: dark ? 'rgba(255,255,255,.06)' : 'rgba(30,64,175,.06)',
                    color: 'primary.main',
                },
            }}
        >
            {item.label}
        </Button>
    );
}

export default function AppLayout() {
    const { user, logout } = useAuth();
    const theme = useTheme();
    const { toggleColorScheme } = useColorScheme();
    const dark = theme.palette.mode === 'dark';

    const isAdmin = user?.role === 'admin';
    const isLibrarian = user?.role === 'librarian';

    // Live pending count for the Admin Communications badge (admin only).
    const commsBadges = useApi(
        () => (isAdmin ? communicationsApi.badgeCounts() : Promise.resolve(null)),
        [isAdmin],
    );
    const commsPending = commsBadges.data
        ? (commsBadges.data.storeRequestsPending || 0)
            + (commsBadges.data.permissionRequestsPending || 0)
            + (commsBadges.data.conductReportsPending || 0)
        : 0;

    const groups = isLibrarian
        ? [{
            label: 'Library',
            items: [{ label: 'Library', to: '/app/library', icon: <MenuBookIcon fontSize="small" /> },
                { label: 'Borrowed', to: '/app/library?view=borrowed', icon: <MenuBookIcon fontSize="small" /> },
                { label: 'Returned', to: '/app/library?view=returned', icon: <MenuBookIcon fontSize="small" /> }],
        }]
        : NAV_GROUPS
            .map((g) => ({
                ...g,
                items: g.items
                    .filter((item) => !item.roles || item.roles.includes(user?.role))
                    .map((item) => (item.badge === 'communications' ? { ...item, unread: commsPending } : item)),
            }))
            .filter((g) => g.items.length > 0);

    const signOut = () => {
        logout();
        window.location.replace('/login');
    };

    const caption = `${ROLE_CAPTION[user?.role] || 'Staff workspace'} · 2026/2027`;
    const surface = dark ? theme.palette.background.paper : '#ffffff';

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: dark ? 'background.default' : '#f8fafc' }}>
            {/* slim brand header — same language as the teacher dashboards */}
            <Box sx={{
                position: 'sticky', top: 0, zIndex: 20,
                bgcolor: surface, borderBottom: '1px solid', borderColor: 'divider',
            }}>
                <Box sx={{
                    maxWidth: 1600, mx: 'auto', px: { xs: 2, sm: 3 }, py: 1.25,
                    display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                    <Box sx={{
                        width: 36, height: 36, borderRadius: 1, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'primary.main', color: '#fff', flexShrink: 0,
                    }}>
                        <SchoolIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }} noWrap>
                            BIS NOC Gerji
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{caption}</Typography>
                    </Box>
                    <NotificationBell />
                    {user?.name && (
                        <Chip size="small" label={user.name}
                            sx={{ fontWeight: 700, borderRadius: 1, display: { xs: 'none', sm: 'inline-flex' } }} />
                    )}
                    <Button
                        onClick={toggleColorScheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                        sx={{
                            minWidth: 0, width: 34, height: 34, borderRadius: 1, p: 0,
                            border: '1px solid', borderColor: 'divider', color: 'text.secondary',
                        }}
                    >
                        {dark ? <LightModeIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
                    </Button>
                    <Button
                        onClick={signOut} aria-label="Sign out"
                        startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                        size="small"
                        sx={{
                            textTransform: 'none', fontWeight: 700, color: 'text.secondary',
                            border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5,
                        }}
                    >
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sign out</Box>
                    </Button>
                </Box>
            </Box>

            {/* mobile nav — one horizontal scroll row, same as Class Home */}
            <Box
                data-testid="side-nav-mobile"
                sx={{
                    display: { xs: 'flex', md: 'none' }, gap: 0.75, px: 2, py: 1.25,
                    overflowX: 'auto', borderBottom: '1px solid', borderColor: 'divider',
                    bgcolor: surface,
                }}
            >
                {groups.map((g) => (
                    <Fragment key={g.label}>
                        {g.items.map((item) => (
                            <Button
                                key={item.to}
                                component={NavLink}
                                to={item.to}
                                end={item.end}
                                size="small"
                                sx={{
                                    textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap',
                                    borderRadius: 2, color: 'text.secondary', minHeight: 36,
                                    '&.active': { bgcolor: 'primary.main', color: '#fff' },
                                }}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </Fragment>
                ))}
                {<Button
                    component={NavLink}
                    to={SETTINGS_ITEM.to}
                    size="small"
                    data-testid="mobile-nav-settings"
                    sx={{
                        textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap',
                        borderRadius: 2, color: 'text.secondary', minHeight: 36,
                        '&.active': { bgcolor: 'primary.main', color: '#fff' },
                    }}
                >
                    Settings
                </Button>}
            </Box>

            <Box sx={{
                maxWidth: 1600, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 },
                display: 'flex', gap: 3, alignItems: 'flex-start',
            }}>
                {/* desktop side-nav card — the scroll lives one layer inside,
                    so the card's right edge stays visible next to the bar */}
                <Box
                    component="nav"
                    data-testid="side-nav"
                    sx={{
                        display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
                        width: 232, flexShrink: 0, borderRadius: 1.5,
                        bgcolor: surface, border: '1px solid', borderColor: 'divider',
                        py: 1.5, pl: 1.5, pr: 0.5, position: 'sticky', top: 88,
                        height: 'calc(100vh - 100px)', overflow: 'hidden',
                    }}
                >
                    <Box sx={{
                        flexGrow: 1, minHeight: 0, overflowY: 'auto', pr: 1,
                        display: 'flex', flexDirection: 'column',
                    }}>
                    {groups.map((g, gi) => (
                        <Box key={g.label} sx={{ mb: 0.5 }}>
                            <Typography
                                variant="overline"
                                data-testid={`side-nav-group-${gi}`}
                                sx={{
                                    px: 1.5, pt: 1.5, pb: 0.5, display: 'block',
                                    color: 'text.disabled', fontSize: 10.5, fontWeight: 700,
                                    letterSpacing: '.08em',
                                }}
                            >
                                {g.label}
                            </Typography>
                            <Stack spacing={0.25}>
                                {g.items.map((item) => <NavButton key={item.to} item={item} />)}
                            </Stack>
                        </Box>
                    ))}

                    <Box sx={{ flexGrow: 1 }} data-testid="side-nav-spacer" />
                    <Divider sx={{ my: 1 }} />
                    <Box data-testid="side-nav-settings">
                        <NavButton item={SETTINGS_ITEM} />
                    </Box>
                    </Box>
                </Box>

                {/* page content */}
                <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
}
