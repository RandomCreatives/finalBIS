import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { api } from '../api/api';

export default function Students() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/students')
            .then((data) => setStudents(data.students || []))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load students'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="p-4"><div className="h-24 rounded-xl bg-blue-100 animate-pulse" /></div>;
    }

    if (error) {
        return (
            <div className="p-4">
                <GlassCard>
                    <span className="text-sm text-rose-700">{error}</span>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="p-4 safe-area-bottom">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold">Students</h1>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">{students.length}</span>
            </div>

            {students.length === 0 ? (
                <GlassCard>
                    <p className="text-xs text-blue-500 text-center py-6">No students.</p>
                </GlassCard>
            ) : (
                <div className="space-y-2">
                    {students.map((s) => (
                        <GlassCard key={s.id} className="mb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm">{s.name}</span>
                                    <p className="text-[10px] text-blue-500 truncate">
                                        {s.admissionNo || ''} · {s.class?.name || 'No class'}
                                    </p>
                                </div>
                                <span className="text-[10px] font-semibold">
                                    {s.specialNeeds ? 'SEN' : ''}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[10px] text-blue-500">
                                <span>{s.guardianName || '—'}</span>
                                <span className="w-px h-3 bg-bis-300 mx-1" />
                                <span>{s.guardianPhone || '—'}</span>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}

