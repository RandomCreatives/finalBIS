import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Leadership',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant',
    subject_teacher: 'Subject Teacher',
    teacher: 'Staff',
};

function initialsFromName(name?: string): string {
    if (!name) return 'BS';
    const cleaned = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/i, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'BS';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function TopBar() {
    const { user } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const iconUrl = `${import.meta.env.BASE_URL}favicon.svg`;

    return (
        <header className="glass-header safe-area-top sticky top-0 z-40">
            <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <img
                        src={iconUrl}
                        alt="BIS NOC"
                        className="w-9 h-9 rounded-xl shadow-sm shrink-0"
                    />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                                BIS NOC Gerji
                            </span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#95c11f] shrink-0" />
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {ROLE_LABELS[user?.role || ''] || 'Staff Portal'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={isDark ? 'Switch to light glass theme' : 'Switch to dark glass theme'}
                        title={isDark ? 'Light glass mode' : 'Dark glass mode'}
                        className="w-9 h-9 rounded-xl glass-subcard flex items-center justify-center text-slate-600 dark:text-slate-200 active:scale-95 transition-transform"
                    >
                        {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-700" />}
                    </button>

                    {user && (
                        <div
                            title={user.name}
                            className="h-9 px-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-white/20"
                        >
                            {initialsFromName(user.name)}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
