import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
    initData,
    isTelegramEnvironment,
    signInWithTelegram,
    telegramUser,
    themeColor,
} from '../auth/auth';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const attempted = useRef(false);

    const tgUser = telegramUser();
    const insideTelegram = isTelegramEnvironment();

    const handleSignIn = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await signInWithTelegram();
            login(data.token, data.user);
            const from = (location.state as { from?: string } | null)?.from;
            navigate(from && from !== '/login' ? from : '/', { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
        } finally {
            setLoading(false);
        }
    }, [login, navigate, location.state]);

    // Inside Telegram the signed initData is already available, so sign in
    // without an extra tap. Outside Telegram there is nothing to sign with.
    useEffect(() => {
        if (user || attempted.current) return;
        attempted.current = true;
        if (!initData()) {
            setError(
                'This staff portal opens inside Telegram. Launch it from the BIS NOC bot to sign in.',
            );
            return;
        }
        void handleSignIn();
    }, [user, handleSignIn]);

    if (user) return <Navigate to="/" replace />;

    const primary = themeColor('bg_color', '#ffffff');
    const text = themeColor('text_color', '#000000');

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
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/40 bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                            {tgUser.photo_url ? (
                                <img src={tgUser.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (tgUser.first_name || '?').charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                                {tgUser.first_name} {tgUser.last_name || ''}
                            </p>
                            <p className="text-xs opacity-60 truncate">
                                {tgUser.username ? `@${tgUser.username}` : 'Telegram account'}
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSignIn}
                    disabled={loading || !insideTelegram}
                    className={`btn-primary mt-6 w-full ${loading || !insideTelegram ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Signing in…' : 'Sign in with Telegram'}
                </button>

                {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
                <p className="mt-4 text-xs opacity-50 text-center">
                    Your Telegram account must be linked to an active staff account by an administrator
                    first.
                </p>
            </div>
        </div>
    );
}
