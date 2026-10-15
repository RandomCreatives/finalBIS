import { act, renderHook, waitFor } from '@testing-library/react';
import useLiveApi from '../hooks/useLiveApi';

const setVisibility = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

beforeEach(() => {
    jest.useFakeTimers();
    setVisibility('visible');
});

afterEach(() => {
    jest.useRealTimers();
    setVisibility('visible');
});

const advance = (ms) => act(async () => { jest.advanceTimersByTime(ms); });

describe('useLiveApi — data that keeps itself fresh', () => {
    test('loads, then refreshes silently: no spinner, the numbers never blank', async () => {
        let n = 0;
        const fetcher = jest.fn(async () => ({ n: ++n }));
        const { result } = renderHook(() => useLiveApi(fetcher, [], { intervalMs: 30_000 }));

        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
        expect(result.current.loading).toBe(false);
        expect(result.current.updatedAt).toBeInstanceOf(Date);

        await advance(30_000);
        await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
        expect(result.current.loading).toBe(false);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    test('a failed refresh keeps the last good data and says so', async () => {
        const fetcher = jest.fn()
            .mockResolvedValueOnce({ ok: 1 })
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue({ ok: 3 });
        const { result } = renderHook(() => useLiveApi(fetcher, [], { intervalMs: 30_000 }));
        await waitFor(() => expect(result.current.data).toEqual({ ok: 1 }));

        await advance(30_000);
        await waitFor(() => expect(result.current.stale).toBe(true));
        expect(result.current.data).toEqual({ ok: 1 });
        expect(result.current.error).toBeNull();

        await advance(30_000);
        await waitFor(() => expect(result.current.data).toEqual({ ok: 3 }));
        expect(result.current.stale).toBe(false);
    });

    test('pauses while the tab is hidden and catches up when it is back', async () => {
        const fetcher = jest.fn(async () => 'fresh');
        renderHook(() => useLiveApi(fetcher, [], { intervalMs: 30_000 }));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

        setVisibility('hidden');
        await advance(120_000);
        expect(fetcher).toHaveBeenCalledTimes(1);

        setVisibility('visible');
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    });

    test('live: false loads once and never polls', async () => {
        const fetcher = jest.fn(async () => 'static');
        renderHook(() => useLiveApi(fetcher, [], { live: false }));
        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
        await advance(300_000);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    test('a late answer for old inputs never overwrites the new ones', async () => {
        let finishOld;
        const old = new Promise((resolve) => { finishOld = resolve; });
        const { result, rerender } = renderHook(
            ({ day }) => useLiveApi(() => (day === 'mon' ? old : Promise.resolve('tue')), [day], { live: false }),
            { initialProps: { day: 'mon' } },
        );

        rerender({ day: 'tue' });
        await waitFor(() => expect(result.current.data).toBe('tue'));
        await act(async () => { finishOld('mon'); });
        expect(result.current.data).toBe('tue');
    });
});
