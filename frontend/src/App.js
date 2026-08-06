import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';

import theme from './theme';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './components/AppLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Attendance from './pages/Attendance';
import Library from './pages/Library';
import Clinic from './pages/Clinic';
import Notices from './pages/Notices';
import Staff from './pages/Staff';
import Messages from './pages/Messages';
import Tasks from './pages/Tasks';
import Assignments from './pages/Assignments';
import Timetable from './pages/Timetable';
import Calendar from './pages/Calendar';
import Planning from './pages/Planning';

export default function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        {/* Everything below the guard requires a valid session. */}
                        <Route
                            path="/app"
                            element={
                                <RequireAuth>
                                    <AppLayout />
                                </RequireAuth>
                            }
                        >
                            <Route index element={<Dashboard />} />
                            <Route path="messages" element={<Messages />} />
                            <Route path="tasks" element={<Tasks />} />
                            <Route path="students" element={<Students />} />
                            <Route path="classes" element={<Classes />} />
                            <Route path="subjects" element={<Subjects />} />
                            <Route path="attendance" element={<Attendance />} />
                            <Route path="timetable" element={<Timetable />} />
                            <Route path="calendar" element={<Calendar />} />
                            <Route path="planning" element={<Planning />} />
                            <Route path="library" element={<Library />} />
                            <Route path="clinic" element={<Clinic />} />
                            <Route path="notices" element={<Notices />} />
                            <Route
                                path="assignments"
                                element={
                                    <RequireAuth roles={['admin']}>
                                        <Assignments />
                                    </RequireAuth>
                                }
                            />
                            <Route
                                path="staff"
                                element={
                                    <RequireAuth roles={['admin']}>
                                        <Staff />
                                    </RequireAuth>
                                }
                            />
                        </Route>

                        <Route path="/" element={<Landing />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}
