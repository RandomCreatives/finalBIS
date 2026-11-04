import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    BookOpen,
    Calendar,
    CheckCircle2,
    CheckSquare,
    ClipboardList,
    Clock,
    ExternalLink,
    Globe,
    MessageSquare,
    Sparkles,
    Users,
} from 'lucide-react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { useAuth } from '../auth/AuthContext';
import { openWebPortal } from '../auth/auth';
import { api } from '../api/api';
import { todayIso } from '../lib/date';

interface TeachingSubject {
    id: string;
    sessionsPerWeek?: number;
    class?: { id: string; name: string } | null;
    subject?: { id: string; name: string; code?: string } | null;
}

interface TodaySlot {
    id: string;
    startsAt?: string;
    endsAt?: string;
    room?: string | null;
    class?: { id: string; name: string } | null;
    subject?: { id: string; name: string; code?: string } | null;
}

interface OpenTask {
    id: string;
    title: string;
    dueOn?: string | null;
    priority?: string;
    isOverdue?: boolean;
}

interface CurrentPeriod extends TodaySlot {
    periodNumber?: number | null;
    isRegistration?: boolean;
}

interface CurrentPeriodResponse {
    current?: CurrentPeriod | null;
    next?: CurrentPeriod | null;
}

interface StaffAlert {
    id: string;
    title: string;
    body?: string;
    readAt?: string | null;
    type?: string;
}

interface MySummary {
    term?: { id?: string; name: string; currentWeek?: number | null } | null;
    homerooms?: { position: string; class?: { id: string; name: string } | null }[];
    teachingSubjects?: TeachingSubject[];
    todaySlots?: TodaySlot[];
    openTasks?: OpenTask[];
    overdueTaskCount?: number;
    attendanceOutstanding?: { id: string; name: string }[];
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

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isSubjectTeacher = user?.role === 'subject_teacher';

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MySummary | null>(null);
    const [error, setError] = useState('');
    const [sendingBotMenu, setSendingBotMenu] = useState(false);
    const [botMenuNotice, setBotMenuNotice] = useState('');
    const [botMenuError, setBotMenuError] = useState('');
    const [currentPeriod, setCurrentPeriod] = useState<CurrentPeriodResponse | null>(null);
    const [periodNotice, setPeriodNotice] = useState<CurrentPeriod | null>(null);
    const [staffAlerts, setStaffAlerts] = useState<StaffAlert[]>([]);
    const seenCurrentPeriod = useRef<string | null | undefined>(undefined);
    const periodNoticeTimeout = useRef<number | null>(null);

    const handleSendBotMenu = async () => {
        setSendingBotMenu(true);
        setBotMenuError('');
        setBotMenuNotice('');
        try {
            await api.post('/telegram/send-menu', {});
            setBotMenuNotice('Sent! Close this Mini App to use the inline buttons in @bisnocbot chat.');
        } catch (e) {
            setBotMenuError(e instanceof Error ? e.message : 'Could not send menu to Telegram chat');
        } finally {
            setSendingBotMenu(false);
        }
    };

    const closeMiniAppToChat = () => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.close) {
            tg.close();
        }
    };

    useEffect(() => {
        api.get('/dashboard/me')
            .then((data: MySummary) => setStats(data))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your dashboard'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        let active = true;
        const refresh = () => {
            api.get('/timetable/my-current')
                .then((data: CurrentPeriodResponse) => {
                    if (!active) return;
                    const current = data.current || null;
                    const currentId = current?.id || null;
                    if (current && seenCurrentPeriod.current !== undefined && currentId !== seenCurrentPeriod.current) {
                        setPeriodNotice(current);
                        if (periodNoticeTimeout.current !== null) window.clearTimeout(periodNoticeTimeout.current);
                        periodNoticeTimeout.current = window.setTimeout(() => setPeriodNotice(null), 8_000);
                    }
                    seenCurrentPeriod.current = currentId;
                    setCurrentPeriod(data);
                })
                .catch(() => { /* keep the last live card if a refresh is offline */ });
        };
        refresh();
        const timer = window.setInterval(refresh, 30_000);
        return () => {
            active = false;
            window.clearInterval(timer);
            if (periodNoticeTimeout.current !== null) window.clearTimeout(periodNoticeTimeout.current);
        };
    }, []);

    useEffect(() => {
        let active = true;
        const refresh = () => {
            api.get('/notifications')
                .then((data: { notifications?: StaffAlert[] }) => {
                    if (!active) return;
                    setStaffAlerts((data.notifications || [])
                        .filter((item) => item.type === 'nudge' && !item.readAt)
                        .slice(0, 3));
                })
                .catch(() => { /* alert preview is best-effort */ });
        };
        refresh();
        const timer = window.setInterval(refresh, 60_000);
        return () => { active = false; window.clearInterval(timer); };
    }, []);

    const openAlertInPortal = async (alert: StaffAlert) => {
        try { await api.post(`/notifications/${encodeURIComponent(alert.id)}/read`, {}); } catch { /* best effort */ }
        setStaffAlerts((previous) => previous.filter((item) => item.id !== alert.id));
        openWebPortal(user?.role);
    };

    const teachingPairs = useMemo(() => {
        const list = (stats?.teachingSubjects || []).filter(
            (s) => s.class?.id && s.subject?.id && s.subject.code !== 'REG',
        );
        return list.sort((a, b) =>
            String(a.class?.name || '').localeCompare(String(b.class?.name || '')),
        );
    }, [stats?.teachingSubjects]);

    const uniqueClassCount = useMemo(
        () => new Set(teachingPairs.map((p) => p.class?.id).filter(Boolean)).size,
        [teachingPairs],
    );

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-32 rounded-2xl glass-panel animate-pulse" />
                <div className="grid grid-cols-3 gap-2.5">
                    <div className="h-20 rounded-2xl glass-panel animate-pulse" />
                    <div className="h-20 rounded-2xl glass-panel animate-pulse" />
                    <div className="h-20 rounded-2xl glass-panel animate-pulse" />
                </div>
                <div className="h-40 rounded-2xl glass-panel animate-pulse" />
            </div>
        );
    }

    const todaySlots = stats?.todaySlots || [];
    const openTasks = stats?.openTasks || [];
    const attendanceDue = stats?.attendanceOutstanding || [];
    const dateLabel = todayIso();

    const quickActions = isSubjectTeacher
        ? [
              {
                  to: '/marks',
                  label: 'Marksheets',
                  icon: ClipboardList,
                  tone: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                  to: '/timetable',
                  label: 'Timetable',
                  icon: Calendar,
                  tone: 'text-blue-600 dark:text-blue-400',
              },
              {
                  to: '/students',
                  label: 'Pupils',
                  icon: Users,
                  tone: 'text-indigo-600 dark:text-indigo-400',
              },
          ]
        : [
              {
                  to: '/attendance',
                  label: 'Register',
                  icon: CheckSquare,
                  tone: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                  to: '/timetable',
                  label: 'Timetable',
                  icon: Calendar,
                  tone: 'text-blue-600 dark:text-blue-400',
              },
              {
                  to: user?.role === 'assistant_teacher' ? '/students' : '/marks',
                  label: user?.role === 'assistant_teacher' ? 'Pupils' : 'Marks',
                  icon: user?.role === 'assistant_teacher' ? Users : ClipboardList,
                  tone: 'text-indigo-600 dark:text-indigo-400',
              },
          ];

    return (
        <div className="p-4 space-y-4">
            {periodNotice && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed top-14 left-4 right-4 z-[100] mx-auto max-w-lg rounded-2xl border border-blue-400/40 bg-white/95 p-3 shadow-xl backdrop-blur dark:bg-slate-900/95"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Your class is starting</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {periodNotice.subject?.name || 'Registration'} — {periodNotice.class?.name || 'Class'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {periodNotice.isRegistration ? 'Registration' : periodNotice.periodNumber ? `Period ${periodNotice.periodNumber}` : 'Lesson'}
                                {' · '}{String(periodNotice.startsAt || '').slice(0, 5)}–{String(periodNotice.endsAt || '').slice(0, 5)}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label="Dismiss class notification"
                            onClick={() => setPeriodNotice(null)}
                            className="text-xs font-semibold text-slate-500"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
            {/* Hero Greeting Card */}
            <GlassCard className="relative overflow-hidden">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    {addisGreeting()}
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {user?.name || 'BIS Staff'}
                </h1>
                <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 glass-subcard px-2.5 py-1 rounded-full">
                    <span>{dateLabel}</span>
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

                {/* Role-aware Metric Tiles */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3.5 glass-subcard">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Today&apos;s lessons
                            </span>
                            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                            {todaySlots.length}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {todaySlots.length === 0 ? 'Free schedule today' : 'Scheduled periods'}
                        </p>
                    </div>

                    {isSubjectTeacher ? (
                        <div
                            onClick={() => navigate('/marks')}
                            role="button"
                            tabIndex={0}
                            className="p-3.5 glass-subcard cursor-pointer active:scale-[0.99] transition-transform"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    My classes
                                </span>
                                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                                {uniqueClassCount}
                            </p>
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                                <span>Open marksheets</span>
                                <ArrowRight className="w-3 h-3" />
                            </p>
                        </div>
                    ) : (
                        <div
                            onClick={() => navigate('/attendance')}
                            role="button"
                            tabIndex={0}
                            className="p-3.5 glass-subcard cursor-pointer active:scale-[0.99] transition-transform"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    Register
                                </span>
                                <CheckCircle2
                                    className={`w-4 h-4 ${
                                        attendanceDue.length === 0
                                            ? 'text-emerald-500'
                                            : 'text-amber-500'
                                    }`}
                                />
                            </div>
                            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                                {attendanceDue.length === 0 ? 'Done' : `${attendanceDue.length} due`}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {attendanceDue.length === 0
                                    ? 'All homerooms marked'
                                    : attendanceDue.map((c) => c.name).join(', ')}
                            </p>
                        </div>
                    )}
                </div>
            </GlassCard>

            {error && (
                <GlassCard className="border-rose-500/30">
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>
                </GlassCard>
            )}

            {/* Live class / period card for the current school clock */}
            <GlassCard className={currentPeriod?.current ? 'border-blue-500/40' : ''}>
                <SectionTitle
                    right={(
                        <button
                            type="button"
                            onClick={() => navigate('/timetable')}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-300"
                        >
                            Full timetable →
                        </button>
                    )}
                >
                    Class / period
                </SectionTitle>
                {currentPeriod?.current ? (
                    <div className="p-3 glass-subcard rounded-xl" aria-live="polite">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Happening now · {currentPeriod.current.isRegistration
                                ? 'Registration'
                                : currentPeriod.current.periodNumber
                                    ? `Period ${currentPeriod.current.periodNumber}`
                                    : 'Lesson'}
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {currentPeriod.current.subject?.name || 'Registration'} — {currentPeriod.current.class?.name || 'Class'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {String(currentPeriod.current.startsAt || '').slice(0, 5)}–{String(currentPeriod.current.endsAt || '').slice(0, 5)}
                            {currentPeriod.current.room ? ` · ${currentPeriod.current.room}` : ''}
                        </p>
                        {currentPeriod.next && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                Up next: {currentPeriod.next.subject?.name || 'Lesson'} — {currentPeriod.next.class?.name || 'Class'} at {String(currentPeriod.next.startsAt || '').slice(0, 5)}
                            </p>
                        )}
                    </div>
                ) : currentPeriod?.next ? (
                    <div className="p-3 glass-subcard rounded-xl" aria-live="polite">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                            Up next · {currentPeriod.next.isRegistration
                                ? 'Registration'
                                : currentPeriod.next.periodNumber
                                    ? `Period ${currentPeriod.next.periodNumber}`
                                    : 'Lesson'}
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                            {currentPeriod.next.subject?.name || 'Lesson'} — {currentPeriod.next.class?.name || 'Class'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {String(currentPeriod.next.startsAt || '').slice(0, 5)}–{String(currentPeriod.next.endsAt || '').slice(0, 5)}
                            {currentPeriod.next.room ? ` · ${currentPeriod.next.room}` : ''}
                        </p>
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-3">
                        No current or upcoming lesson on your timetable.
                    </p>
                )}
            </GlassCard>

            {staffAlerts.length > 0 && (
                <GlassCard className="border-amber-500/30">
                    <SectionTitle>New staff alerts</SectionTitle>
                    <div className="space-y-2">
                        {staffAlerts.map((alert) => (
                            <div key={alert.id} className="p-2.5 glass-subcard rounded-xl">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">{alert.title}</p>
                                {alert.body && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{alert.body}</p>}
                                <button
                                    type="button"
                                    onClick={() => { void openAlertInPortal(alert); }}
                                    className="mt-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-300"
                                >
                                    Open in staff portal →
                                </button>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2.5">
                {quickActions.map((item) => {
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

            {/* Subject Teacher: Direct Class Marksheet Jump Cards */}
            {isSubjectTeacher && teachingPairs.length > 0 && (
                <GlassCard>
                    <SectionTitle
                        right={
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {teachingPairs.length}{' '}
                                {teachingPairs.length === 1 ? 'marksheet' : 'marksheets'}
                            </span>
                        }
                    >
                        My class marksheets
                    </SectionTitle>
                    <div className="space-y-2">
                        {teachingPairs.map((pair) => (
                            <button
                                key={pair.id}
                                type="button"
                                onClick={() =>
                                    navigate(
                                        `/marks?classId=${encodeURIComponent(
                                            pair.class?.id || '',
                                        )}&subjectId=${encodeURIComponent(
                                            pair.subject?.id || '',
                                        )}`,
                                    )
                                }
                                className="w-full p-3 glass-subcard flex items-center justify-between gap-2 text-left active:scale-[0.99] transition-transform"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                        {pair.class?.name}
                                    </p>
                                    <p className="text-xs text-blue-600 dark:text-blue-300 font-medium truncate">
                                        {pair.subject?.name}
                                        {pair.sessionsPerWeek
                                            ? ` · ${pair.sessionsPerWeek} periods/wk`
                                            : ''}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            </button>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Today's Timetable Preview */}
            <GlassCard>
                <SectionTitle
                    right={
                        <button
                            type="button"
                            onClick={() => navigate('/timetable')}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-300"
                        >
                            Full week →
                        </button>
                    }
                >
                    Today&apos;s schedule
                </SectionTitle>
                {todaySlots.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                        No lessons scheduled for today.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {todaySlots.map((slot) => (
                            <div
                                key={slot.id}
                                className="p-2.5 glass-subcard flex items-center justify-between gap-2"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {slot.subject?.name || 'Lesson'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {slot.class?.name || ''}
                                        {slot.room ? ` · ${slot.room}` : ''}
                                    </p>
                                </div>
                                <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200">
                                    {String(slot.startsAt || '').slice(0, 5)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            {/* Open Tasks (if any) */}
            {openTasks.length > 0 && (
                <GlassCard>
                    <SectionTitle
                        right={
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {openTasks.length} open
                            </span>
                        }
                    >
                        Tasks
                    </SectionTitle>
                    <div className="space-y-2">
                        {openTasks.slice(0, 4).map((t) => (
                            <div key={t.id} className="p-2.5 glass-subcard flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                    {t.title}
                                </span>
                                {t.dueOn && (
                                    <span
                                        className={`text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full ${
                                            t.isOverdue
                                                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {t.dueOn}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Full Web Portal Launcher (bis-gerji-primary2.vercel.app) */}
            <GlassCard>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                Full BIS NOC Web Portal
                            </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                            bis-gerji-primary2.vercel.app · calendars, full spreadsheets &amp; reports
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openWebPortal(user?.role)}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold glass-tint-indigo inline-flex items-center gap-1"
                    >
                        <span>Open Web</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </GlassCard>

            {/* Quick bridge to @bisnocbot inline chat buttons */}
            <GlassCard>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                @bisnocbot Chat Shortcuts
                            </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Drop your fresh inline buttons (Today, Classes, Notices{isSubjectTeacher ? '' : ', Attendance'}) into the bot chat.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSendBotMenu}
                        disabled={sendingBotMenu}
                        className="shrink-0 btn-primary !py-1.5 !px-3 !text-xs !rounded-xl"
                    >
                        {sendingBotMenu ? 'Sending…' : 'Send to Chat'}
                    </button>
                </div>
                {botMenuNotice && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            {botMenuNotice}
                        </span>
                        <button
                            type="button"
                            onClick={closeMiniAppToChat}
                            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold glass-btn-emerald"
                        >
                            Switch to Chat
                        </button>
                    </div>
                )}
                {botMenuError && (
                    <p className="mt-2 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        {botMenuError}
                    </p>
                )}
            </GlassCard>
        </div>
    );
}
