export type SyncTopic = 'students' | 'assignments' | 'assessments' | 'all' | string;

type Subscriber = {
    topics: Set<string>;
    callback: (topics: string[]) => void;
};

const CHANNEL_NAME = 'bisnoc.liveSync';
const subscribers = new Set<Subscriber>();
let channel: BroadcastChannel | null = null;

function normalize(topics: SyncTopic | SyncTopic[]): string[] {
    return (Array.isArray(topics) ? topics : [topics])
        .map((topic) => String(topic).trim())
        .filter(Boolean);
}

function notify(topics: string[]) {
    const all = topics.includes('all');
    subscribers.forEach((subscriber) => {
        if (all || subscriber.topics.has('all') || topics.some((topic) => subscriber.topics.has(topic))) {
            try {
                subscriber.callback(topics);
            } catch {
                // Do not block other listeners if one screen's refresh fails.
            }
        }
    });
}

function ensureChannel(): BroadcastChannel | null {
    if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return channel;
    try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<{ topics?: string[] }>) => {
            if (Array.isArray(event.data?.topics)) notify(event.data.topics);
        };
    } catch {
        channel = null;
    }
    return channel;
}

/** Publish a local + same-device cross-tab sync event. */
export function emitSyncEvent(topics: SyncTopic | SyncTopic[]) {
    const clean = normalize(topics);
    if (clean.length === 0) return;
    notify(clean);
    try {
        ensureChannel()?.postMessage({ topics: clean, at: Date.now() });
    } catch {
        // BroadcastChannel is an optimization; cross-device polling is the fallback.
    }
}

export function subscribeSync(topics: SyncTopic | SyncTopic[], callback: Subscriber['callback']) {
    const clean = new Set(normalize(topics));
    if (clean.size === 0) return () => {};
    ensureChannel();
    const subscriber = { topics: clean, callback };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
}

/** A small pure helper also used by the TMA tests and mutation interceptor. */
export function topicsForMutation(path: string): string[] {
    if (/^\/(students|student-requests)(\/|\?|$)/.test(path)) return ['students'];
    if (/^\/(assignments|classes)(\/|\?|$)/.test(path)) return ['assignments', 'students'];
    if (/^\/(assessments|marksheets)(\/|\?|$)/.test(path)) return ['assessments'];
    return [];
}
