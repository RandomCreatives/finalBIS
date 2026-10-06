import { Box, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import GroupsIcon from '@mui/icons-material/Groups';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

const ITEMS = [
    { label: 'Home', to: '/app', end: true, icon: <HomeIcon /> },
    { label: 'Students', to: '/app/students', icon: <GroupsIcon /> },
    { label: 'Attendance', to: '/app/attendance', icon: <FactCheckIcon /> },
    { label: 'Timetable', to: '/app/timetable', icon: <CalendarMonthIcon /> },
];

export default function PwaBottomNav() {
    const location = useLocation();
    const [standalone, setStandalone] = useState(false);

    useEffect(() => {
        const media = window.matchMedia?.('(display-mode: standalone)');
        const update = () => setStandalone(Boolean(media?.matches || window.navigator.standalone === true));
        update();
        media?.addEventListener?.('change', update);
        return () => media?.removeEventListener?.('change', update);
    }, []);

    if (!standalone) return null;

    return (
        <Box
            component="nav"
            aria-label="PWA app navigation"
            sx={{
                display: { xs: 'flex', md: 'none' },
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
                pb: 'env(safe-area-inset-bottom)',
                bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider',
                boxShadow: '0 -8px 24px rgba(15,23,42,.08)',
            }}
        >
            {ITEMS.map((item) => {
                const active = item.end
                    ? location.pathname === item.to
                    : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                return (
                    <Button
                        key={item.to}
                        component={NavLink}
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        sx={{
                            flex: 1, minWidth: 0, minHeight: 62, borderRadius: 0,
                            px: 0.5, py: 0.75, gap: 0.25, flexDirection: 'column',
                            textTransform: 'none', fontSize: 11, fontWeight: active ? 800 : 600,
                            color: active ? 'primary.main' : 'text.secondary',
                            '& .MuiSvgIcon-root': { fontSize: 22 },
                        }}
                    >
                        {item.icon}
                        {item.label}
                    </Button>
                );
            })}
        </Box>
    );
}
