import { Fragment, useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
    AppBar, Avatar, Badge, Box, Divider, Drawer, IconButton, List, ListItemButton,
    ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import ClassIcon from '@mui/icons-material/Class';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventNoteIcon from '@mui/icons-material/EventNote';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import BadgeIcon from '@mui/icons-material/Badge';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TodayIcon from '@mui/icons-material/Today';
import GradeIcon from '@mui/icons-material/Grade';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import FolderIcon from '@mui/icons-material/Folder';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../auth/AuthContext';

const DRAWER_WIDTH = 248;

const DASHBOARD_ITEM = { label: 'Dashboard', to: '/app', icon: <DashboardIcon />, end: true };

const NAV_SECTIONS = [
    {
        label: 'Academic',
        items: [
            { label: 'Daily Planner', to: '/app/planner', icon: <TodayIcon />, roles: ['main_teacher', 'subject_teacher'] },
            { label: 'Tasks', to: '/app/tasks', icon: <TaskAltIcon /> },
            { label: 'Timetable', to: '/app/timetable', icon: <CalendarMonthIcon /> },
            { label: 'Planning', to: '/app/planning', icon: <MenuBookOutlinedIcon /> },
            { label: 'Attendance', to: '/app/attendance', icon: <FactCheckIcon /> },
            {
                label: 'Marksheets', to: '/app/marksheets', icon: <GradeIcon />,
                roles: ['admin', 'main_teacher', 'subject_teacher'],
            },
        ],
    },
    {
        label: 'Classroom',
        items: [
            { label: 'Students', to: '/app/students', icon: <GroupsIcon /> },
            { label: 'Classes', to: '/app/classes', icon: <ClassIcon /> },
            { label: 'Files', to: '/app/files', icon: <FolderIcon /> },
            // v1.1 — dormant for term start, revived by re-adding these items:
            // { label: 'Store', to: '/app/store', icon: <StorefrontIcon /> },
            // { label: 'Library', to: '/app/library', icon: <LocalLibraryIcon /> },
            // { label: 'Clinic', to: '/app/clinic', icon: <HealthAndSafetyIcon /> },
        ],
    },
    {
        label: 'Administration',
        adminOnly: true,
        items: [
            { label: 'Assignments', to: '/app/assignments', icon: <AssignmentIndIcon /> },
            { label: 'Subjects', to: '/app/subjects', icon: <MenuBookIcon /> },
            { label: 'Staff', to: '/app/staff', icon: <BadgeIcon /> },
        ],
    },
];

const ROLE_LABELS = {
    admin: 'Administrator',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant Teacher',
    subject_teacher: 'Subject Teacher',
    store_manager: 'Store Manager',
};

function NavButton({ item, onClick }) {
    return (
        <ListItemButton
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={onClick}
            sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.active': {
                    bgcolor: 'primary.main',
                    color: 'common.white',
                    '& .MuiListItemIcon-root': { color: 'common.white' },
                    '&:hover': { bgcolor: 'primary.dark' },
                },
            }}
        >
            <ListItemIcon sx={{ minWidth: 40 }}>
                {item.badge === 'messages' ? (
                    <Badge color="error" badgeContent={item.unread} invisible={!item.unread}>
                        {item.icon}
                    </Badge>
                ) : (
                    item.icon
                )}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14.5 }} />
        </ListItemButton>
    );
}

export default function AppLayout() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    // Messages/Notices are dormant in v1.0 — no unread polling until they
    // return. (NavButton badge code stays intact; nothing populates it.)

    const handleLogout = () => {
        logout();
        window.location.replace('/login');
    };

    const handleSettings = () => {
        setAnchorEl(null);
        navigate('/app/settings');
    };

    const closeDrawer = () => setMobileOpen(false);

    const sections = NAV_SECTIONS
        .filter((s) => !s.adminOnly || isAdmin)
        .map((s) => ({
            ...s,
            items: s.items.filter((item) => !item.roles || item.roles.includes(user?.role)),
        }))
        .filter((s) => s.items.length > 0);

    const drawer = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Toolbar sx={{ px: 2 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: 'primary.main' }}>
                    BIS NOC
                </Typography>
            </Toolbar>
            <Divider />
            <List sx={{ px: 1, py: 1, flexGrow: 1, overflowY: 'auto' }}>
                <NavButton 
                    item={DASHBOARD_ITEM} 
                    onClick={closeDrawer}
                />
                {sections.map((section) => (
                    <Fragment key={section.label}>
                        <Typography
                            variant="overline"
                            sx={{ px: 2, pt: 2, pb: 0.5, display: 'block', color: 'text.disabled', fontSize: 11 }}
                        >
                            {section.label}
                        </Typography>
                        {section.items.map((item) => (
                            <NavButton
                                key={item.to}
                                item={item}
                                onClick={closeDrawer}
                            />
                        ))}
                    </Fragment>
                ))}
            </List>
            <Divider />
            <List sx={{ px: 1, pb: 1.5 }}>
                <ListItemButton onClick={handleSettings} sx={{ borderRadius: 2, mb: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Settings" primaryTypographyProps={{ fontSize: 14.5 }} />
                </ListItemButton>
                <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: 14.5 }} />
                </ListItemButton>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottom: '1px solid #e5e7eb',
                    zIndex: 1100,
                }}
            >
                <Toolbar>
                    <IconButton
                        edge="start"
                        onClick={() => setMobileOpen(true)}
                        sx={{ mr: 2, display: { md: 'none' } }}
                        aria-label="Open navigation"
                    >
                        <MenuIcon />
                    </IconButton>

                    <Box sx={{ flexGrow: 1 }} />

                    {/* Quick access: calendar, messages, notifications */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                        <IconButton
                            onClick={() => navigate('/app/calendar')}
                            sx={{ color: 'text.secondary' }}
                            aria-label="Calendar"
                        >
                            <EventNoteIcon />
                        </IconButton>
                        {/* Messages & Notices dormant in v1.0 — restore the two
                            IconButtons (and the unread polling) when they return. */}
                    </Box>

                    <Box sx={{ textAlign: 'right', mr: 1.5, display: { xs: 'none', sm: 'block' } }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                            {user?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {ROLE_LABELS[user?.role] || user?.role}
                        </Typography>
                    </Box>

                    <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Account menu">
                        <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15 }}>
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                    </IconButton>

                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                        <MenuItem disabled sx={{ opacity: '1 !important' }}>
                            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                        </MenuItem>
                        <MenuItem onClick={handleSettings}>Settings</MenuItem>
                        <MenuItem onClick={handleLogout}>Sign out</MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
                <Drawer
                    variant={isDesktop ? 'permanent' : 'temporary'}
                    open={isDesktop || mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: DRAWER_WIDTH,
                            boxSizing: 'border-box',
                            borderRight: '1px solid #e5e7eb',
                        },
                    }}
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* Main content area - Stacked views rendered here via Outlet */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    p: { xs: 2, sm: 3 },
                    mt: 8,
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}
