import { useEffect, useRef } from 'react';
import { api } from '../api/api';
import { emitSyncEvent, subscribeSync, type SyncTopic } from '../utils/syncEvents';

const POLL_INTERVAL_MS = 20_000;
let subscriberCount = 0;
let timer: number | null = null;
let lastVersions: Record<string, string> | null = null;
let inFlight: Promise<void> | null = null;
let removeWakeListeners: (() => void) | null = null;

async function pollVersions() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const next = await api.get('/sync/version');
            if (!next || typeof next !== 'object') return;

            if (lastVersions) {
                const changed: string[] = [];
                if (next.studentsVersion && next.studentsVersion !== lastVersions.studentsVersion) {
                    changed.push('students');
                }
                if (next.assignmentsVersion && next.assignmentsVersion !== lastVersions.assignmentsVersion) {
                    changed.push('assignments', 'students');
                }
                if (
                    (next.assessmentsVersion && next.assessmentsVersion !== lastVersions.assessmentsVersion)
                    || (next.assessmentMarksVersion && next.assessmentMarksVersion !== lastVersions.assessmentMarksVersion)
                    || (next.marksheetsVersion && next.marksheetsVersion !== lastVersions.marksheetsVersion)
                ) {
                    changed.push('assessments');
                }
                lastVersions = next as Record<string, string>;
                if (changed.length > 0) emitSyncEvent([...new Set(changed)]);
            } else {
                lastVersions = next as Record<string, string>;
            }
        } catch {
            // Offline and local preview modes keep their current screen state.
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

function startPolling() {
    if (timer !== null || typeof window === 'undefined') return;
    void pollVersions(); // First request seeds a baseline; changes are emitted on later polls.
    timer = window.setInterval(() => void pollVersions(), POLL_INTERVAL_MS);

    const onWake = () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
            void pollVersions();
        }
    };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    removeWakeListeners = () => {
        window.removeEventListener('focus', onWake);
        window.removeEventListener('online', onWake);
        document.removeEventListener('visibilitychange', onWake);
    };
}

function stopPolling() {
    if (timer !== null && typeof window !== 'undefined') {
        window.clearInterval(timer);
        timer = null;
    }
    removeWakeListeners?.();
    removeWakeListeners = null;
    lastVersions = null;
}

/** Refresh one or more panels when any device adds or changes server data. */
export function useLiveSync(topics: SyncTopic | SyncTopic[], refresh: () => void) {
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    const topicKey = (Array.isArray(topics) ? topics : [topics]).join('|');

    useEffect(() => {
        const unsubscribe = subscribeSync(topicKey.split('|'), () => refreshRef.current());
        subscriberCount += 1;
        if (subscriberCount === 1) startPolling();

        return () => {
            unsubscribe();
            subscriberCount = Math.max(0, subscriberCount - 1);
            if (subscriberCount === 0) stopPolling();
        };
    }, [topicKey]);
}
