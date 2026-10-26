import { NavLink } from 'react-router-dom';
import { Home, Calendar, CheckSquare, ClipboardList, Users } from 'lucide-react';

const TABS = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/timetable', label: 'Timetable', icon: Calendar },
    { to: '/attendance', label: 'Attendance', icon: CheckSquare },
    { to: '/marks', label: 'Marks', icon: ClipboardList },
    { to: '/students', label: 'Students', icon: Users },
];

export default function BottomNav({ location }: { user?: unknown; location: { pathname: string } }) {
    return (
        <nav className="nav-dock" aria-label="Primary navigation">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive =
                    location.pathname === tab.to ||
                    (tab.to !== '/' && location.pathname.startsWith(tab.to));

                return (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        end={tab.to === '/'}
                        className={`nav-dock-item${isActive ? ' active' : ''}`}
                    >
                        <Icon className={`w-[19px] h-[19px] transition-transform ${isActive ? 'scale-105 stroke-[2.3]' : 'opacity-75'}`} />
                        <span className="leading-none tracking-tight">{tab.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
