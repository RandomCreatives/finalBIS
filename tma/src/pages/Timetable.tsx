import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { api } from '../api/api';
import { AlertCircle } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function Timetable() {
    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/timetable/my-week')
            .then((data) => setSlots(data.slots || []))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load timetable'))
            .finally(() => setLoading(false));
    }, []);

    const byDay: Record<string, any[]> = {};
    DAYS.forEach((d) => (byDay[d] = []));
    (slots || []).forEach((s) => {
        const day = DAYS[s.day_of_week - 1] || String(s.day_of_week);
        if (byDay[day]) byDay[day].push(s);
    });

    if (loading) {
        return <div className="p-4 space-y-3">{[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-blue-100 animate-pulse" />
        ))}</div>;
    }

    if (error) {
        return (
            <div className="p-4">
                <GlassCard>
                    <AlertCircle className="w-5 h-5 text-rose-600 mr-2" />
                    <span className="text-sm text-rose-700">{error}</span>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="p-4 safe-area-bottom">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold">Timetable</h1>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">This week</span>
            </div>

            {DAYS.map((day) => {
                const daySlots = byDay[day].sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at));
                return (
                    <GlassCard key={day} className="mb-3">
                        <div className="flex items-center justify-between pb-2 border-b border-white/40 mb-2">
                            <SectionTitle>{day}</SectionTitle>
                            <span className="text-[10px] text-blue-500">{daySlots.length}</span>
                        </div>
                        {daySlots.length === 0 ? (
                            <p className="text-xs text-blue-400 px-2">No lessons</p>
                        ) : (
                            <div className="space-y-2">
                                {daySlots.map((slot: any) => (
                                    <div key={slot.id} className="flex items-center justify-between p-2 bg-white/40 rounded-lg border border-white/40 text-sm">
                                        <div className="flex-1 min-w-0">
                                            <span className="font-semibold block">{slot.subject?.name || 'Lesson'}</span>
                                            <p className="text-[10px] text-blue-500 truncate">
                                                {slot.class?.name || 'Class'} · {slot.room || ''}
                                            </p>
                                        </div>
                                        <div className="text-right text-[10px] font-semibold text-blue-600">
                                            {slot.starts_at.slice(0, 5)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GlassCard>
                );
            })}
            </div>
        );
}

