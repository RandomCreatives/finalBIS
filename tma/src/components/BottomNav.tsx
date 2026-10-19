import { NavLink } from 'react-router-dom';
import { Home, Calendar, File, ClipboardList, Users, MessageCircle } from 'lucide-react';

const TABS = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/timetable', label: 'Timetable', icon: Calendar },
    { to: '/attendance', label: 'Attendance', icon: File },
    { to: '/marks', label: 'Marks', icon: ClipboardList },
    { to: '/students', label: 'Students', icon: Users },
    { to: '/messages', label: 'Messages', icon: MessageCircle },
];

export default function BottomNav({ user, location }: { user: any; location: any }) {
    return (
        <nav className="nav-bar safe-area-bottom">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.to || (tab.to !== '/' && location.pathname.startsWith(tab.to));
                return (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className={({ isActive }) =>
                            `nav-item${isActive ? ' active' : ''}` + (user?.role === 'admin' ? '' : ' opacity-90')
                        }
                        end={tab.to === '/'}
                    >
                        <Icon className={`w-5 h-5 ${isActive ? '' : 'opacity-60'}`} />
                        <span className={isActive ? 'text-xs font-semibold' : 'text-[10px] opacity-70'}>
                            {tab.label}
                        </span>
                    </NavLink>
                );
            })}
        </nav>
    );
}

