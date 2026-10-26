import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Link2, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
    TelegramAuthError,
    fetchSubjectTeachers,
    initData,
    isDarkColorScheme,
    isTelegramEnvironment,
    linkAndSignInWithTelegram,
    signInWithTelegram,
    telegramUser,
} from '../auth/auth';
import type { SubjectTeacherOption } from '../auth/auth';

type LinkMode = 'staff' | 'class' | 'subject';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user } = useAuth();

    const [checkingSession, setCheckingSession] = useState(() => Boolean(initData()));
    const [loading, setLoading] = useState(false);
    const [needsLinking, setNeedsLinking] = useState(false);
    const [unlinkedDetails, setUnlinkedDetails] = useState<{
        telegramId?: string;
        username?: string | null;
    } | null>(null);
    const [error, setError] = useState('');

    // One-time linking form state
    const [mode, setMode] = useState<LinkMode>('staff');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [classPassword, setClassPassword] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacherOption[]>([]);
    const [loadingTeachers, setLoadingTeachers] = useState(false);

    const attempted = useRef(false);

    const tgUser = telegramUser();
    const insideTelegram = isTelegramEnvironment();
    const dark = isDarkColorScheme();

    const finishLogin = useCallback(
        (token: string, nextUser: Parameters<typeof login>[1]) => {
            login(token, nextUser);
            const from = (location.state as { from?: string } | null)?.from;
            navigate(from && from !== '/login' ? from : '/', { replace: true });
        },
        [login, navigate, location.state],
    );

    const handleTelegramSignIn = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await signInWithTelegram();
            finishLogin(data.token, data.user);
        } catch (err) {
            if (err instanceof TelegramAuthError && err.code === 'TELEGRAM_NOT_LINKED') {
                setNeedsLinking(true);
                setUnlinkedDetails(err.details ?? null);
                setError('');
            } else {
                setError(err instanceof Error ? err.message : 'Sign-in failed');
            }
        } finally {
            setLoading(false);
            setCheckingSession(false);
        }
    }, [finishLogin]);

    // Inside Telegram the signed initData is already available, so sign in
    // automatically on launch.
    useEffect(() => {
        if (user || attempted.current) return;
        attempted.current = true;
        if (!initData()) {
            setCheckingSession(false);
            setError(
                'This staff portal opens inside Telegram. Launch it from @bisnocbot to sign in.',
            );
            return;
        }
        void handleTelegramSignIn();
    }, [user, handleTelegramSignIn]);

    // Lazy-load Subject Teacher options only if the Subject Teacher tab is opened.
    useEffect(() => {
        if (mode !== 'subject' || subjectTeachers.length > 0 || loadingTeachers) return;
        setLoadingTeachers(true);
        fetchSubjectTeachers()
            .then((list) => {
                setSubjectTeachers(list);
                if (list.length > 0 && !teacherId) setTeacherId(list[0].id);
            })
            .finally(() => setLoadingTeachers(false));
    }, [mode, subjectTeachers.length, loadingTeachers, teacherId]);

    if (user) return <Navigate to="/" replace />;

    const handleLinkSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');

        try {
            const payload =
                mode === 'class'
                    ? { classPassword: classPassword.trim() }
                    : mode === 'subject'
                        ? { teacherId, password }
                        : { email: email.trim(), password };

            const data = await linkAndSignInWithTelegram(payload);
            finishLogin(data.token, data.user);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not link account');
        } finally {
            setLoading(false);
        }
    };

    const canSubmitLink =
        insideTelegram &&
        !loading &&
        (mode === 'class'
            ? classPassword.trim().length > 0
            : mode === 'subject'
                ? Boolean(teacherId) && password.length > 0
                : email.trim().length > 0 && password.length > 0);

    const tgHandle =
        tgUser?.username
            ? `@${tgUser.username}`
            : unlinkedDetails?.username
                ? `@${unlinkedDetails.username}`
                : tgUser?.first_name || 'your Telegram account';

    const tgIdLabel = tgUser?.id
        ? String(tgUser.id)
        : unlinkedDetails?.telegramId || null;

    const pageBg = dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
    const cardCls = dark
        ? 'bg-slate-900/95 border border-slate-800 text-slate-100 shadow-2xl'
        : 'bg-white border border-slate-200 text-slate-900 shadow-xl';
    const subCardCls = dark
        ? 'bg-slate-800/80 border border-slate-700/80'
        : 'bg-slate-50 border border-slate-200';
    const tabBarCls = dark ? 'bg-slate-800/90 p-1' : 'bg-slate-100 p-1';
    const activeTabCls = dark
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-white text-blue-700 shadow-sm';
    const inactiveTabCls = dark
        ? 'text-slate-300 hover:text-white'
        : 'text-slate-600 hover:text-slate-900';
    const inputCls = dark
        ? 'w-full rounded-xl px-3.5 py-2.5 text-sm bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
        : 'w-full rounded-xl px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent';
    const mutedCls = dark ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom ${pageBg}`}>
            <div className={`w-full max-w-md rounded-2xl p-6 ${cardCls}`}>
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-base shadow-md">
                        BIS
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight">BIS NOC</h1>
                        <p className={`text-xs ${mutedCls}`}>Staff Mini App · Gerji Campus</p>
                    </div>
                </div>

                {/* Verified Telegram identity badge */}
                {tgUser && (
                    <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 ${subCardCls}`}>
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600/15 text-blue-500 flex items-center justify-center font-bold shrink-0">
                            {tgUser.photo_url ? (
                                <img src={tgUser.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (tgUser.first_name || '?').charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                                {tgUser.first_name} {tgUser.last_name || ''}
                            </p>
                            <p className={`text-xs truncate ${mutedCls}`}>
                                {tgUser.username ? `@${tgUser.username}` : 'Telegram account'}
                                {tgIdLabel ? ` · id ${tgIdLabel}` : ''}
                            </p>
                        </div>
                    </div>
                )}

                {/* Initial auto-sign-in spinner */}
                {checkingSession ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                        <p className={`text-xs font-medium ${mutedCls}`}>Signing in with Telegram…</p>
                    </div>
                ) : needsLinking ? (
                    /* One-step in-Mini-App BIS account linking */
                    <div className="mt-4">
                        <div className={`p-3 rounded-xl flex items-start gap-2.5 ${
                            dark
                                ? 'bg-blue-950/60 border border-blue-800/70 text-blue-200'
                                : 'bg-blue-50 border border-blue-200 text-blue-900'
                        }`}>
                            <Link2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                            <div className="text-xs leading-relaxed">
                                <p className="font-semibold">Connect your BIS NOC account (one-time)</p>
                                <p className="opacity-85 mt-0.5">
                                    Sign in once below to link <span className="font-semibold">{tgHandle}</span>.
                                    Next time you open the Mini App, you&apos;ll be signed in automatically.
                                </p>
                            </div>
                        </div>

                        {/* Role switcher */}
                        <div className={`mt-4 grid grid-cols-3 gap-1 rounded-xl text-xs font-semibold ${tabBarCls}`}>
                            {(
                                [
                                    ['staff', 'Admin / Staff'],
                                    ['class', 'Main Teacher'],
                                    ['subject', 'Subject'],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        setMode(key);
                                        setError('');
                                    }}
                                    className={`py-2 px-2 rounded-lg transition-colors text-center ${
                                        mode === key ? activeTabCls : inactiveTabCls
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleLinkSubmit} className="mt-4 space-y-3">
                            {mode === 'staff' && (
                                <>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-1 ${mutedCls}`}>
                                            School email
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="mike@bisnoc.local"
                                            autoComplete="username"
                                            required
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-1 ${mutedCls}`}>
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecret ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                autoComplete="current-password"
                                                required
                                                className={`${inputCls} pr-10`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret((v) => !v)}
                                                aria-label={showSecret ? 'Hide password' : 'Show password'}
                                                className={`absolute inset-y-0 right-0 px-3 flex items-center ${mutedCls}`}
                                            >
                                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {mode === 'class' && (
                                <div>
                                    <label className={`block text-xs font-semibold mb-1 ${mutedCls}`}>
                                        Class password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showSecret ? 'text' : 'password'}
                                            value={classPassword}
                                            onChange={(e) => setClassPassword(e.target.value)}
                                            placeholder="e.g. year 4 magenta"
                                            autoComplete="current-password"
                                            required
                                            className={`${inputCls} pr-10`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSecret((v) => !v)}
                                            aria-label={showSecret ? 'Hide class password' : 'Show class password'}
                                            className={`absolute inset-y-0 right-0 px-3 flex items-center ${mutedCls}`}
                                        >
                                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className={`mt-1.5 text-[11px] ${mutedCls}`}>
                                        Your class card password identifies your homeroom automatically.
                                    </p>
                                </div>
                            )}

                            {mode === 'subject' && (
                                <>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-1 ${mutedCls}`}>
                                            Your name
                                        </label>
                                        <select
                                            value={teacherId}
                                            onChange={(e) => setTeacherId(e.target.value)}
                                            disabled={loadingTeachers || subjectTeachers.length === 0}
                                            className={inputCls}
                                        >
                                            {loadingTeachers ? (
                                                <option value="">Loading teachers…</option>
                                            ) : subjectTeachers.length === 0 ? (
                                                <option value="">No subject teachers found</option>
                                            ) : (
                                                subjectTeachers.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.name}
                                                        {t.subjects?.length
                                                            ? ` (${t.subjects.map((s) => s.code).join(', ')})`
                                                            : ''}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-1 ${mutedCls}`}>
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecret ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                autoComplete="current-password"
                                                required
                                                className={`${inputCls} pr-10`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret((v) => !v)}
                                                aria-label={showSecret ? 'Hide password' : 'Show password'}
                                                className={`absolute inset-y-0 right-0 px-3 flex items-center ${mutedCls}`}
                                            >
                                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className={`p-2.5 rounded-xl text-xs font-medium ${
                                    dark
                                        ? 'bg-rose-950/70 border border-rose-800/70 text-rose-200'
                                        : 'bg-rose-50 border border-rose-200 text-rose-700'
                                }`}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!canSubmitLink}
                                className="btn-primary w-full mt-1"
                            >
                                {loading ? 'Linking & signing in…' : 'Link Telegram & Sign in'}
                            </button>
                        </form>
                    </div>
                ) : (
                    /* Fallback when opened outside Telegram or when verification needs a retry */
                    <div className="mt-5">
                        {error && (
                            <div className={`p-3 rounded-xl text-xs leading-relaxed mb-4 ${
                                dark
                                    ? 'bg-rose-950/70 border border-rose-800/70 text-rose-200'
                                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                            }`}>
                                {error}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleTelegramSignIn}
                            disabled={loading || !insideTelegram}
                            className={`btn-primary w-full gap-2 ${loading || !insideTelegram ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? 'Signing in…' : 'Sign in with Telegram'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
