import { useEffect, useState } from 'react';
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
import CampaignIcon from '@mui/icons-material/Campaign';
import BadgeIcon from '@mui/icons-material/Badge';
import ForumIcon from '@mui/icons-material/Forum';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../auth/AuthContext';
import { threadApi, authApi } from '../api/endpoints';

const DRAWER_WIDTH = 248;

const NAV_ITEMS = [
    { label: 'Dashboard', to: '/app', icon: <DashboardIcon />, end: true },
    { label: 'Messages', to: '/app/messages', icon: <ForumIcon />, badge: 'messages' },
    { label: 'Tasks', to: '/app/tasks', icon: <TaskAltIcon /> },
    { label: 'Settings', to: '/app/settings', icon: <SettingsIcon /> },
    { divider: true, label: 'School' },
    { label: 'Students', to: '/app/students', icon: <GroupsIcon /> },
    { label: 'Classes', to: '/app/classes', icon: <ClassIcon /> },
    { label: 'Calendar', to: '/app/calendar', icon: <EventNoteIcon /> },
    { label: 'Timetable', to: '/app/timetable', icon: <CalendarMonthIcon /> },
    { label: 'Planning', to: '/app/planning', icon: <MenuBookOutlinedIcon /> },
    { label: 'Attendance', to: '/app/attendance', icon: <FactCheckIcon /> },
    { label: 'Library', to: '/app/library', icon: <LocalLibraryIcon /> },
    { label: 'Clinic', to: '/app/clinic', icon: <HealthAndSafetyIcon /> },
    { label: 'Notices', to: '/app/notices', icon: <CampaignIcon /> },
    { divider: true, label: 'Administration', adminOnly: true },
    { label: 'Assignments', to: '/app/assignments', icon: <AssignmentIndIcon />, adminOnly: true },
    { label: 'Subjects', to: '/app/subjects', icon: <MenuBookIcon />, adminOnly: true },
    { label: 'Staff', to: '/app/staff', icon: <BadgeIcon />, adminOnly: true },
];

const ROLE_LABELS = {
    admin: 'Administrator',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant Teacher',
    subject_teacher: 'Subject Teacher',
};

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
    const [sentCode, setSentCode] = useState('');
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
            const data = await authApi.sendVerificationCode(gmailEmail);
            setVerifyStep(2);
            setModalSuccess('Verification code sent successfully!');
            if (data.code) {
                setSentCode(data.code);
            }
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
                // Reset state
                setVerifyStep(1);
                setGmailEmail('');
                setVerificationCode('');
                setSentCode('');
                setModalSuccess('');
            }, 2000);
        } catch (err) {
            setModalError(err.message || 'Invalid or expired verification code');
        } finally {
            setModalSubmitting(false);
        }
    };

    const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

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

    const drawer = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Toolbar sx={{ px: 2 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: 'primary.main' }}>
                    BIS NOC
                </Typography>
            </Toolbar>
            <Divider />
            <List sx={{ px: 1, py: 1.5, flexGrow: 1 }}>
                {items.map((item, index) =>
                    item.divider ? (
                        <Typography
                            key={`section-${index}`}
                            variant="overline"
                            sx={{ px: 2, pt: 2, pb: 0.5, display: 'block', color: 'text.disabled', fontSize: 11 }}
                        >
                            {item.label}
                        </Typography>
                    ) : (
                        <ListItemButton
                            key={item.to}
                            component={NavLink}
                            to={item.to}
                            end={item.end}
                            onClick={() => setMobileOpen(false)}
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
                                    <Badge color="error" badgeContent={unread} invisible={!unread}>
                                        {item.icon}
                                    </Badge>
                                ) : (
                                    item.icon
                                )}
                            </ListItemIcon>
                            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14.5 }} />
                        </ListItemButton>
                    )
                )}
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
                        <Divider />
                        <MenuItem onClick={handleSettings}>
                            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                            Settings
                        </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                            Sign out
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
                            Enter your official school Google / Gmail address. We will send you a mock verification code to verify ownership.
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
                                    helperText={sentCode ? `Tip: For testing, enter the mock code ${sentCode} or use standard bypass 123456` : 'Enter the code sent to your email.'}
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
