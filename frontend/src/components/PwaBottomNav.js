import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GradeIcon from '@mui/icons-material/Grade';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { useAuth } from '../auth/AuthContext';
import { isStandaloneApp } from '../utils/pwaInstall';

/**
 * Mobile bottom navigation shown ONLY when running as an installed PWA
 * (`display-mode: standalone`) on small screens. Browser tabs keep the
 * sidebar drawer cleanly.
 */
export default function PwaBottomNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    if (!isStandaloneApp()) return null;

    const thirdTab = user?.role === 'subject_teacher'
        ? { label: 'Marksheets', path: '/app/marksheets', icon: GradeIcon }
        : { label: 'Attendance', path: '/app/attendance', icon: FactCheckIcon };

    const items = [
        { label: 'Home', path: '/app', icon: DashboardIcon },
        { label: 'Students', path: '/app/students', icon: SchoolIcon },
        thirdTab,
        { label: 'Timetable', path: '/app/timetable', icon: ScheduleIcon },
    ];

    const current = items.findIndex((item) =>
        item.path === '/app'
            ? location.pathname === '/app' || location.pathname === '/app/'
            : location.pathname.startsWith(item.path)
    );

    return (
        <Paper
            elevation={8}
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: (t) => t.zIndex.appBar,
                display: { xs: 'block', md: 'none' },
                borderTop: (t) => `1px solid ${t.palette.divider}`,
                pb: 'env(safe-area-inset-bottom)',
            }}
        >
            <BottomNavigation
                showLabels
                value={current === -1 ? false : current}
                onChange={(_, idx) => navigate(items[idx].path)}
            >
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <BottomNavigationAction
                            key={item.path}
                            label={item.label}
                            icon={<Icon />}
                        />
                    );
                })}
            </BottomNavigation>
        </Paper>
    );
}
