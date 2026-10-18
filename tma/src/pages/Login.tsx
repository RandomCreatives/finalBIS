import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { signInWithTelegram, initTelegram, telegramUser, themeColor } from '../auth/auth';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const tgUser = telegramUser();

    const handleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await signInWithTelegram();
            localStorage.setItem('tma_token', data.token);
            login(data.token, data.user);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
        } finally {
            setLoading(false);
        }
    };

    const primary = themeColor('bg_color', '#ffffff');
    const text = themeColor('text_color', '#000000');

    initTelegram();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
            <div className="glass-panel w-full max-w-md p-6" style={{ color: text, background: primary }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                        BIS
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">BIS NOC</h1>
                        <p className="text-xs opacity-70">Staff Portal · Gerji Campus</p>
                    </div>
                </div>

                {tgUser && (
                    <div className="mt-4 p-3 rounded-xl bg-white/40 border border-white/30 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/40">
                            <img src={tgUser.photo_url || ''} alt="avatar" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{tgUser.first_name} {tgUser.last_name || ''}</p>
                            <p className="text-xs opacity-60">@{tgUser.username}</p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSignIn}
                    disabled={loading}
                    className={`btn-primary mt-6 w-full ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Signing in…' : 'Sign in with Telegram'}
                </button>

                {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
                <p className="mt-4 text-xs opacity-50 text-center">
                    Your Telegram account must be linked to a staff account by an administrator first.
                </p>
            </div>
        </div>
    );
}

