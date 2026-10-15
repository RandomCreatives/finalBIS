import { useCallback, useEffect, useRef, useState } from 'react';

export const LIVE_REFRESH_MS = 30_000;
const RETURN_REFRESH_GAP_MS = 5_000;

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * useApi that keeps itself up to date.
 *
 * Loads like useApi, then re-fetches every `intervalMs` while the page is
 * visible, straight away when the tab comes back into view or the device
 * reconnects, and on demand via `refresh()`.
 *
 * Background refreshes are silent: what's on screen stays put (no spinner)
 * and is swapped when the new answer arrives. A failed background refresh
 * keeps the last good data and sets `stale`, so a flaky connection never
 * blanks the page. Answers that arrive after a newer request are dropped.
 *
 * Returns useApi's shape — { data, loading, error, reload, setData } — plus
 * { refresh, refreshing, updatedAt, stale }.
 */
export default function useLiveApi(fetcher, deps = [], { intervalMs = LIVE_REFRESH_MS, live = true } = {}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [stale, setStale] = useState(false);

    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const latest = useRef(0); // id of the newest request
    const busy = useRef(false);
    const lastDone = useRef(0);

    const load = useCallback(async (silent) => {
        if (silent && busy.current) return; // never pile up on a slow network
        const id = ++latest.current;
        busy.current = true;
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
            setError(null);
        }
        try {
            const result = await fetcherRef.current();
            if (id !== latest.current) return;
            setData(result);
            setError(null);
            setStale(false);
            setUpdatedAt(new Date());
        } catch (err) {
            if (id !== latest.current) return;
            if (silent) setStale(true);
            else setError(err.message || 'Failed to load data');
        } finally {
            if (id === latest.current) {
                busy.current = false;
                lastDone.current = Date.now();
                setRefreshing(false);
                if (!silent) setLoading(false);
            }
        }
    }, []);

    // (Re)load when the inputs change; answers for old inputs are dropped.
    useEffect(() => {
        load(false);
        return () => {
            latest.current += 1;
            busy.current = false;
        };
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep fresh while visible; catch up when the user comes back.
    useEffect(() => {
        if (!live || !intervalMs) return undefined;

        const tick = () => { if (pageVisible()) load(true); };
        const onReturn = () => {
            if (pageVisible() && Date.now() - lastDone.current > RETURN_REFRESH_GAP_MS) load(true);
        };

        const timer = setInterval(tick, intervalMs);
        document.addEventListener('visibilitychange', onReturn);
        window.addEventListener('focus', onReturn);
        window.addEventListener('online', onReturn);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onReturn);
            window.removeEventListener('focus', onReturn);
            window.removeEventListener('online', onReturn);
        };
    }, [live, intervalMs, load]);

    const refresh = useCallback(() => load(true), [load]);
    const reload = useCallback(() => load(false), [load]);

    return { data, loading, error, reload, setData, refresh, refreshing, updatedAt, stale };
}
