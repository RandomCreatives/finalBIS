import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { api } from '../api/api';

export default function Marks() {
    const [loading, setLoading] = useState(true);
    const [marksheets, setMarksheets] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/marksheets')
            .then((data) => setMarksheets(data.marksheets || []))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load marks'))
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
                <h1 className="text-xl font-bold">Marks</h1>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">{marksheets.length}</span>
            </div>

            {marksheets.length === 0 ? (
                <GlassCard>
                    <p className="text-xs text-blue-500 text-center py-6">No marksheets yet.</p>
                </GlassCard>
            ) : (
                <div className="space-y-3">
                    {marksheets.map((m) => (
                        <GlassCard key={m.id} className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <span className="font-semibold text-sm">{m.subject?.name || 'Subject'}</span>
                                    <p className="text-[10px] text-blue-500">
                                        {m.class?.name || 'Class'} · {m.term?.name || 'Term'}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">
                                    {m.percentage != null ? `${m.percentage}%` : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/40 text-xs">
                                <span className="text-blue-500">{m.student?.name || 'Student'}</span>
                                <span className="font-semibold">{m.marks != null ? `${m.marks} / ${m.maxMarks || 100}` : '—'}</span>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}

