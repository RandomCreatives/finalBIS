import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { api } from '../api/api';
import { MessageCircle } from 'lucide-react';

export default function Messages() {
    const [loading, setLoading] = useState(true);
    const [threads, setThreads] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/threads')
            .then((data) => setThreads(data.threads || []))
            .catch((e) => setError(e instanceof Error ? e.message : 'Could not load messages'))
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
                <h1 className="text-xl font-bold">Messages</h1>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md">{threads.length}</span>
            </div>

            {threads.length === 0 ? (
                <GlassCard>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <MessageCircle className="w-10 h-10 text-bis-200 mx-auto mb-2" />
                        <p className="text-xs text-blue-500">No conversations yet.</p>
                    </div>
                </GlassCard>
            ) : (
                <div className="space-y-2">
                    {threads.map((t) => (
                        <GlassCard key={t.id} className="mb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm">{t.subject || 'Conversation'}</span>
                                    <p className="text-[10px] text-blue-500 truncate">
                                        {t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : 'General'}
                                    </p>
                                </div>
                                <span className="text-[10px] text-blue-500">
                                    {t.lastMessageAt || t.createdAt
                                        ? new Date(t.lastMessageAt || t.createdAt).toLocaleDateString()
                                        : ''}
                                    {t.unreadCount ? ` · ${t.unreadCount} unread` : ''}
                                </span>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}

