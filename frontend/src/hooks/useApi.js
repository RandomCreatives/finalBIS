import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeSync } from '../utils/liveSync';

/**
 * Runs an async fetcher and tracks loading/error/data.
 * Returns `reload` (and `silentReload`) so mutations & live-sync events can
 * refresh the view without losing form state or flashing full-page spinners.
 *
 * `deps` controls re-fetching; the fetcher itself is intentionally not a
 * dependency so callers can pass an inline arrow without looping.
 *
 * Optional `options.syncTopic` ('students' | 'assignments' | 'assessments' | string[])
 * automatically refreshes in place whenever matching data changes locally or
 * on another device, and when a backgrounded tab/PWA returns to focus.
 */
export default function useApi(fetcher, deps = [], options = {}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const requestIdRef = useRef(0);
    const hasLoadedRef = useRef(false);

    const syncTopicKey = Array.isArray(options?.syncTopic)
        ? options.syncTopic.join('|')
        : (options?.syncTopic || '');

    const run = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const result = await fetcherRef.current();
            if (requestId === requestIdRef.current) {
                hasLoadedRef.current = true;
                setData(result);
            }
            return result;
        } catch (err) {
            if (requestId === requestIdRef.current) {
                setError(err.message || 'Failed to load data');
            }
            return undefined;
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    const silentReload = useCallback(async () => {
        if (!hasLoadedRef.current) return run();
        const requestId = ++requestIdRef.current;
        try {
            const result = await fetcherRef.current();
            if (requestId === requestIdRef.current) {
                setError(null);
                setData(result);
            }
            return result;
        } catch {
            // Preserve currently displayed data on transient background poll failure.
            return undefined;
        }
    }, [run]);

    useEffect(() => {
        let active = true;
        const requestId = ++requestIdRef.current;
        hasLoadedRef.current = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const result = await fetcher();
                if (active && requestId === requestIdRef.current) {
                    hasLoadedRef.current = true;
                    setData(result);
                }
            } catch (err) {
                if (active && requestId === requestIdRef.current) {
                    setError(err.message || 'Failed to load data');
                }
            } finally {
                if (active && requestId === requestIdRef.current) setLoading(false);
            }
        })();
        return () => {
            active = false;
            if (requestId === requestIdRef.current) requestIdRef.current += 1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    useEffect(() => {
        if (!syncTopicKey) return undefined;
        const topics = syncTopicKey.split('|').filter(Boolean);
        const unsub = subscribeSync(topics, () => {
            void silentReload();
        });

        const onVisible = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                void silentReload();
            }
        };
        if (typeof document !== 'undefined' && process.env.NODE_ENV !== 'test') {
            document.addEventListener('visibilitychange', onVisible);
        }
        return () => {
            unsub();
            if (typeof document !== 'undefined' && process.env.NODE_ENV !== 'test') {
                document.removeEventListener('visibilitychange', onVisible);
            }
        };
    }, [syncTopicKey, silentReload]);

    return { data, loading, error, reload: run, silentReload, setData };
}
