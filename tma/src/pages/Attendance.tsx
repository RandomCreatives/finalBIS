import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../components/GlassCard';
import { api } from '../api/api';
import { AlertCircle } from 'lucide-react';
import { todayIso } from '../lib/date';

export default function Attendance() {
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [records, setRecords] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/classes')
            .then((data) => setClasses(data.classes || []))
            .catch(() => setError('Could not load classes'))
            .finally(() => setLoading(false));
    }, []);

    const handleSelect = (id: string) => {
        setSelectedClass(id);
        setStudents([]);
        setRecords({});
        api.get(`/students?classId=${id}`)
            .then((data) => setStudents(data.students || []))
            .catch(() => setError('Could not load students'));
    };

    const toggle = (id: string, status: string) => {
        setRecords((prev) => ({ ...prev, [id]: status }));
    };

    const submit = async () => {
        if (!selectedClass) return;
        setSaving(true);
        try {
            const today = todayIso();
            await api.post('/attendance', {
                classId: selectedClass,
                date: today,
                subjectId: null,
                records: Object.entries(records).map(([studentId, status]) => ({ studentId, status })),
            });
            setError('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save register');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4"><div className="h-10 w-24 rounded-lg bg-blue-100 animate-pulse" /></div>;
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
            <h1 className="text-xl font-bold mb-4">Attendance</h1>

            <GlassCard className="mb-4">
                <SectionTitle>Class</SectionTitle>
                <div className="space-y-2">
                    {classes.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => handleSelect(c.id)}
                            className={`w-full px-4 py-2.5 rounded-lg text-left text-sm font-medium border ${
                                selectedClass === c.id
                                    ? 'bg-blue-600/10 border-blue-600 text-blue-600'
                                    : 'bg-white/40 border-white/40 text-blue-900'
                            }`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
                {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
            </GlassCard>

            {selectedClass && students.length > 0 && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-3">
                        <SectionTitle>Register today</SectionTitle>
                        <button
                            onClick={submit}
                            disabled={saving || Object.keys(records).length === 0}
                            className="btn-primary"
                        >
                            {saving ? 'Saving…' : 'Save register'}
                        </button>
                    </div>
                    <div className="space-y-1">
                        {students.map((s) => {
                            const status = records[s.id];
                            return (
                                <div key={s.id} className="flex items-center justify-between p-2 bg-white/40 rounded-lg border border-white/40">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-sm">{s.name}</span>
                                        <p className="text-[10px] text-blue-500">{s.admissionNo || ''}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        {['present', 'late', 'absent', 'excused'].map((st) => (
                                            <button
                                                key={st}
                                                onClick={() => toggle(s.id, st)}
                                                className={`w-8 h-8 rounded-lg text-[10px] font-semibold border ${
                                                    status === st
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white/30 text-blue-600 border-white/40'
                                                }`}
                                            >
                                                {st === 'present' ? 'P' : st === 'late' ? 'L' : st === 'absent' ? 'A' : 'E'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {Object.keys(records).length > 0 && (
                        <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                            {Object.values(records).filter(Boolean).length} of {students.length} marked
                        </p>
                    )}
                </GlassCard>
            )}
            {selectedClass && students.length === 0 && (
                <GlassCard>
                    <p className="text-xs text-blue-500 text-center py-4">No students in this class.</p>
                </GlassCard>
            )}
        </div>
    );
}

