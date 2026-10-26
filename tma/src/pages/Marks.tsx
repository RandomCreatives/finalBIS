import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { api } from '../api/api';

function gradeBadgeTone(pct?: number | null): string {
    if (pct == null) return 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
    if (pct >= 85) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (pct >= 70) return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
    if (pct >= 55) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
}

export default function Marks() {
    const [loading, setLoading] = useState(true);
    const [marksheets, setMarksheets] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/marksheets')
            .then((data) => setMarksheets(data.marksheets || []))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load marks'))
            .finally(() => setLoading(false));
    }, []);

    const subjects = useMemo(() => {
        const names = new Set<string>();
        for (const m of marksheets) {
            if (m.subject?.name) names.add(m.subject.name);
        }
        return Array.from(names).sort();
    }, [marksheets]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return marksheets.filter((m) => {
            if (subjectFilter !== 'all' && m.subject?.name !== subjectFilter) return false;
            if (!q) return true;
            const hay = `${m.student?.name || ''} ${m.subject?.name || ''} ${m.term?.name || ''} ${m.grade || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [marksheets, search, subjectFilter]);

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

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Marks
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Recorded subject scores &amp; term grades
                    </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full glass-subcard text-blue-600 dark:text-blue-300">
                    {filtered.length}
                </span>
            </div>

            {marksheets.length > 0 && (
                <div className="space-y-2.5">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search pupil or subject…"
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

                    {subjects.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {['all', ...subjects].map((subj) => {
                                const active = subjectFilter === subj;
                                return (
                                    <button
                                        key={subj}
                                        type="button"
                                        onClick={() => setSubjectFilter(subj)}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                            active
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'glass-subcard text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {subj === 'all' ? 'All subjects' : subj}
                                    </button>
                                );
                            })}
                        </div>
                    )}
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
                        {marksheets.length === 0
                            ? 'No marksheets recorded yet.'
                            : 'No marks match your search.'}
                    </p>
                </GlassCard>
            ) : (
                <div className="space-y-2.5">
                    {filtered.map((m) => {
                        const pct = typeof m.percentage === 'number' ? m.percentage : null;
                        return (
                            <GlassCard key={m.id} className="p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                            {m.student?.name || 'Student'}
                                        </p>
                                        <p className="text-xs text-blue-600 dark:text-blue-300 font-medium truncate">
                                            {m.subject?.name || 'Subject'}
                                        </p>
                                    </div>
                                    <span
                                        className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${gradeBadgeTone(
                                            pct,
                                        )}`}
                                    >
                                        {pct != null ? `${pct}%` : '—'}
                                        {m.grade ? ` · ${m.grade}` : ''}
                                    </span>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                    <span>{m.term?.name || 'Term'}</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {m.marks != null ? `${m.marks} / ${m.maxMarks || 100}` : '—'}
                                    </span>
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
