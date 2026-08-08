import { Fragment, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    AppBar, Avatar, Badge, Box, Divider, Drawer, IconButton, List, ListItemButton,
    ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Typography, useMediaQuery,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Alert, Button, CircularProgress
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
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../auth/AuthContext';
import { threadApi, authApi } from '../api/endpoints';

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
        ],
    },
    {
        label: 'Classroom',
        items: [
            { label: 'Students', to: '/app/students', icon: <GroupsIcon /> },
            { label: 'Classes', to: '/app/classes', icon: <ClassIcon /> },
            { label: 'Store', to: '/app/store', icon: <StorefrontIcon /> },
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

    const { user, logout, isAdmin, updateUser } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    const [unread, setUnread] = useState(0);

    // Gmail connection states
    const [connectGmailOpen, setConnectGmailOpen] = useState(false);
    const [gmailEmail, setGmailEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verifyStep, setVerifyStep] = useState(1);
    const [modalError, setModalError] = useState('');
    const [modalSuccess, setModalSuccess] = useState('');
    const [modalSubmitting, setModalSubmitting] = useState(false);

    const handleSendCode = async (e) => {
        e.preventDefault();
        setModalError('');
        setModalSuccess('');

        if (!gmailEmail || !gmailEmail.toLowerCase().endsWith('@gmail.com')) {
            setModalError('Please enter a valid Gmail address ending in @gmail.com');
            return;
        }

        setModalSubmitting(true);
        try {
            await authApi.sendVerificationCode(gmailEmail);
            setVerifyStep(2);
            setModalSuccess('Verification code sent successfully!');
        } catch (err) {
            setModalError(err.message || 'Failed to send verification code');
        } finally {
            setModalSubmitting(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setModalError('');
        setModalSuccess('');

        if (!verificationCode) {
            setModalError('Verification code is required');
            return;
        }

        setModalSubmitting(true);
        try {
            const data = await authApi.verifyCode(verificationCode);
            updateUser(data.user);
            setModalSuccess('Gmail connected and verified successfully!');
            setTimeout(() => {
                setConnectGmailOpen(false);
                setVerifyStep(1);
                setGmailEmail('');
                setVerificationCode('');
                setModalSuccess('');
            }, 2000);
        } catch (err) {
            setModalError(err.message || 'Invalid or expired verification code');
        } finally {
            setModalSubmitting(false);
        }
    };

    // Poll the unread badge so a teacher notices an incoming message without
    // having to sit on the inbox.
    useEffect(() => {
        let active = true;

        const poll = async () => {
            try {
                const { threads } = await threadApi.unreadCount();
                if (active) setUnread(threads);
            } catch {
                /* badge is non-critical */
            }
        };

        poll();
        const id = setInterval(poll, 60000);
        return () => { active = false; clearInterval(id); };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
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
            items: s.items.map((item) =>
                item.badge === 'messages' ? { ...item, unread } : item
            ),
        }));

    const drawer = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Toolbar sx={{ px: 2 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: 'primary.main' }}>
                    BIS NOC
                </Typography>
            </Toolbar>
            <Divider />
            <List sx={{ px: 1, py: 1, flexGrow: 1, overflowY: 'auto' }}>
                <NavButton item={DASHBOARD_ITEM} onClick={closeDrawer} />
                {sections.map((section) => (
                    <Fragment key={section.label}>
                        <Typography
                            variant="overline"
                            sx={{ px: 2, pt: 2, pb: 0.5, display: 'block', color: 'text.disabled', fontSize: 11 }}
                        >
                            {section.label}
                        </Typography>
                        {section.items.map((item) => (
                            <NavButton key={item.to} item={item} onClick={closeDrawer} />
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
                            component={NavLink}
                            to="/app/calendar"
                            sx={{ color: 'text.secondary', '&.active': { color: 'primary.main' } }}
                            aria-label="Calendar"
                        >
                            <EventNoteIcon />
                        </IconButton>
                        <IconButton
                            component={NavLink}
                            to="/app/messages"
                            sx={{ color: 'text.secondary', '&.active': { color: 'primary.main' } }}
                            aria-label="Messages"
                        >
                            <Badge color="error" badgeContent={unread} invisible={!unread}>
                                <ForumIcon />
                            </Badge>
                        </IconButton>
                        <IconButton
                            component={NavLink}
                            to="/app/notices"
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

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    p: { xs: 2, sm: 3 },
                    mt: 8,
                }}
            >
                {user && !user.isEmailVerified && (
                    <Alert
                        severity="warning"
                        variant="filled"
                        sx={{
                            mb: 3,
                            borderRadius: 3,
                            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)',
                            '& .MuiAlert-message': { width: '100%' }
                        }}
                    >
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Gmail Connection Required
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: 13, opacity: 0.9 }}>
                                    You are currently using temporary default details. Please link and verify your working Gmail account to secure your portal access.
                                </Typography>
                            </Box>
                            <Button
                                color="inherit"
                                variant="outlined"
                                size="small"
                                onClick={() => setConnectGmailOpen(true)}
                                sx={{
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    px: 2.5,
                                    py: 0.5,
                                    borderRadius: 2,
                                    borderColor: 'rgba(255,255,255,0.5)',
                                    alignSelf: { xs: 'flex-start', sm: 'center' },
                                    whiteSpace: 'nowrap',
                                    '&:hover': {
                                        borderColor: '#ffffff',
                                        backgroundColor: 'rgba(255,255,255,0.08)'
                                    }
                                }}
                            >
                                Link Working Gmail
                            </Button>
                        </Box>
                    </Alert>
                )}

                <Outlet />

                {/* Dialog to connect and verify Gmail */}
                <Dialog
                    open={connectGmailOpen}
                    onClose={() => !modalSubmitting && setConnectGmailOpen(false)}
                    maxWidth="xs"
                    fullWidth
                    PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
                >
                    <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
                        Connect Working Gmail
                    </DialogTitle>

                    <DialogContent>
                        <DialogContentText sx={{ mb: 3, fontSize: 14 }}>
                            Enter your official school Gmail address. We will email you a one-time verification code to confirm ownership.
                        </DialogContentText>

                        {modalError && (
                            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                {modalError}
                            </Alert>
                        )}

                        {modalSuccess && (
                            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                                {modalSuccess}
                            </Alert>
                        )}

                        {verifyStep === 1 ? (
                            <Box component="form" onSubmit={handleSendCode}>
                                <TextField
                                    fullWidth
                                    label="Gmail Address"
                                    placeholder="your.name@gmail.com"
                                    value={gmailEmail}
                                    onChange={(e) => setGmailEmail(e.target.value)}
                                    variant="outlined"
                                    type="email"
                                    required
                                    disabled={modalSubmitting}
                                    sx={{ mb: 2 }}
                                />
                                <DialogActions sx={{ px: 0, pt: 1 }}>
                                    <Button
                                        onClick={() => setConnectGmailOpen(false)}
                                        disabled={modalSubmitting}
                                        variant="text"
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        disabled={modalSubmitting || !gmailEmail}
                                        sx={{ textTransform: 'none', px: 3 }}
                                    >
                                        {modalSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Send Code'}
                                    </Button>
                                </DialogActions>
                            </Box>
                        ) : (
                            <Box component="form" onSubmit={handleVerifyCode}>
                                <TextField
                                    fullWidth
                                    label="6-Digit Verification Code"
                                    placeholder="Enter code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    variant="outlined"
                                    required
                                    disabled={modalSubmitting}
                                    helperText="Codes expire after 10 minutes."
                                    sx={{ mb: 2 }}
                                />
                                <DialogActions sx={{ px: 0, pt: 1 }}>
                                    <Button
                                        onClick={() => setVerifyStep(1)}
                                        disabled={modalSubmitting}
                                        variant="text"
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        disabled={modalSubmitting || !verificationCode}
                                        sx={{ textTransform: 'none', px: 3 }}
                                    >
                                        {modalSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Verify & Connect'}
                                    </Button>
                                </DialogActions>
                            </Box>
                        )}
                    </DialogContent>
                </Dialog>
            </Box>
        </Box>
    );
}
