import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Register the PWA shell only in production builds. This keeps the CRA
// development server and hot reload behavior untouched while allowing the
// production build to be installed on Android and desktop browsers.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {
            // Installation is optional; the web app remains fully usable.
        });
    });
}
