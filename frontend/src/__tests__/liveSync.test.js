import { act, renderHook, waitFor } from '@testing-library/react';
import useApi from '../hooks/useApi';
import { emitSyncEvent, pollSyncVersionOnce, subscribeSync, _resetLiveSyncForTests } from '../utils/liveSync';

beforeEach(() => {
    _resetLiveSyncForTests();
    localStorage.setItem('bisnoc.token', 'test-token');
});

afterEach(() => {
    _resetLiveSyncForTests();
    localStorage.removeItem('bisnoc.token');
});

describe('live data synchronization', () => {
    test('a successful in-app write immediately refreshes subscribed rosters', async () => {
        let revision = 1;
        const fetcher = jest.fn(async () => ({ revision }));
        const { result } = renderHook(() => useApi(fetcher, [], { syncTopic: 'students' }));

        await waitFor(() => expect(result.current.data).toEqual({ revision: 1 }));
        revision = 2;
        await act(async () => { emitSyncEvent('students'); });

        await waitFor(() => expect(result.current.data).toEqual({ revision: 2 }));
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    test('cross-device version changes notify roster and marks subscribers', async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeSync(['students', 'assessments'], listener);
        const fetchImpl = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    studentsVersion: 's1',
                    assignmentsVersion: 'a1',
                    assessmentsVersion: 'c1',
                    assessmentMarksVersion: 'm1',
                    marksheetsVersion: 'r1',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    studentsVersion: 's2',
                    assignmentsVersion: 'a1',
                    assessmentsVersion: 'c1',
                    assessmentMarksVersion: 'm2',
                    marksheetsVersion: 'r1',
                }),
            });

        await pollSyncVersionOnce({ force: true, fetchImpl });
        expect(listener).not.toHaveBeenCalled();
        await pollSyncVersionOnce({ force: true, fetchImpl });

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(['students', 'assessments']);
        unsubscribe();
    });
});
