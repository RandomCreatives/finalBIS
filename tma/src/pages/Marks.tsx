import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    Plus,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { api } from '../api/api';
import { useAuth } from '../auth/AuthContext';

const MAIN_TEACHER_MARKSHEET_CODES = new Set(['MAT', 'SCI', 'GLS']);

interface MarksheetPair {
    key: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    subjectCode?: string;
}

interface AssessmentColumn {
    id: string;
    label: string;
    maxMarks: number;
    sortOrder?: number;
    marks: Record<string, number>;
}

interface PupilRow {
    id: string;
    name: string;
    admissionNo?: string;
    rollNum?: number | null;
}

function gradeFor(pct: number): string {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

function gradeBadgeTone(pct?: number | null): string {
    if (pct == null) return 'bg-slate-500/12 text-slate-600 dark:text-slate-300';
    if (pct >= 80) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (pct >= 60) return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
    if (pct >= 50) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
}

export default function Marks() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isAdmin = user?.role === 'admin';
    const isMainTeacher = user?.role === 'main_teacher';

    const [loadingScope, setLoadingScope] = useState(true);
    const [pairs, setPairs] = useState<MarksheetPair[]>([]);
    const [selectedPairKey, setSelectedPairKey] = useState('');
    const [term, setTerm] = useState<{ id: string; name: string } | null>(null);

    const [loadingSheet, setLoadingSheet] = useState(false);
    const [roster, setRoster] = useState<PupilRow[]>([]);
    const [assessments, setAssessments] = useState<AssessmentColumn[]>([]);
    const [directFinals, setDirectFinals] = useState<Record<string, { marks: number; maxMarks: number; percentage: number; grade: string }>>({});

    // Active column: assessment.id or 'totals'
    const [activeTab, setActiveTab] = useState<string>('totals');
    // Edits keyed by `${assessmentId}|${studentId}`
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [search, setSearch] = useState('');

    // New assessment inline drawer
    const [creatingOpen, setCreatingOpen] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newMax, setNewMax] = useState('10');
    const [creating, setCreating] = useState(false);

    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    // 1. Load current term + ONLY the (class, subject) pairs this user teaches (or all for admin).
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        setLoadingScope(true);
        setError('');

        Promise.all([
            api.get('/terms/current').catch(() => ({ term: null })),
            isAdmin
                ? api.get('/assignments/subjects')
                : api.get(`/assignments/subjects?teacherId=${encodeURIComponent(user.id)}`),
        ])
            .then(([termRes, assignRes]) => {
                if (cancelled) return;
                if (termRes?.term) setTerm(termRes.term);

                const rawList: any[] = assignRes?.assignments || [];
                const filteredAssigns = rawList.filter((a) => {
                    const cls = a.class;
                    const subj = a.subject;
                    if (!cls?.id || !subj?.id || subj.code === 'REG') return false;
                    if (isMainTeacher) {
                        return MAIN_TEACHER_MARKSHEET_CODES.has(subj.code);
                    }
                    return true;
                });

                const dedup = new Map<string, MarksheetPair>();
                for (const a of filteredAssigns) {
                    const key = `${a.class.id}|${a.subject.id}`;
                    if (!dedup.has(key)) {
                        dedup.set(key, {
                            key,
                            classId: a.class.id,
                            className: a.class.name,
                            subjectId: a.subject.id,
                            subjectName: a.subject.name,
                            subjectCode: a.subject.code,
                        });
                    }
                }

                const sortedPairs = [...dedup.values()].sort(
                    (a, b) =>
                        a.className.localeCompare(b.className) ||
                        a.subjectName.localeCompare(b.subjectName),
                );
                setPairs(sortedPairs);

                if (sortedPairs.length > 0) {
                    const qClass = searchParams.get('classId');
                    const qSubj = searchParams.get('subjectId');
                    const requested =
                        (qClass && qSubj && sortedPairs.find((p) => p.classId === qClass && p.subjectId === qSubj)) ||
                        (qClass && sortedPairs.find((p) => p.classId === qClass)) ||
                        sortedPairs[0];
                    setSelectedPairKey(requested.key);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Could not load your marksheets');
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingScope(false);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, isAdmin, isMainTeacher]);

    const activePair = useMemo(
        () => pairs.find((p) => p.key === selectedPairKey) || null,
        [pairs, selectedPairKey],
    );

    const uniqueSubjectNames = useMemo(
        () => [...new Set(pairs.map((p) => p.subjectName))],
        [pairs],
    );
    const uniqueClassIds = useMemo(
        () => [...new Set(pairs.map((p) => p.classId))],
        [pairs],
    );

    const loadSheet = useCallback(
        async (pair: MarksheetPair, termId?: string) => {
            setLoadingSheet(true);
            setError('');
            setEdits({});

            const termQuery = termId ? `&termId=${encodeURIComponent(termId)}` : '';
            try {
                const [rosterRes, assessRes, marksRes] = await Promise.all([
                    api.get(`/students?classId=${encodeURIComponent(pair.classId)}`),
                    api.get(
                        `/assessments?classId=${encodeURIComponent(pair.classId)}&subjectId=${encodeURIComponent(
                            pair.subjectId,
                        )}${termQuery}`,
                    ),
                    api
                        .get(
                            `/marksheets?classId=${encodeURIComponent(
                                pair.classId,
                            )}&subjectId=${encodeURIComponent(pair.subjectId)}${termQuery}`,
                        )
                        .catch(() => ({ marksheets: [] })),
                ]);

                const pupils: PupilRow[] = (rosterRes?.students || []).sort(
                    (a: PupilRow, b: PupilRow) =>
                        (a.rollNum ?? 9999) - (b.rollNum ?? 9999) ||
                        a.name.localeCompare(b.name),
                );
                const cols: AssessmentColumn[] = assessRes?.assessments || [];

                const finalsMap: Record<
                    string,
                    { marks: number; maxMarks: number; percentage: number; grade: string }
                > = {};
                for (const m of marksRes?.marksheets || []) {
                    const sid = m.student?.id;
                    if (sid) {
                        finalsMap[sid] = {
                            marks: Number(m.marks),
                            maxMarks: Number(m.maxMarks || 100),
                            percentage: Number(m.percentage ?? 0),
                            grade: m.grade || gradeFor(Number(m.percentage ?? 0)),
                        };
                    }
                }

                setRoster(pupils);
                setAssessments(cols);
                setDirectFinals(finalsMap);
                setActiveTab((prev) => {
                    if (cols.length === 0) return 'totals';
                    if (prev !== 'totals' && cols.some((c) => c.id === prev)) return prev;
                    return cols[cols.length - 1].id;
                });
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not load class marksheet');
            } finally {
                setLoadingSheet(false);
            }
        },
        [],
    );

    useEffect(() => {
        if (!activePair) return;
        void loadSheet(activePair, term?.id);
    }, [activePair, term?.id, loadSheet]);

    const handleSelectPair = (pair: MarksheetPair) => {
        setSelectedPairKey(pair.key);
        setNotice('');
        setCreatingOpen(false);
        setSearchParams(
            { classId: pair.classId, subjectId: pair.subjectId },
            { replace: true },
        );
    };

    const loadedMark = (assessmentId: string, studentId: string): string => {
        const col = assessments.find((a) => a.id === assessmentId);
        const val = col?.marks?.[studentId];
        return val === undefined || val === null ? '' : String(val);
    };

    const currentMark = (assessmentId: string, studentId: string): string => {
        const k = `${assessmentId}|${studentId}`;
        return k in edits ? edits[k] : loadedMark(assessmentId, studentId);
    };

    const dirtyEntries = useMemo(() => {
        const out: { assessmentId: string; studentId: string; marks: number }[] = [];
        for (const col of assessments) {
            for (const pupil of roster) {
                const cur = currentMark(col.id, pupil.id).trim();
                const orig = loadedMark(col.id, pupil.id);
                if (cur !== '' && cur !== orig && !Number.isNaN(Number(cur))) {
                    out.push({
                        assessmentId: col.id,
                        studentId: pupil.id,
                        marks: Number(cur),
                    });
                }
            }
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edits, assessments, roster]);

    const invalidKeys = useMemo(() => {
        const bad = new Set<string>();
        for (const col of assessments) {
            for (const pupil of roster) {
                const k = `${col.id}|${pupil.id}`;
                const raw = currentMark(col.id, pupil.id).trim();
                if (!raw) continue;
                const num = Number(raw);
                if (Number.isNaN(num) || num < 0 || num > col.maxMarks) {
                    bad.add(k);
                }
            }
        }
        return bad;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edits, assessments, roster]);

    const computePupilFinal = (studentId: string) => {
        if (assessments.length > 0) {
            let sum = 0;
            let max = 0;
            let anyMarked = false;
            for (const col of assessments) {
                const raw = currentMark(col.id, studentId).trim();
                if (raw !== '' && !Number.isNaN(Number(raw))) {
                    sum += Number(raw);
                    max += col.maxMarks;
                    anyMarked = true;
                }
            }
            if (!anyMarked || max <= 0) return null;
            const pct = Number(((sum / max) * 100).toFixed(1));
            return { marks: sum, max, pct, grade: gradeFor(pct) };
        }

        const direct = directFinals[studentId];
        if (!direct) return null;
        return {
            marks: direct.marks,
            max: direct.maxMarks,
            pct: direct.percentage,
            grade: direct.grade,
        };
    };

    const handleCreateAssessment = async () => {
        if (!activePair) return;
        const label = newLabel.trim();
        const maxMarks = Number(newMax);
        if (!label) {
            setError('Enter an assessment name (e.g. Quiz 1).');
            return;
        }
        if (!(maxMarks > 0)) {
            setError('Maximum marks must be greater than zero.');
            return;
        }

        setCreating(true);
        setError('');
        try {
            const res = await api.post('/assessments', {
                classId: activePair.classId,
                subjectId: activePair.subjectId,
                ...(term?.id ? { termId: term.id } : {}),
                label,
                maxMarks,
            });
            setCreatingOpen(false);
            setNewLabel('');
            setNewMax('10');
            await loadSheet(activePair, term?.id);
            if (res?.assessment?.id) {
                setActiveTab(res.assessment.id);
            }
            setNotice(`Created "${label}" (/${maxMarks})`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create assessment');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteAssessment = async (col: AssessmentColumn) => {
        if (!activePair) return;
        if (!window.confirm(`Delete "${col.label}" and all its marks?`)) return;
        setError('');
        try {
            await api.del(`/assessments/${encodeURIComponent(col.id)}`);
            setNotice(`Removed "${col.label}"`);
            await loadSheet(activePair, term?.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete assessment');
        }
    };

    const handleSaveMarks = async () => {
        if (!activePair || dirtyEntries.length === 0 || invalidKeys.size > 0) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.post('/assessments/marks/bulk', {
                classId: activePair.classId,
                subjectId: activePair.subjectId,
                ...(term?.id ? { termId: term.id } : {}),
                entries: dirtyEntries,
            });
            setEdits({});
            await loadSheet(activePair, term?.id);
            setNotice(`Saved ${res?.saved ?? dirtyEntries.length} marks — finals updated`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save marks');
        } finally {
            setSaving(false);
        }
    };

    const filteredRoster = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                String(s.admissionNo || '').toLowerCase().includes(q),
        );
    }, [roster, search]);

    const activeAssessment = assessments.find((a) => a.id === activeTab) || null;

    if (loadingScope) {
        return (
            <div className="p-4 space-y-3">
                <div className="h-14 rounded-2xl glass-panel animate-pulse" />
                <div className="h-64 rounded-2xl glass-panel animate-pulse" />
            </div>
        );
    }

    const singleSubjectMode = uniqueSubjectNames.length === 1;
    const singleClassMode = uniqueClassIds.length === 1 && uniqueSubjectNames.length > 1;

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Marksheets
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {singleSubjectMode
                            ? `${uniqueSubjectNames[0]} · ${pairs.length} ${
                                  pairs.length === 1 ? 'class' : 'classes'
                              }`
                            : activePair
                              ? `${activePair.className} · ${activePair.subjectName}`
                              : 'Assigned classes & subjects'}
                    </p>
                </div>
                {term?.name && (
                    <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full glass-subcard text-blue-600 dark:text-blue-300">
                        {term.name}
                    </span>
                )}
            </div>

            {pairs.length === 0 ? (
                <GlassCard>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                        No subject marksheets are assigned to your account for this academic year.
                    </p>
                </GlassCard>
            ) : (
                <>
                    {/* Class / Subject Picker — ONLY classes & subjects this teacher teaches */}
                    {pairs.length > 1 && (
                        <GlassCard className="p-3">
                            <SectionTitle
                                right={
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                        {pairs.length} sheets
                                    </span>
                                }
                            >
                                {singleSubjectMode
                                    ? 'My classes'
                                    : singleClassMode
                                      ? 'My subjects'
                                      : 'Class & subject'}
                            </SectionTitle>
                            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                {pairs.map((p) => {
                                    const active = p.key === selectedPairKey;
                                    const pillLabel = singleSubjectMode
                                        ? p.className
                                        : singleClassMode
                                          ? p.subjectName
                                          : `${p.className} · ${p.subjectName}`;
                                    return (
                                        <button
                                            key={p.key}
                                            type="button"
                                            onClick={() => handleSelectPair(p)}
                                            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold ${
                                                active ? 'glass-pill-active' : 'glass-pill'
                                            }`}
                                        >
                                            {pillLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </GlassCard>
                    )}

                    {error && (
                        <GlassCard className="flex items-center gap-2 border-rose-500/30">
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
                                {error}
                            </span>
                        </GlassCard>
                    )}

                    {notice && !error && (
                        <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/12 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>{notice}</span>
                        </div>
                    )}

                    {/* Assessment Columns Bar + New Column Drawer */}
                    <GlassCard className="p-3 space-y-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                            {assessments.map((col) => {
                                const active = activeTab === col.id;
                                return (
                                    <button
                                        key={col.id}
                                        type="button"
                                        onClick={() => setActiveTab(col.id)}
                                        className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                                            active ? 'glass-pill-active' : 'glass-pill'
                                        }`}
                                    >
                                        {col.label}{' '}
                                        <span className={active ? 'text-blue-100' : 'opacity-60'}>
                                            /{col.maxMarks}
                                        </span>
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => setActiveTab('totals')}
                                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                                    activeTab === 'totals' ? 'glass-pill-active' : 'glass-pill'
                                }`}
                            >
                                Σ Totals
                            </button>

                            <button
                                type="button"
                                onClick={() => setCreatingOpen((v) => !v)}
                                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 glass-tint-emerald"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New
                            </button>
                        </div>

                        {creatingOpen && (
                            <div className="p-3 glass-subcard space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                        Add assessment column
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCreatingOpen(false)}
                                        className="text-slate-400"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        placeholder="e.g. Quiz 1"
                                        className="glass-input col-span-2 !py-2 !text-xs"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        inputMode="decimal"
                                        value={newMax}
                                        onChange={(e) => setNewMax(e.target.value)}
                                        placeholder="Max"
                                        className="glass-input !py-2 !text-xs text-center"
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex gap-1">
                                        {['10', '20', '30', '40', '100'].map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setNewMax(preset)}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
                                                    newMax === preset ? 'glass-pill-active' : 'glass-pill'
                                                }`}
                                            >
                                                /{preset}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCreateAssessment}
                                        disabled={creating}
                                        className="btn-primary !py-1.5 !px-3.5 !text-xs"
                                    >
                                        {creating ? 'Adding…' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </GlassCard>

                    {/* Sheet Body */}
                    {loadingSheet ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-14 rounded-2xl glass-panel animate-pulse" />
                            ))}
                        </div>
                    ) : roster.length === 0 ? (
                        <GlassCard>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                                No active pupils in {activePair?.className}.
                            </p>
                        </GlassCard>
                    ) : (
                        <GlassCard className="space-y-3">
                            {/* Search + Save / Delete Header */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                        {activePair?.className} · {activePair?.subjectName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {activeAssessment
                                            ? `Entering "${activeAssessment.label}" (out of ${activeAssessment.maxMarks})`
                                            : `Term summary · ${roster.length} pupils`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    {activeAssessment && (
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteAssessment(activeAssessment)}
                                            aria-label={`Delete ${activeAssessment.label}`}
                                            title="Delete column"
                                            className="w-8 h-8 rounded-xl glass-subcard flex items-center justify-center text-rose-500 active:scale-95"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {dirtyEntries.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleSaveMarks}
                                            disabled={saving || invalidKeys.size > 0}
                                            className="btn-primary !py-1.5 !px-3 !text-xs"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                            {saving ? 'Saving…' : `Save (${dirtyEntries.length})`}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {roster.length > 5 && (
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Filter pupils…"
                                        className="glass-input !py-2 !pl-9 !pr-8 !text-xs"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {assessments.length === 0 && Object.keys(directFinals).length === 0 && (
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-700 dark:text-blue-100">
                                    Tap <strong>+ New</strong> above to add your first assessment column (e.g.{' '}
                                    <em>Quiz 1</em> out of 10) and start entering {activePair?.subjectName} marks for{' '}
                                    {activePair?.className}.
                                </div>
                            )}

                            {/* Pupil Rows */}
                            <div className="space-y-2">
                                {filteredRoster.map((pupil, idx) => {
                                    const finalInfo = computePupilFinal(pupil.id);

                                    if (activeAssessment) {
                                        const cellKey = `${activeAssessment.id}|${pupil.id}`;
                                        const val = currentMark(activeAssessment.id, pupil.id);
                                        const invalid = invalidKeys.has(cellKey);

                                        return (
                                            <div
                                                key={pupil.id}
                                                className="p-2.5 glass-subcard flex items-center justify-between gap-2.5"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <span className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                                        {pupil.rollNum ?? idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                            {pupil.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {finalInfo
                                                                ? `Total: ${finalInfo.marks}/${finalInfo.max} · ${finalInfo.grade}`
                                                                : pupil.admissionNo || 'Not graded yet'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min={0}
                                                        max={activeAssessment.maxMarks}
                                                        value={val}
                                                        onChange={(e) =>
                                                            setEdits((prev) => ({
                                                                ...prev,
                                                                [cellKey]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder="—"
                                                        className={`w-16 text-center font-bold glass-input !py-1.5 !px-2 !text-sm ${
                                                            invalid
                                                                ? '!border-rose-500 !text-rose-600 dark:!text-rose-300'
                                                                : ''
                                                        }`}
                                                    />
                                                    <span className="text-xs font-semibold text-slate-400 w-7">
                                                        /{activeAssessment.maxMarks}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Σ Totals view
                                    return (
                                        <div key={pupil.id} className="p-3 glass-subcard space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                                                        {pupil.rollNum ?? idx + 1}
                                                    </span>
                                                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                        {pupil.name}
                                                    </span>
                                                </div>

                                                <span
                                                    className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${gradeBadgeTone(
                                                        finalInfo?.pct ?? null,
                                                    )}`}
                                                >
                                                    {finalInfo
                                                        ? `${finalInfo.marks}/${finalInfo.max} · ${finalInfo.grade}`
                                                        : '—'}
                                                </span>
                                            </div>

                                            {assessments.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pl-8">
                                                    {assessments.map((col) => {
                                                        const v = currentMark(col.id, pupil.id);
                                                        return (
                                                            <span
                                                                key={col.id}
                                                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300"
                                                            >
                                                                {col.label}: {v !== '' ? `${v}/${col.maxMarks}` : '—'}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {dirtyEntries.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleSaveMarks}
                                    disabled={saving || invalidKeys.size > 0}
                                    className="btn-primary w-full mt-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {invalidKeys.size > 0
                                        ? `Fix ${invalidKeys.size} score(s) above maximum`
                                        : saving
                                          ? 'Saving marks…'
                                          : `Save Marks (${dirtyEntries.length})`}
                                </button>
                            )}
                        </GlassCard>
                    )}
                </>
            )}
        </div>
    );
}
