import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async fetcher and tracks loading/error/data.
 * Returns `reload` so mutations can refresh the view.
 *
 * `deps` controls re-fetching; the fetcher itself is intentionally not a
 * dependency so callers can pass an inline arrow without looping.
 */
export default function useApi(fetcher, deps = []) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const run = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await fetcherRef.current());
        } catch (err) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await fetcher();
                if (active) setData(result);
            } catch (err) {
                if (active) setError(err.message || 'Failed to load data');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, loading, error, reload: run, setData };
}
