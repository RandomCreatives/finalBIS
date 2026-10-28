import { getToken } from '../api/client';

const BASE_URL = process.env.REACT_APP_API_URL || '';
const CHANNEL_NAME = 'bisnoc.liveSync';
const POLL_INTERVAL_MS = 20_000;
const FOCUS_THROTTLE_MS = 2_000;

const subscribers = new Set(); // { topics: Set<string>, callback: () => void }
let channel = null;
let started = false;
let intervalId = null;
let lastPollAt = 0;
let inFlight = null;
let lastVersions = null;

function ensureChannel() {
    if (channel || typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
        return channel;
    }
    try {
        channel = new window.BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event) => {
            const topics = event?.data?.topics;
            if (Array.isArray(topics) && topics.length > 0) {
                notifyLocalSubscribers(topics);
            }
        };
    } catch {
        channel = null;
    }
    return channel;
}

function normalizeTopics(topics) {
    if (!topics) return [];
    const arr = Array.isArray(topics) ? topics : [topics];
    return arr.map((t) => String(t).trim()).filter(Boolean);
}

function notifyLocalSubscribers(topics) {
    const normalized = normalizeTopics(topics);
    if (normalized.length === 0) return;
    const isAll = normalized.includes('all');

    subscribers.forEach((sub) => {
        if (isAll || sub.topics.has('all') || normalized.some((t) => sub.topics.has(t))) {
            try {
                sub.callback(normalized);
            } catch {
                // Keep notifying remaining listeners.
            }
        }
    });
}

/**
 * Broadcast an immediate sync event in this tab and across all same-origin
 * tabs/windows on this device.
 */
export function emitSyncEvent(topics = ['all']) {
    const normalized = normalizeTopics(topics);
    if (normalized.length === 0) return;
    notifyLocalSubscribers(normalized);

    const ch = ensureChannel();
    if (ch) {
        try {
            ch.postMessage({ topics: normalized, at: Date.now() });
        } catch {
            // Ignore closed/unavailable BroadcastChannel errors.
        }
    }
}

/**
 * Subscribe to one or more sync topics ('students', 'assignments', 'assessments', 'all').
 * Returns an unsubscribe function.
 */
export function subscribeSync(topics, callback) {
    const set = new Set(normalizeTopics(topics));
    if (set.size === 0 || typeof callback !== 'function') return () => {};
    ensureChannel();
    const entry = { topics: set, callback };
    subscribers.add(entry);
    return () => {
        subscribers.delete(entry);
    };
}

/**
 * Poll `/api/sync/version` once and emit topic updates for any server-side
 * changes made on other devices (Admin PC, Main Teacher tablet, TMA, SQL).
 */
export async function pollSyncVersionOnce({ force = false, fetchImpl } = {}) {
    if (typeof window === 'undefined') return null;
    const token = getToken();
    if (!token) {
        lastVersions = null;
        return null;
    }
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return null;
    }
    const now = Date.now();
    if (!force && now - lastPollAt < FOCUS_THROTTLE_MS) {
        return lastVersions;
    }
    if (inFlight) return inFlight;

    lastPollAt = now;
    const doFetch = fetchImpl || window.fetch?.bind(window);
    if (typeof doFetch !== 'function') return null;

    inFlight = (async () => {
        try {
            const response = await doFetch(`${BASE_URL}/api/sync/version`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                },
            });
            if (!response || !response.ok) return null;
            const next = await response.json();
            if (!next || typeof next !== 'object') return null;

            if (lastVersions) {
                const changed = [];
                if (next.studentsVersion && next.studentsVersion !== lastVersions.studentsVersion) {
                    changed.push('students');
                }
                if (next.assignmentsVersion && next.assignmentsVersion !== lastVersions.assignmentsVersion) {
                    changed.push('assignments', 'students');
                }
                if (next.assessmentsVersion && next.assessmentsVersion !== lastVersions.assessmentsVersion) {
                    changed.push('assessments');
                }
                if (next.assessmentMarksVersion && next.assessmentMarksVersion !== lastVersions.assessmentMarksVersion) {
                    changed.push('assessments');
                }
                if (next.marksheetsVersion && next.marksheetsVersion !== lastVersions.marksheetsVersion) {
                    changed.push('assessments');
                }
                lastVersions = next;
                if (changed.length > 0) {
                    emitSyncEvent([...new Set(changed)]);
                }
            } else {
                lastVersions = next;
            }
            return next;
        } catch {
            return null;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

/**
 * Start background cross-device version polling + focus/visibility refresh in
 * production/dev browsers (skipped automatically during Jest unit runs unless
 * explicitly invoked via `pollSyncVersionOnce`).
 */
export function initLiveSync() {
    if (started || typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'test') return;
    started = true;
    ensureChannel();

    const onWake = () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
            pollSyncVersionOnce();
        }
    };

    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onWake);
    }

    intervalId = window.setInterval(() => {
        pollSyncVersionOnce();
    }, POLL_INTERVAL_MS);

    // Seed baseline version immediately if already signed in.
    pollSyncVersionOnce({ force: true });
}

export function _resetLiveSyncForTests() {
    subscribers.clear();
    lastVersions = null;
    lastPollAt = 0;
    inFlight = null;
    if (intervalId && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
        intervalId = null;
    }
    started = false;
}
