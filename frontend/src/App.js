import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';

import { ThemeProvider } from './theme';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './components/AppLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import PublicClasses from './pages/PublicClasses';
import PublicTeachers from './pages/PublicTeachers';
import PublicStudents from './pages/PublicStudents';
import PublicCalendar from './pages/PublicCalendar';
import ClassHome from './pages/ClassHome';

import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Staff from './pages/Staff';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Planning from './pages/Planning';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import Library from './pages/Library';
import Clinic from './pages/Clinic';
import Store from './pages/Store';
import Messages from './pages/Messages';
import Notices from './pages/Notices';
import Tasks from './pages/Tasks';
import DailyPlanner from './pages/DailyPlanner';
import Assignments from './pages/Assignments';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Files from './pages/Files';
import Marksheets from './pages/Marksheets';

export default function App() {
    return (
        <ThemeProvider>
            <CssBaseline />
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route
                            path="/app"
                            element={
                                <RequireAuth>
                                    <AppLayout />
                                </RequireAuth>
                            }
                        >
                            <Route index element={<Dashboard />} />
                            <Route path="students" element={<Students />} />
                            <Route path="staff" element={<Staff />} />
                            <Route path="timetable" element={<Timetable />} />
                            <Route path="attendance" element={<Attendance />} />
                            <Route path="planning" element={<Planning />} />
                            <Route path="classes" element={<Classes />} />
                            <Route path="subjects" element={<Subjects />} />
                            <Route path="library" element={<Library />} />
                            <Route path="clinic" element={<Clinic />} />
                            <Route path="store" element={<Store />} />
                            <Route path="messages" element={<Messages />} />
                            <Route path="notices" element={<Notices />} />
                            <Route path="tasks" element={<Tasks />} />
                            <Route
                                path="planner"
                                element={
                                    <RequireAuth roles={['main_teacher', 'subject_teacher']}>
                                        <DailyPlanner />
                                    </RequireAuth>
                                }
                            />
                            <Route path="assignments" element={<Assignments />} />
                            <Route path="calendar" element={<Calendar />} />
                            <Route path="settings" element={<Settings />} />
                            <Route path="files" element={<Files />} />
                            <Route path="marksheets" element={<Marksheets />} />
                        </Route>

                        <Route path="/" element={<Landing />} />
                        <Route path="/classes" element={<PublicClasses />} />
                        <Route path="/teachers" element={<PublicTeachers />} />
                        <Route path="/students" element={<PublicStudents />} />
                        <Route path="/calendar" element={<PublicCalendar />} />
                        <Route path="/class-home/:slug" element={<ClassHome />} />
                        {/* Data Center dormant in v1.0 (was public). */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}
