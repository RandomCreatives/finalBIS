import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, MapPin } from 'lucide-react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { api } from '../api/api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
type DayFilter = (typeof DAYS)[number] | 'All';

function currentAddisDay(): DayFilter {
    try {
        const short = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Addis_Ababa',
            weekday: 'short',
        }).format(new Date());
        if ((DAYS as readonly string[]).includes(short)) {
            return short as (typeof DAYS)[number];
        }
    } catch {
        // ignore
    }
    return 'All';
}

export default function Timetable() {
    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState<any[]>([]);
    const [error, setError] = useState('');
    const todayDay = useMemo(() => currentAddisDay(), []);
    const [selectedDay, setSelectedDay] = useState<DayFilter>(todayDay);

    useEffect(() => {
        api.get('/timetable/my-week')
            .then((data) => setSlots(data.slots || []))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load timetable'))
            .finally(() => setLoading(false));
    }, []);

    const byDay = useMemo(() => {
        const map: Record<string, any[]> = {};
        DAYS.forEach((d) => {
            map[d] = [];
        });
        (slots || []).forEach((s) => {
            const day = DAYS[(s.dayOfWeek ?? s.day_of_week ?? 0) - 1];
            if (day && map[day]) map[day].push(s);
        });
        DAYS.forEach((d) => {
            map[d].sort((a, b) => String(a.startsAt ?? '').localeCompare(String(b.startsAt ?? '')));
        });
        return map;
    }, [slots]);

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-12 rounded-2xl glass-panel animate-pulse" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-2xl glass-panel animate-pulse" />
                ))}
            </div>
        );
    }

    const visibleDays = selectedDay === 'All' ? DAYS : [selectedDay];

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Timetable
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {slots.length} weekly {slots.length === 1 ? 'period' : 'periods'} scheduled
                    </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full glass-subcard text-blue-600 dark:text-blue-300">
                    This week
                </span>
            </div>

            {/* Day Filter Bar */}
            <div className="grid grid-cols-6 gap-1 p-1 rounded-2xl glass-panel">
                {([...DAYS, 'All'] as DayFilter[]).map((day) => {
                    const active = selectedDay === day;
                    const isToday = day !== 'All' && day === todayDay;
                    const count = day === 'All' ? slots.length : byDay[day]?.length ?? 0;

                    return (
                        <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            className={`relative py-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center ${
                                active
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <span>{day}</span>
                            <span className={`text-[10px] ${active ? 'text-blue-100' : 'opacity-60'}`}>
                                {count}
                            </span>
                            {isToday && !active && (
                                <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[#95c11f]" />
                            )}
                        </button>
                    );
                })}
            </div>

            {error && (
                <GlassCard className="flex items-center gap-2 border-rose-500/30">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</span>
                </GlassCard>
            )}

            {visibleDays.map((day) => {
                const daySlots = byDay[day] || [];
                return (
                    <GlassCard key={day}>
                        <SectionTitle
                            right={
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                    {daySlots.length} {daySlots.length === 1 ? 'lesson' : 'lessons'}
                                </span>
                            }
                        >
                            {day === todayDay ? `${day} · Today` : day}
                        </SectionTitle>

                        {daySlots.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
                                No scheduled lessons on {day}.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {daySlots.map((slot: any) => {
                                    const start = String(slot.startsAt ?? '').slice(0, 5);
                                    const end = String(slot.endsAt ?? '').slice(0, 5);
                                    return (
                                        <div
                                            key={slot.id}
                                            className="p-3 glass-subcard flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                    {slot.subject?.name || 'Lesson'}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                    <span className="font-medium text-blue-600 dark:text-blue-300">
                                                        {slot.class?.name || 'Class'}
                                                    </span>
                                                    {slot.room && (
                                                        <span className="inline-flex items-center gap-0.5">
                                                            <MapPin className="w-3 h-3 opacity-75" />
                                                            {slot.room}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right px-2.5 py-1.5 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200">
                                                <div className="flex items-center gap-1 text-xs font-bold">
                                                    <Clock className="w-3 h-3 opacity-80" />
                                                    <span>{start || '—'}</span>
                                                </div>
                                                {end && (
                                                    <p className="text-[10px] opacity-75 mt-0.5">{end}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>
                );
            })}
        </div>
    );
}
