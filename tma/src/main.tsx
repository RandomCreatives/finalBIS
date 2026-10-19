import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { initTelegram } from './auth/auth';

// The app is deployed under /tma/ (Vite's base). Vite exposes it as
// import.meta.env.BASE_URL, which always ends with a slash; React Router's
// basename must not.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

initTelegram();

ReactDOM.createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <BrowserRouter basename={basename}>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
);
