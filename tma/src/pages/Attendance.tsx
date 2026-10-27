import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCheck, CheckCircle2, Save } from 'lucide-react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { api } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { todayIso } from '../lib/date';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

const STATUS_OPTIONS: {
    key: AttendanceStatus;
    short: string;
    label: string;
    activeCls: string;
    countCls: string;
}[] = [
    {
        key: 'present',
        short: 'P',
        label: 'Present',
        activeCls: 'glass-btn-emerald',
        countCls: 'text-emerald-600 dark:text-emerald-400',
    },
    {
        key: 'late',
        short: 'L',
        label: 'Late',
        activeCls: 'glass-btn-amber',
        countCls: 'text-amber-600 dark:text-amber-400',
    },
    {
        key: 'absent',
        short: 'A',
        label: 'Absent',
        activeCls: 'glass-btn-rose',
        countCls: 'text-rose-600 dark:text-rose-400',
    },
    {
        key: 'excused',
        short: 'E',
        label: 'Excused',
        activeCls: 'glass-btn-sky',
        countCls: 'text-sky-600 dark:text-sky-400',
    },
];

export default function Attendance() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const today = useMemo(() => todayIso(), []);

    const [loadingClasses, setLoadingClasses] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [savedNotice, setSavedNotice] = useState('');
    const [error, setError] = useState('');

    const loadClassRoster = useCallback(
        async (classId: string) => {
            setSelectedClass(classId);
            setLoadingRoster(true);
            setError('');
            setSavedNotice('');
            setDirty(false);

            try {
                const [rosterRes, attRes] = await Promise.all([
                    api.get(`/students?classId=${encodeURIComponent(classId)}`),
                    api
                        .get(`/attendance?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(today)}`)
                        .catch(() => ({ attendance: [] })),
                ]);

                const pupilList = rosterRes.students || [];
                const initialRecords: Record<string, AttendanceStatus> = {};
                for (const item of attRes.attendance || []) {
                    const sid = item.student?.id || item.studentId || item.student_id;
                    if (sid && item.status) {
                        initialRecords[sid] = item.status as AttendanceStatus;
                    }
                }

                setStudents(pupilList);
                setRecords(initialRecords);
                if (Object.keys(initialRecords).length > 0) {
                    setSavedNotice(`Loaded ${Object.keys(initialRecords).length} saved marks for today`);
                }
            } catch (e) {
                setStudents([]);
                setRecords({});
                setError(e instanceof Error ? e.message : 'Could not load class register');
            } finally {
                setLoadingRoster(false);
            }
        },
        [today],
    );

    useEffect(() => {
        api.get('/classes?mine=true')
            .then((data) => {
                const list: any[] = data.classes || [];
                setClasses(list);
                if (list.length > 0) {
                    const qClass = searchParams.get('classId');
                    const requested = qClass ? list.find((c) => c.id === qClass) : null;
                    const homeroom = list.find(
                        (c) =>
                            c.mainTeacher?.id === user?.id ||
                            c.assistantTeacher?.id === user?.id,
                    );
                    const initial = requested || homeroom || list[0];
                    void loadClassRoster(initial.id);
                }
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load classes'))
            .finally(() => setLoadingClasses(false));
    }, [user?.id, loadClassRoster]);

    const toggle = (studentId: string, status: AttendanceStatus) => {
        setRecords((prev) => ({ ...prev, [studentId]: status }));
        setDirty(true);
        setSavedNotice('');
    };

    const markAllPresent = () => {
        const next: Record<string, AttendanceStatus> = {};
        for (const s of students) {
            next[s.id] = 'present';
        }
        setRecords(next);
        setDirty(true);
        setSavedNotice('');
    };

    const submit = async () => {
        if (!selectedClass || Object.keys(records).length === 0) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.post('/attendance', {
                classId: selectedClass,
                date: today,
                subjectId: null,
                records: Object.entries(records).map(([studentId, status]) => ({
                    studentId,
                    status,
                })),
            });
            setDirty(false);
            setSavedNotice(`Saved ${res?.count ?? Object.keys(records).length} attendance records`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save register');
        } finally {
            setSaving(false);
        }
    };

    const counts = useMemo(() => {
        const summary: Record<AttendanceStatus, number> = {
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
        };
        for (const st of Object.values(records)) {
            if (summary[st] != null) summary[st] += 1;
        }
        return summary;
    }, [records]);

    const activeClassObj = classes.find((c) => c.id === selectedClass);
    const markedCount = Object.keys(records).length;

    if (loadingClasses) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-14 rounded-2xl glass-panel animate-pulse" />
                <div className="h-64 rounded-2xl glass-panel animate-pulse" />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Attendance
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {today}
                        {activeClassObj ? ` · ${activeClassObj.name}` : ''}
                    </p>
                </div>
                {students.length > 0 && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full glass-subcard text-blue-600 dark:text-blue-300">
                        {markedCount}/{students.length} marked
                    </span>
                )}
            </div>

            {/* Class Picker */}
            {classes.length > 1 && (
                <GlassCard className="p-3">
                    <SectionTitle>Select class</SectionTitle>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {classes.map((c) => {
                            const active = selectedClass === c.id;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => void loadClassRoster(c.id)}
                                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                                        active ? 'glass-pill-active' : 'glass-pill'
                                    }`}
                                >
                                    <span>{c.name}</span>
                                    {typeof c.studentCount === 'number' && (
                                        <span className={`ml-1.5 text-[10px] ${active ? 'text-blue-100' : 'opacity-60'}`}>
                                            ({c.studentCount})
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            {error && (
                <GlassCard className="flex items-center gap-2 border-rose-500/30">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</span>
                </GlassCard>
            )}

            {savedNotice && !error && (
                <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/12 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{savedNotice}</span>
                </div>
            )}

            {classes.length === 0 ? (
                <GlassCard>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                        No classes assigned for the active academic year.
                    </p>
                </GlassCard>
            ) : loadingRoster ? (
                <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 rounded-2xl glass-panel animate-pulse" />
                    ))}
                </div>
            ) : selectedClass && students.length > 0 ? (
                <GlassCard>
                    {/* Live Summary & Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/70 dark:border-white/10">
                        <div className="flex items-center gap-2.5 text-xs font-bold">
                            {STATUS_OPTIONS.map((opt) => (
                                <span key={opt.key} className={opt.countCls}>
                                    {opt.short}: {counts[opt.key]}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={markAllPresent}
                                className="px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 glass-tint-emerald"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                All Present
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={saving || markedCount === 0}
                                className="btn-primary !py-2 !px-3.5 !text-xs"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {saving ? 'Saving…' : dirty ? 'Save' : 'Update'}
                            </button>
                        </div>
                    </div>

                    {/* Student Roster */}
                    <div className="space-y-2">
                        {students.map((s, idx) => {
                            const status = records[s.id];
                            return (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-2 p-2.5 glass-subcard"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <span className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                            {s.rollNum ?? idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                {s.name}
                                            </p>
                                            {s.admissionNo && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                    {s.admissionNo}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-1 shrink-0">
                                        {STATUS_OPTIONS.map((opt) => {
                                            const active = status === opt.key;
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    title={opt.label}
                                                    onClick={() => toggle(s.id, opt.key)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-bold ${
                                                        active ? opt.activeCls : 'glass-pill'
                                                    }`}
                                                >
                                                    {opt.short}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {markedCount > 0 && (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={saving}
                            className="btn-primary w-full mt-4"
                        >
                            <Save className="w-4 h-4" />
                            {saving
                                ? 'Saving register…'
                                : `Save Register (${markedCount}/${students.length})`}
                        </button>
                    )}
                </GlassCard>
            ) : (
                <GlassCard>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                        No active pupils in this class.
                    </p>
                </GlassCard>
            )}
        </div>
    );
}
