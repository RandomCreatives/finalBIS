import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    ArrowRight,
    Calendar,
    CheckCircle2,
    CheckSquare,
    ClipboardList,
    Sparkles,
    Users,
} from 'lucide-react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/api';

interface Flow {
    id: string;
    title: string;
    metric: string;
    detail?: string;
    progress: number;
    nextAction?: string;
}

interface MySummary {
    role?: string;
    date?: string;
    term?: { name: string; currentWeek?: number } | null;
    healthScore?: number;
    openItems?: number;
    flows?: Flow[];
}

function addisGreeting(): string {
    try {
        const hour = Number(
            new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Africa/Addis_Ababa',
                hour: 'numeric',
                hour12: false,
            }).format(new Date()),
        );
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    } catch {
        return 'Welcome back';
    }
}

function routeForFlow(flow: Flow): string | null {
    const key = `${flow.id} ${flow.title}`.toLowerCase();
    if (key.includes('attend') || key.includes('register')) return '/attendance';
    if (key.includes('timetable') || key.includes('lesson') || key.includes('schedule')) return '/timetable';
    if (key.includes('mark') || key.includes('grade') || key.includes('assess')) return '/marks';
    if (key.includes('student') || key.includes('pupil') || key.includes('roster')) return '/students';
    return null;
}

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MySummary | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/dashboard/me')
            .then((data: MySummary) => setStats(data))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your dashboard'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-28 rounded-2xl glass-panel animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-24 rounded-2xl glass-panel animate-pulse" />
                    <div className="h-24 rounded-2xl glass-panel animate-pulse" />
                </div>
                <div className="h-40 rounded-2xl glass-panel animate-pulse" />
            </div>
        );
    }

    const flows = stats?.flows ?? [];
    const health = Math.max(0, Math.min(100, stats?.healthScore ?? 0));
    const openItems = stats?.openItems ?? 0;

    return (
        <div className="p-4 space-y-4">
            {/* Hero Greeting Card */}
            <GlassCard className="relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            {addisGreeting()}
                        </p>
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
                            {user?.name || 'BIS Staff'}
                        </h1>
                        {(stats?.date || stats?.term?.name) && (
                            <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 glass-subcard px-2.5 py-1 rounded-full">
                                {stats?.date && <span>{stats.date}</span>}
                                {stats?.term?.name && (
                                    <>
                                        <span className="opacity-40">·</span>
                                        <span>{stats.term.name}</span>
                                    </>
                                )}
                                {stats?.term?.currentWeek ? (
                                    <>
                                        <span className="opacity-40">·</span>
                                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                            Week {stats.term.currentWeek}
                                        </span>
                                    </>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>

                {/* Metric Tiles */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3.5 glass-subcard">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Open items</span>
                            <CheckCircle2
                                className={`w-4 h-4 ${
                                    openItems === 0 ? 'text-emerald-500' : 'text-amber-500'
                                }`}
                            />
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                            {openItems}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {openItems === 0 ? 'All caught up today' : 'Awaiting completion'}
                        </p>
                    </div>

                    <div className="p-3.5 glass-subcard">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Readiness</span>
                            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                            {health}%
                        </p>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-[#95c11f] transition-all duration-500"
                                style={{ width: `${health}%` }}
                            />
                        </div>
                    </div>
                </div>
            </GlassCard>

            {error && (
                <GlassCard className="border-rose-500/30">
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>
                </GlassCard>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2.5">
                {[
                    { to: '/attendance', label: 'Register', icon: CheckSquare, tone: 'text-emerald-600 dark:text-emerald-400' },
                    { to: '/timetable', label: 'Timetable', icon: Calendar, tone: 'text-blue-600 dark:text-blue-400' },
                    { to: '/students', label: 'Pupils', icon: Users, tone: 'text-indigo-600 dark:text-indigo-400' },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.to}
                            type="button"
                            onClick={() => navigate(item.to)}
                            className="glass-panel p-3 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform"
                        >
                            <Icon className={`w-5 h-5 ${item.tone}`} />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Priority Flows */}
            <GlassCard>
                <SectionTitle
                    right={
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {flows.length} {flows.length === 1 ? 'area' : 'areas'}
                        </span>
                    }
                >
                    What needs you
                </SectionTitle>

                {flows.length === 0 ? (
                    <div className="py-5 text-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Nothing outstanding right now.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {flows.map((flow) => {
                            const target = routeForFlow(flow);
                            const pct = Math.max(0, Math.min(100, flow.progress ?? 0));
                            return (
                                <div
                                    key={flow.id}
                                    onClick={target ? () => navigate(target) : undefined}
                                    role={target ? 'button' : undefined}
                                    tabIndex={target ? 0 : undefined}
                                    className={`p-3 glass-subcard transition-transform ${
                                        target ? 'cursor-pointer active:scale-[0.99]' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                            {flow.title}
                                        </span>
                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-300 whitespace-nowrap">
                                            <span>{flow.metric}</span>
                                            {target && <ArrowRight className="w-3.5 h-3.5 opacity-75" />}
                                        </div>
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                pct >= 100
                                                    ? 'bg-emerald-500'
                                                    : 'bg-gradient-to-r from-blue-600 to-sky-400'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    {flow.nextAction && (
                                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                            {flow.nextAction}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <ClipboardList className="w-3.5 h-3.5 opacity-75" />
                <span>Full marksheet spreadsheets &amp; exports remain on the web portal.</span>
            </div>
        </div>
    );
}
