import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/api';
import { Calendar, MessageCircle } from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        api.get('/dashboard/me')
            .then((data) => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="p-4">
                <div className="h-10 w-24 rounded-lg bg-blue-100 animate-pulse mb-2" />
                <div className="h-8 w-48 rounded-lg bg-blue-100 animate-pulse" />
            </div>
        );
    }

    const myClasses = stats?.homerooms || [];
    const todaySlots = stats?.todaySlots || [];
    const openTasks = stats?.openTasks || [];
    const unreadMessages = stats?.unreadMessages || 0;

    return (
        <div className="p-4 safe-area-bottom">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold">Dashboard</h1>
                    <p className="text-xs text-blue-600">{user?.name} · {user?.role.replace('_', ' ')}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                </div>
            </div>

            <GlassCard className="mb-4">
                <SectionTitle>Today</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/40 rounded-xl border border-white/40">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <span className="text-xs text-blue-900/70">Today</span>
                        </div>
                        <p className="text-sm font-bold mt-1">{todaySlots.length} lesson{todaySlots.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="p-3 bg-white/40 rounded-xl border border-white/40">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 text-emerald-600" />
                            <span className="text-xs text-blue-900/70">Registers due</span>
                        </div>
                        <p className="text-sm font-bold mt-1">{myClasses.length}</p>
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="mb-4">
                <SectionTitle>Your timetable today</SectionTitle>
                {todaySlots.length === 0 ? (
                    <p className="text-xs text-blue-500">No lessons scheduled today.</p>
                ) : (
                    <div className="space-y-2">
                        {todaySlots.map((slot: any) => (
                            <div key={slot.id} className="flex items-center justify-between p-2 bg-white/40 rounded-lg border border-white/40 text-sm">
                                <div>
                                    <span className="font-semibold">{slot.subject?.name || 'Lesson'}</span>
                                    <p className="text-[10px] text-blue-500">{slot.class?.name || 'Class'} · {slot.starts_at.slice(0, 5)}–{slot.ends_at.slice(0, 5)}</p>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <GlassCard className="mb-4">
                <div className="flex items-center justify-between mb-3">
                    <SectionTitle>Open tasks</SectionTitle>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">{openTasks.length}</span>
                </div>
                {openTasks.length === 0 ? (
                    <p className="text-xs text-blue-500">No open tasks.</p>
                ) : (
                    <div className="space-y-2">
                        {openTasks.map((t: any) => (
                            <div key={t.id} className="flex items-center justify-between p-2 bg-white/30 rounded-lg text-sm">
                                <span className="font-semibold">{t.title}</span>
                                <span className="text-[10px] text-blue-500">{t.due_on || 'No due date'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            {unreadMessages > 0 && (
                <div className="flex justify-center">
                    <button className="btn-ghost w-full max-w-xs">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {unreadMessages} unread
                    </button>
                </div>
            )}
        </div>
    );
}

