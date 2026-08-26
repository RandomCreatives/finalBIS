import { useState, useRef, useEffect, useMemo } from 'react';
import {
    Box, Button, IconButton, Tooltip, Typography, Paper, Divider,
    List, ListItem, ListItemIcon, ListItemText, Badge, styled,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useWindowManager } from '../context/WindowManager';

/* ── Styled components ───────────────────────────────────── */
const TaskbarRoot = styled(Box)(({ theme }) => ({
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: alpha(theme.palette.background.paper, 0.95),
    backdropFilter: 'blur(12px)',
    borderTop: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    zIndex: 2000,
    padding: '0 8px',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
}));

const TaskbarButton = styled(Button)(({ theme, $active }) => ({
    minWidth: 40,
    maxWidth: 200,
    height: 36,
    padding: '0 12px',
    borderRadius: 2,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: 13,
    color: $active ? theme.palette.primary.main : theme.palette.text.primary,
    backgroundColor: $active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
    border: $active ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}` : 'none',
    boxShadow: $active ? `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'all 0.15s',
    '&:hover': {
        backgroundColor: $active 
            ? alpha(theme.palette.primary.main, 0.18) 
            : alpha(theme.palette.action.hover, 0.5),
    },
    '& .MuiListItemIcon-root': { minWidth: 32 },
}));

const StartButton = styled(Button)(({ theme }) => ({
    width: 48,
    height: 48,
    borderRadius: '50%',
    padding: 0,
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    boxShadow: theme.shadows[3],
    transition: 'transform 0.1s, box-shadow 0.1s',
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
        boxShadow: theme.shadows[4],
        transform: 'scale(1.05)',
    },
    '&:active': { transform: 'scale(0.98)' },
}));

const QuickActionButton = styled(IconButton)(({ theme }) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    color: theme.palette.text.secondary,
    transition: 'all 0.15s',
    '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.1),
        color: theme.palette.primary.main,
    },
}));

function alpha(color, opacity) {
    return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}

/* ── Taskbar Component ───────────────────────────────────── */
export function Taskbar() {
    const { 
        windows, 
        activeWindowId, 
        taskbarOrder, 
        minimizeWindow, 
        focusWindow 
    } = useWindowManager();
    const navigate = useNavigate();
    const [showStartMenu, setShowStartMenu] = useState(false);
    const startButtonRef = useRef(null);
    const [clock, setClock] = useState(new Date());

    // Update clock
    useEffect(() => {
        const interval = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Close start menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showStartMenu && startButtonRef.current && !startButtonRef.current.contains(e.target)) {
                setShowStartMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showStartMenu]);

    // Get windows in taskbar order (most recent first for display)
    const orderedWindows = useMemo(() => {
        return taskbarOrder
            .map(id => windows[id])
            .filter(Boolean)
            .reverse(); // Most recent first
    }, [windows, taskbarOrder]);

    const handleTaskbarClick = (windowId) => {
        const win = windows[windowId];
        if (!win) return;
        
        if (win.minimized) {
            focusWindow(windowId);
        } else if (activeWindowId === windowId) {
            minimizeWindow(windowId);
        } else {
            focusWindow(windowId);
        }
    };

    const handleStartMenuItemClick = (path) => {
        navigate(path);
        setShowStartMenu(false);
    };

    // Quick actions for start menu
    const quickActions = [
        { label: 'Dashboard', path: '/app', icon: '📊' },
        { label: 'Students', path: '/app/students', icon: '👥' },
        { label: 'Staff', path: '/app/staff', icon: '👤' },
        { label: 'Timetable', path: '/app/timetable', icon: '📅' },
        { label: 'Attendance', path: '/app/attendance', icon: '✅' },
        { label: 'Planning', path: '/app/planning', icon: '📝' },
        { label: 'Library', path: '/app/library', icon: '📚' },
        { label: 'Clinic', path: '/app/clinic', icon: '🏥' },
        { label: 'Store', path: '/app/store', icon: '🏪' },
        { label: 'Messages', path: '/app/messages', icon: '💬' },
        { label: 'Calendar', path: '/app/calendar', icon: '📆' },
        { label: 'Notices', path: '/app/notices', icon: '📢' },
        { label: 'Tasks', path: '/app/tasks', icon: '✓' },
        { label: 'Classes', path: '/app/classes', icon: '🏫' },
        { label: 'Subjects', path: '/app/subjects', icon: '📖' },
        { label: 'Settings', path: '/app/settings', icon: '⚙️' },
    ];

    return (
        <>
            {/* Taskbar */}
            <TaskbarRoot role="toolbar" aria-label="Window taskbar">
                {/* Start Button */}
                <Tooltip title="Start Menu">
                    <StartButton
                        ref={startButtonRef}
                        onClick={() => setShowStartMenu(!showStartMenu)}
                        aria-label="Open Start Menu"
                        aria-expanded={showStartMenu}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1 }}>
                            B
                        </Typography>
                    </StartButton>
                </Tooltip>

                {/* Running Applications */}
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', px: 4 }}>
                    {orderedWindows.length === 0 ? (
                        <Typography variant="caption" color="text.disabled" sx={{ px: 2 }}>
                            No open windows
                        </Typography>
                    ) : (
                        orderedWindows.map((win) => (
                            <Tooltip key={win.id} title={win.title}>
                                <TaskbarButton
                                    $active={activeWindowId === win.id && !win.minimized}
                                    onClick={() => handleTaskbarClick(win.id)}
                                    onContextMenu={(e) => { e.preventDefault(); focusWindow(win.id); }}
                                    startIcon={win.icon ? <win.icon sx={{ fontSize: 18 }} /> : null}
                                    endIcon={win.minimized && (
                                        <Badge badgeContent="●" color="warning" sx={{ '& .MuiBadge-badge': { fontSize: 8, top: -2, right: -2 } }} />
                                    )}
                                >
                                    {win.title}
                                </TaskbarButton>
                            </Tooltip>
                        ))
                    )}
                </Box>

                {/* System Tray - Quick Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pr: 2 }}>
                    {/* Show Desktop */}
                    <Tooltip title="Show Desktop (Win+D)">
                        <QuickActionButton onClick={() => {
                            Object.keys(windows).forEach(id => minimizeWindow(id));
                        }} aria-label="Show Desktop">
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>💻</Typography>
                        </QuickActionButton>
                    </Tooltip>

                    <Divider orientation="vertical" sx={{ mr: 2, height: 24 }} />

                    {/* Notifications */}
                    <Tooltip title="Notifications">
                        <QuickActionButton aria-label="Notifications">
                            <Typography variant="h6">🔔</Typography>
                        </QuickActionButton>
                    </Tooltip>

                    {/* Clock */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 4, minWidth: 80 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontVariant: 'tabular-nums', lineHeight: 1.2 }}>
                            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontVariant: 'tabular-nums', lineHeight: 1 }}>
                            {clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Typography>
                    </Box>
                </Box>
            </TaskbarRoot>

            {/* Start Menu */}
            {showStartMenu && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 56,
                        left: 8,
                        zIndex: 2100,
                    }}
                >
                    <Paper elevation={8} sx={{ width: 320, minHeight: 400, maxHeight: 'calc(100vh - 100px)', overflow: 'auto', borderRadius: 3 }}>
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>BIS NOC Gerji</Typography>
                            <Typography variant="caption" color="text.secondary">School Management System</Typography>
                        </Box>
                        <List dense sx={{ py: 1 }}>
                            {quickActions.map((action) => (
                                <ListItem
                                    key={action.path}
                                    button
                                    onClick={() => handleStartMenuItemClick(action.path)}
                                    sx={{ borderRadius: 2, mx: 1, my: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40, fontSize: 22 }}>
                                        {action.icon}
                                    </ListItemIcon>
                                    <ListItemText primary={action.label} primaryTypographyProps={{ fontWeight: 500 }} />
                                </ListItem>
                            ))}
                        </List>
                        <Divider />
                        <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                            <Button variant="outlined" size="small" onClick={() => navigate('/app/settings')}>
                                Settings
                            </Button>
                            <Button variant="contained" size="small" onClick={() => navigate('/login', { replace: true })}>
                                Sign Out
                            </Button>
                        </Box>
                    </Paper>
                </Box>
            )}
        </>
    );
}

export default Taskbar;