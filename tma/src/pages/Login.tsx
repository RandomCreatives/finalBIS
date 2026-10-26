import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Link2, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
    TelegramAuthError,
    fetchSubjectTeachers,
    initData,
    isTelegramEnvironment,
    linkAndSignInWithTelegram,
    signInWithTelegram,
    telegramUser,
} from '../auth/auth';
import type { SubjectTeacherOption } from '../auth/auth';
import { useTheme } from '../theme/ThemeContext';

type LinkMode = 'staff' | 'class' | 'subject';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user } = useAuth();
    const { isDark, toggleTheme } = useTheme();

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
    const iconUrl = `${import.meta.env.BASE_URL}favicon.svg`;

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

    useEffect(() => {
        if (user || attempted.current) return;
        attempted.current = true;
        if (!initData()) {
            setCheckingSession(false);
            if (!import.meta.env.DEV) {
                setError(
                    'This staff portal opens inside Telegram. Launch it from @bisnocbot to sign in.',
                );
            }
            return;
        }
        void handleTelegramSignIn();
    }, [user, handleTelegramSignIn]);

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

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 safe-area-top">
            <div className="w-full max-w-md glass-panel p-6">
                {/* Brand Header + Theme Toggle */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <img
                            src={iconUrl}
                            alt="BIS NOC"
                            className="w-12 h-12 rounded-2xl shadow-md shrink-0"
                        />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                                    BIS NOC Gerji
                                </h1>
                                <span className="inline-block w-2 h-2 rounded-full bg-[#95c11f] shrink-0" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                British International School · Staff Mini App
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={isDark ? 'Switch to light glass theme' : 'Switch to dark glass theme'}
                        className="w-9 h-9 rounded-xl glass-subcard flex items-center justify-center text-slate-600 dark:text-slate-200 shrink-0 active:scale-95 transition-transform"
                    >
                        {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-blue-700" />}
                    </button>
                </div>

                {/* Verified Telegram identity badge */}
                {tgUser && (
                    <div className="mt-4 p-3 glass-subcard flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600/15 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                            {tgUser.photo_url ? (
                                <img src={tgUser.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (tgUser.first_name || '?').charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {tgUser.first_name} {tgUser.last_name || ''}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {tgUser.username ? `@${tgUser.username}` : 'Telegram account'}
                                {tgIdLabel ? ` · id ${tgIdLabel}` : ''}
                            </p>
                        </div>
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    </div>
                )}

                {checkingSession ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Signing in with Telegram…
                        </p>
                    </div>
                ) : needsLinking ? (
                    <div className="mt-4">
                        <div className="p-3 rounded-xl flex items-start gap-2.5 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/25 text-slate-800 dark:text-blue-100">
                            <Link2 className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <div className="text-xs leading-relaxed">
                                <p className="font-semibold">Connect your BIS NOC account (one-time)</p>
                                <p className="opacity-85 mt-0.5">
                                    Sign in once below to link <span className="font-semibold">{tgHandle}</span>.
                                    Next time you open the Mini App, you&apos;ll sign in automatically.
                                </p>
                            </div>
                        </div>

                        {/* Role switcher */}
                        <div className="mt-4 grid grid-cols-3 gap-1 p-1 rounded-xl glass-subcard text-xs font-semibold">
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
                                    className={`py-2 px-2 rounded-lg transition-all text-center ${
                                        mode === key
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                                        <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                                            School email
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="mike@bisnoc.local"
                                            autoComplete="username"
                                            required
                                            className="glass-input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
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
                                                className="glass-input pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret((v) => !v)}
                                                aria-label={showSecret ? 'Hide password' : 'Show password'}
                                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400"
                                            >
                                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {mode === 'class' && (
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
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
                                            className="glass-input pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowSecret((v) => !v)}
                                            aria-label={showSecret ? 'Hide class password' : 'Show class password'}
                                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400"
                                        >
                                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        Your class card password identifies your homeroom automatically.
                                    </p>
                                </div>
                            )}

                            {mode === 'subject' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                                            Your name
                                        </label>
                                        <select
                                            value={teacherId}
                                            onChange={(e) => setTeacherId(e.target.value)}
                                            disabled={loadingTeachers || subjectTeachers.length === 0}
                                            className="glass-input"
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
                                        <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
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
                                                className="glass-input pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret((v) => !v)}
                                                aria-label={showSecret ? 'Hide password' : 'Show password'}
                                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400"
                                            >
                                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="p-2.5 rounded-xl text-xs font-medium bg-rose-500/12 dark:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-200">
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
                    <div className="mt-5">
                        {error && (
                            <div className="p-3 rounded-xl text-xs leading-relaxed mb-4 bg-rose-500/12 dark:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-200">
                                {error}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleTelegramSignIn}
                            disabled={loading || !insideTelegram}
                            className="btn-primary w-full"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? 'Signing in…' : 'Sign in with Telegram'}
                        </button>

                        {import.meta.env.DEV && !insideTelegram && (
                            <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-white/10 space-y-2">
                                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                                    Browser preview outside Telegram — explore the new glass UI &amp; 5-tab layout:
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNeedsLinking(true)}
                                        className="btn-glass w-full !py-2.5"
                                    >
                                        Preview Link Card
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const { DEV_PREVIEW_TOKEN, DEV_PREVIEW_USER } = await import(
                                                '../dev/previewMock'
                                            );
                                            finishLogin(DEV_PREVIEW_TOKEN, DEV_PREVIEW_USER);
                                        }}
                                        className="btn-primary w-full !py-2.5 !text-xs"
                                    >
                                        Open 5-Tab App
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
