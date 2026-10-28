import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Phone, Search, Sparkles, User, X } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { api } from '../api/api';
import { useLiveSync } from '../hooks/useLiveSync';
import { sortClassRoster } from '../utils/rosterSort';

function pupilInitials(name?: string): string {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function Students() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [senOnly, setSenOnly] = useState(false);
    const [error, setError] = useState('');
    const hasLoaded = useRef(false);

    const loadStudents = useCallback(async () => {
        if (!hasLoaded.current) setLoading(true);
        setError('');
        try {
            const data = await api.get('/students');
            setStudents(sortClassRoster(data.students || []));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load students');
        } finally {
            hasLoaded.current = true;
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadStudents(); }, [loadStudents]);
    useLiveSync('students', () => { void loadStudents(); });

    const classNames = useMemo(() => {
        const names = new Set<string>();
        for (const s of students) {
            if (s.class?.name) names.add(s.class.name);
        }
        return Array.from(names).sort();
    }, [students]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return students.filter((s) => {
            if (classFilter !== 'all' && s.class?.name !== classFilter) return false;
            if (senOnly && !s.specialNeeds) return false;
            if (!q) return true;
            const hay = `${s.name || ''} ${s.admissionNo || ''} ${s.class?.name || ''} ${s.guardianName || ''} ${s.guardianPhone || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [students, search, classFilter, senOnly]);

    if (loading) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-12 rounded-2xl glass-panel animate-pulse" />
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-2xl glass-panel animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Students
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pupil directory &amp; guardian contacts
                    </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full glass-subcard text-blue-600 dark:text-blue-300">
                    {filtered.length}
                </span>
            </div>

            {/* Search + Filters */}
            {students.length > 0 && (
                <div className="space-y-2.5">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search pupil, ID, or guardian…"
                            className="glass-input !pl-9 !pr-9"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {classNames.length > 1 &&
                            ['all', ...classNames].map((cls) => {
                                const active = classFilter === cls;
                                return (
                                    <button
                                        key={cls}
                                        type="button"
                                        onClick={() => setClassFilter(cls)}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                            active ? 'glass-pill-active' : 'glass-pill'
                                        }`}
                                    >
                                        {cls === 'all' ? 'All classes' : cls}
                                    </button>
                                );
                            })}

                        {students.some((s) => s.specialNeeds) && (
                            <button
                                type="button"
                                onClick={() => setSenOnly((v) => !v)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                                    senOnly
                                        ? 'glass-btn-amber'
                                        : 'glass-pill !text-amber-700 dark:!text-amber-300'
                                }`}
                            >
                                <Sparkles className="w-3 h-3" />
                                SEN
                            </button>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <GlassCard className="flex items-center gap-2 border-rose-500/30">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</span>
                </GlassCard>
            )}

            {filtered.length === 0 ? (
                <GlassCard>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                        {students.length === 0 ? 'No students found.' : 'No pupils match your filter.'}
                    </p>
                </GlassCard>
            ) : (
                <div className="space-y-2.5">
                    {filtered.map((s) => (
                        <GlassCard key={s.id} className="p-3.5">
                            <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/15 to-sky-500/15 dark:from-blue-500/25 dark:to-sky-500/20 text-blue-700 dark:text-blue-200 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/15">
                                        {pupilInitials(s.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                            {s.name}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {s.admissionNo || 'No ID'}
                                            {s.class?.name ? ` · ${s.class.name}` : ''}
                                        </p>
                                    </div>
                                </div>

                                {s.specialNeeds && (
                                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                        SEN
                                    </span>
                                )}
                            </div>

                            {(s.guardianName || s.guardianPhone) && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
                                        <User className="w-3.5 h-3.5 opacity-60 shrink-0" />
                                        <span className="truncate">{s.guardianName || 'Guardian'}</span>
                                    </div>

                                    {s.guardianPhone ? (
                                        <a
                                            href={`tel:${String(s.guardianPhone).replace(/\s+/g, '')}`}
                                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg glass-tint-emerald font-semibold text-[11px]"
                                        >
                                            <Phone className="w-3 h-3" />
                                            <span>{s.guardianPhone}</span>
                                        </a>
                                    ) : (
                                        <span className="text-[11px] text-slate-400">—</span>
                                    )}
                                </div>
                            )}
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}
