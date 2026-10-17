import { pushApi } from '../api/endpoints';

/** Public VAPID key the browser needs to subscribe. Set at build time. */
const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || null;

const urlBase64ToUint8Array = (base64String) => {
    if (!base64String) return null;
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String || '').replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64 + padding);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

/** Is this browser+device able to receive push notifications at all? */
export const isPushSupported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

/** Current subscription state: unsupported | denied | default | granted | subscribed */
export const subscriptionState = async () => {
    if (!isPushSupported()) return 'unsupported';
    const permission = Notification.permission;
    if (permission === 'denied') return 'denied';
    if (permission === 'default') return 'default';
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription ? 'subscribed' : 'granted';
    } catch {
        return 'granted';
    }
};

/** Ask permission, subscribe via the Push API, register with the backend. */
export const subscribePush = async () => {
    if (!applicationServerKey) {
        throw new Error('Push notifications are not configured on this server.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.');
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
    });
    const key = (name) => {
        const raw = subscription.getKey(name);
        return raw ? btoa(String.fromCharCode(...new Uint8Array(raw))) : null;
    };
    await pushApi.subscribe({
        endpoint: subscription.endpoint,
        keys: { p256dh: key('p256dh'), auth: key('auth') },
    });
    return subscription;
};

/** Unsubscribe everywhere and delete the backend record. */
export const unsubscribePush = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        try {
            await pushApi.unsubscribe({ endpoint: subscription.endpoint });
        } catch {
            // Best effort: clear locally even if the server call fails.
        }
        await subscription.unsubscribe();
    }
};

export { vapidPublicKey };
