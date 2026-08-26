import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BadgeIcon from '@mui/icons-material/Badge';
import ForumIcon from '@mui/icons-material/Forum';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GradeIcon from '@mui/icons-material/Grade';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import StorefrontIcon from '@mui/icons-material/Storefront';
import FolderIcon from '@mui/icons-material/Folder';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../auth/AuthContext';
import { threadApi } from '../api/endpoints';
import { useWindowManager, getWindowIdFromRoute } from '../context/WindowManager';
import Taskbar from './Taskbar';
import Window from './Window';

// Import page components for window content
import DashboardPage from '../pages/Dashboard';
import StudentsPage from '../pages/Students';
import StaffPage from '../pages/Staff';
import TimetablePage from '../pages/Timetable';
import AttendancePage from '../pages/Attendance';
import PlanningPage from '../pages/Planning';
import ClassesPage from '../pages/Classes';
import SubjectsPage from '../pages/Subjects';
import LibraryPage from '../pages/Library';
import ClinicPage from '../pages/Clinic';
import StorePage from '../pages/Store';
import MessagesPage from '../pages/Messages';
import NoticesPage from '../pages/Notices';
import TasksPage from '../pages/Tasks';
import AssignmentsPage from '../pages/Assignments';
import CalendarPage from '../pages/Calendar';
import DataCenterPage from '../pages/DataCenter';
import SettingsPage from '../pages/Settings';
import FilesPage from '../pages/Files';
import MarksheetsPage from '../pages/Marksheets';

const DRAWER_WIDTH = 248;

const DASHBOARD_ITEM = { label: 'Dashboard', to: '/app', icon: <DashboardIcon />, end: true };

const NAV_SECTIONS = [
    {
        label: 'Academic',
        items: [
            { label: 'Tasks', to: '/app/tasks', icon: <TaskAltIcon /> },
            { label: 'Timetable', to: '/app/timetable', icon: <CalendarMonthIcon /> },
            { label: 'Planning', to: '/app/planning', icon: <MenuBookOutlinedIcon /> },
            { label: 'Attendance', to: '/app/attendance', icon: <FactCheckIcon /> },
            {
                label: 'Marksheets', to: '/app/marksheets', icon: <GradeIcon />,
                // Assistants deliberately have no marks access — editing is
                // admin/main/subject teachers, mirroring the backend rules.
                roles: ['admin', 'main_teacher', 'subject_teacher'],
            },
        ],
    },
    {
        label: 'Classroom',
        items: [
            { label: 'Students', to: '/app/students', icon: <GroupsIcon /> },
            { label: 'Classes', to: '/app/classes', icon: <ClassIcon /> },
            { label: 'Store', to: '/app/store', icon: <StorefrontIcon /> },
            { label: 'Files', to: '/app/files', icon: <FolderIcon /> },
            { label: 'Library', to: '/app/library', icon: <LocalLibraryIcon /> },
            { label: 'Clinic', to: '/app/clinic', icon: <HealthAndSafetyIcon /> },
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

// Window component registry - maps routes to page components
const WINDOW_COMPONENTS = {
    '/app': { component: DashboardPage, title: 'Dashboard', icon: DashboardIcon },
    '/app/students': { component: StudentsPage, title: 'Students', icon: GroupsIcon },
    '/app/staff': { component: StaffPage, title: 'Staff', icon: BadgeIcon },
    '/app/timetable': { component: TimetablePage, title: 'Timetable', icon: CalendarMonthIcon },
    '/app/attendance': { component: AttendancePage, title: 'Attendance', icon: FactCheckIcon },
    '/app/planning': { component: PlanningPage, title: 'Planning', icon: MenuBookOutlinedIcon },
    '/app/marksheets': { component: MarksheetsPage, title: 'Marksheets', icon: GradeIcon },
    '/app/classes': { component: ClassesPage, title: 'Classes', icon: ClassIcon },
    '/app/subjects': { component: SubjectsPage, title: 'Subjects', icon: MenuBookIcon },
    '/app/library': { component: LibraryPage, title: 'Library', icon: LocalLibraryIcon },
    '/app/clinic': { component: ClinicPage, title: 'Clinic', icon: HealthAndSafetyIcon },
    '/app/store': { component: StorePage, title: 'Store', icon: StorefrontIcon },
    '/app/files': { component: FilesPage, title: 'Files', icon: FolderIcon },
    '/app/messages': { component: MessagesPage, title: 'Messages', icon: ForumIcon },
    '/app/notices': { component: NoticesPage, title: 'Notices', icon: NotificationsIcon },
    '/app/tasks': { component: TasksPage, title: 'Tasks', icon: TaskAltIcon },
    '/app/assignments': { component: AssignmentsPage, title: 'Assignments', icon: AssignmentIndIcon },
    '/app/calendar': { component: CalendarPage, title: 'Calendar', icon: EventNoteIcon },
    '/app/data-center': { component: DataCenterPage, title: 'Data Center', icon: NotificationsIcon },
    '/app/settings': { component: SettingsPage, title: 'Settings', icon: SettingsIcon },
};

function NavButton({ item, onClick, active, windowOpen }) {
    return (
        <ListItemButton
            component={NavLink}
            to={item.to}
            end={item.end}
            onClick={onClick}
            sx={{
                borderRadius: 2,
                mb: 0.5,
                position: 'relative',
                '&.active': {
                    bgcolor: 'primary.main',
                    color: 'common.white',
                    '& .MuiListItemIcon-root': { color: 'common.white' },
                    '&:hover': { bgcolor: 'primary.dark' },
                },
                '&::before': windowOpen && !active ? {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: '60%',
                    backgroundColor: 'primary.main',
                    borderRadius: '0 2px 2px 0',
                } : null,
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
    const location = useLocation();

    const {
        windows,
        openWindow,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        focusWindow,
        updateWindowGeometry,
        setWindowSnapshot,
    } = useWindowManager();

    const [unread, setUnread] = useState(0);

    // Poll unread messages
    useEffect(() => {
        let active = true;
        const poll = async () => {
            try {
                const { count } = await threadApi.unreadCount();
                if (active) setUnread(count || 0);
            } catch { }
        };
        poll();
        const id = setInterval(poll, 60000);
        return () => { active = false; clearInterval(id); };
    }, []);

    const handleLogout = () => {
        logout();
        window.location.replace('/login');
    };

    const handleSettings = () => {
        setAnchorEl(null);
        openWindow(getWindowIdFromRoute('/app/settings'), WINDOW_COMPONENTS['/app/settings']);
    };

    const closeDrawer = () => setMobileOpen(false);

    // Handle sidebar navigation - open window instead of routing
    const handleNavClick = useCallback((item) => {
        closeDrawer();
        const windowId = getWindowIdFromRoute(item.to);
        const windowConfig = WINDOW_COMPONENTS[item.to];
        if (windowConfig) {
            openWindow(windowId, {
                title: windowConfig.title,
                icon: windowConfig.icon,
                component: windowConfig.component,
                width: 1000,
                height: 700,
            });
        } else {
            // Fallback to navigation for unknown routes
            navigate(item.to);
        }
    }, [openWindow, navigate]);

    const sections = NAV_SECTIONS
        .filter((s) => !s.adminOnly || isAdmin)
        .map((s) => ({
            ...s,
items: s.items
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => {
                const windowId = getWindowIdFromRoute(item.to);
                const windowOpen = !!windows[windowId];
                const active = location.pathname === item.to;
                return { ...item, active, windowOpen };
            }),
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
                    onClick={(e) => handleNavClick(DASHBOARD_ITEM)}
                    active={location.pathname === '/app'}
                    windowOpen={!!windows[getWindowIdFromRoute('/app')]}
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
                                onClick={(e) => handleNavClick(item)}
                                active={item.active}
                                windowOpen={item.windowOpen}
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

    // Render open windows
    const windowElements = useMemo(() => {
        return Object.entries(windows).map(([id, win]) => {
            const Component = win.component;
            if (!Component) return null;

            return (
                <Window
                    key={id}
                    id={id}
                    title={win.title}
                    icon={win.icon}
                    width={win.width}
                    height={win.height}
                    x={win.x}
                    y={win.y}
                    minimized={win.minimized}
                    maximized={win.maximized}
                    focused={win.focused}
                    zIndex={win.zIndex}
                    onClose={closeWindow}
                    onMinimize={minimizeWindow}
                    onMaximize={maximizeWindow}
                    onFocus={focusWindow}
                    onGeometryChange={updateWindowGeometry}
                    snapshot={win.snapshot}
                    onSnapshotChange={setWindowSnapshot}
                    minWidth={450}
                    minHeight={350}
                    showRefresh={true}
                    onRefresh={() => {
                        if (Component.prototype && Component.prototype.forceUpdate) {
                            // For class components
                        }
                        // Functional components handle their own refresh via key or internal state
                    }}
                >
                    <Component />
                </Window>
            );
        });
    }, [windows, closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowGeometry, setWindowSnapshot]);

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
                            onClick={() => handleNavClick({ to: '/app/calendar' })}
                            sx={{ color: 'text.secondary', '&.active': { color: 'primary.main' } }}
                            aria-label="Calendar"
                        >
                            <EventNoteIcon />
                        </IconButton>
                        <IconButton
                            onClick={() => handleNavClick({ to: '/app/messages' })}
                            sx={{ color: 'text.secondary', '&.active': { color: 'primary.main' } }}
                            aria-label="Messages"
                        >
                            <Badge color="error" badgeContent={unread} invisible={!unread}>
                                <ForumIcon />
                            </Badge>
                        </IconButton>
                        <IconButton
                            onClick={() => handleNavClick({ to: '/app/notices' })}
                            sx={{ color: 'text.secondary', '&.active': { color: 'primary.main' } }}
                            aria-label="Notifications"
                        >
                            <NotificationsIcon />
                        </IconButton>
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

            {/* Main content area - now primarily for windows */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    p: { xs: 2, sm: 3 },
                    mt: 8,
                    overflow: 'hidden',
                }}
            >
                {/* Windows rendered here */}
                {windowElements}
                
                {/* Empty state when no windows open */}
                {Object.keys(windows).length === 0 && (
                    <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        height: '100%',
                        minHeight: 400,
                        color: 'text.secondary',
                        textAlign: 'center',
                        px: 4,
                    }}>
                        <DashboardIcon sx={{ fontSize: 72, mb: 2, opacity: 0.3 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                            Welcome to BIS NOC Gerji
                        </Typography>
                        <Typography variant="body1" sx={{ maxWidth: 400, opacity: 0.7 }}>
                            Open an application from the sidebar to get started. 
                            Multiple windows can be opened, moved, resized, minimized, and maximized.
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Taskbar */}
            <Taskbar />
        </Box>
    );
}