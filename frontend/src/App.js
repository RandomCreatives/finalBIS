import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';

import { ThemeProvider } from './theme';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './components/AppLayout';
import { WindowManagerProvider } from './context/WindowManager';

import Landing from './pages/Landing';
import DataCenter from './pages/DataCenter';
import Login from './pages/Login';

export default function App() {
    return (
        <ThemeProvider>
            <CssBaseline />
            <BrowserRouter>
                <AuthProvider>
                    <WindowManagerProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />

                            <Route
                                path="/app"
                                element={
                                    <RequireAuth>
                                        <AppLayout />
                                    </RequireAuth>
                                }
                            />

                            <Route path="/" element={<Landing />} />
                            <Route path="/data-center" element={<DataCenter />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </WindowManagerProvider>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}