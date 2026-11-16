import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeSync } from '../utils/liveSync';

/**
 * In-memory cache for API responses to reduce Supabase egress bandwidth.
 * Key: cacheKey string, Value: { data, expiry }
 */
const apiCache = new Map();

/**
 * Clear a specific cache entry (or all entries when called with no args).
 */
export const clearApiCache = (cacheKey = null) => {
    if (cacheKey) apiCache.delete(cacheKey);
    else apiCache.clear();
};

/**
 * Runs an async fetcher and tracks loading/error/data.
 * Returns `reload` (and `silentReload`) so mutations & live-sync events can
 * refresh the view without losing form state or flashing full-page spinners.
 *
 * `deps` controls re-fetching; the fetcher itself is intentionally not a
 * dependency so callers can pass an inline arrow without looping.
 *
 * Optional options:
 * - `options.syncTopic` ('students' | 'assignments' | 'assessments' | string[])
 *   automatically refreshes in place whenever matching data changes locally or
 *   on another device, and when a backgrounded tab/PWA returns to focus.
 * - `options.cacheKey` (string) - when set, caches the fetched response so
 *   repeated calls within the TTL skip the Supabase round-trip entirely.
 * - `options.cacheTtl` (ms, default 300000 = 5 min) - how long a cached
 *   response is considered fresh.
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
    const cacheKey = options.cacheKey || null;
    const cacheTtl = options.cacheTtl ?? 5 * 60 * 1000;

    const cached = cacheKey ? apiCache.get(cacheKey) : null;
    const isCacheFresh = cached && cached.expiry > Date.now();

    const run = useCallback(async () => {
        if (isCacheFresh) {
            setLoading(false);
            setError(null);
            hasLoadedRef.current = true;
            setData(cached.data);
            return cached.data;
        }

        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const result = await fetcherRef.current();
            if (requestId === requestIdRef.current) {
                hasLoadedRef.current = true;
                setData(result);
                if (cacheKey) {
                    apiCache.set(cacheKey, { data: result, expiry: Date.now() + cacheTtl });
                }
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
                if (cacheKey) {
                    apiCache.set(cacheKey, { data: result, expiry: Date.now() + cacheTtl });
                }
            }
            return result;
        } catch {
            return undefined;
        }
    }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let active = true;
        const requestId = ++requestIdRef.current;
        hasLoadedRef.current = false;
        setLoading(true);
        setError(null);
        (async () => {
            if (isCacheFresh) {
                if (active && requestId === requestIdRef.current) {
                    hasLoadedRef.current = true;
                    setLoading(false);
                    setError(null);
                    setData(cached.data);
                }
                return;
            }
            try {
                const result = await fetcher();
                if (active && requestId === requestIdRef.current) {
                    hasLoadedRef.current = true;
                    setData(result);
                    if (cacheKey) {
                        apiCache.set(cacheKey, { data: result, expiry: Date.now() + cacheTtl });
                    }
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
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!syncTopicKey) return undefined;
        const topics = syncTopicKey.split('|').filter(Boolean);
        const unsub = subscribeSync(topics, () => {
            if (cacheKey) apiCache.delete(cacheKey);
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
    }, [syncTopicKey, silentReload, cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading, error, reload: run, silentReload, setData };
}
