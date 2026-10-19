import { useEffect, useState } from 'react';
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

export default function Dashboard() {
    const { user } = useAuth();
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
            <div className="p-4">
                <div className="h-10 w-24 rounded-lg bg-blue-100 animate-pulse mb-2" />
                <div className="h-8 w-48 rounded-lg bg-blue-100 animate-pulse" />
            </div>
        );
    }

    const flows = stats?.flows ?? [];

    return (
        <div className="p-4 safe-area-bottom">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold">Dashboard</h1>
                    <p className="text-xs text-blue-600">
                        {user?.name}
                        {user?.role ? ` · ${user.role.replace(/_/g, ' ')}` : ''}
                    </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                </div>
            </div>

            {error && (
                <GlassCard className="mb-4">
                    <p className="text-sm text-rose-700">{error}</p>
                </GlassCard>
            )}

            <GlassCard className="mb-4">
                <SectionTitle>Today</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/40 rounded-xl border border-white/40">
                        <span className="text-xs text-blue-900/70">Open items</span>
                        <p className="text-xl font-bold mt-1">{stats?.openItems ?? 0}</p>
                    </div>
                    <div className="p-3 bg-white/40 rounded-xl border border-white/40">
                        <span className="text-xs text-blue-900/70">Health</span>
                        <p className="text-xl font-bold mt-1">{stats?.healthScore ?? 0}%</p>
                    </div>
                </div>
                {(stats?.date || stats?.term) && (
                    <p className="mt-3 text-[11px] text-blue-500">
                        {stats?.date}
                        {stats?.term?.name ? ` · ${stats.term.name}` : ''}
                        {stats?.term?.currentWeek ? ` · week ${stats.term.currentWeek}` : ''}
                    </p>
                )}
            </GlassCard>

            <GlassCard className="mb-4">
                <SectionTitle>What needs you</SectionTitle>
                {flows.length === 0 ? (
                    <p className="text-xs text-blue-500">Nothing outstanding. 🎉</p>
                ) : (
                    <div className="space-y-2">
                        {flows.map((flow) => (
                            <div key={flow.id} className="p-2 bg-white/40 rounded-lg border border-white/40">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-sm">{flow.title}</span>
                                    <span className="text-[10px] text-blue-600 font-semibold whitespace-nowrap">
                                        {flow.metric}
                                    </span>
                                </div>
                                <div className="mt-2 h-1.5 rounded-full bg-blue-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-blue-600"
                                        style={{ width: `${Math.max(0, Math.min(100, flow.progress ?? 0))}%` }}
                                    />
                                </div>
                                {flow.nextAction && (
                                    <p className="mt-1.5 text-[10px] text-blue-500">{flow.nextAction}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <p className="text-center text-[10px] text-blue-400">
                Full marksheets and reports are on the website.
            </p>
        </div>
    );
}
