import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Marks from './pages/Marks';
import Students from './pages/Students';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';

function FullScreenLoader() {
    const iconUrl = `${import.meta.env.BASE_URL}favicon.svg`;
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
            <div className="relative">
                <img src={iconUrl} alt="BIS NOC" className="w-16 h-16 rounded-2xl shadow-lg" />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-blue-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-400 animate-spin bg-white/80 dark:bg-slate-900/80" />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide">
                Loading BIS NOC Portal…
            </p>
        </div>
    );
}

function AttendanceRoute() {
    const { user } = useAuth();
    if (user?.role === 'subject_teacher') {
        return <Navigate to="/" replace />;
    }
    return <Attendance />;
}

function MarksRoute() {
    const { user } = useAuth();
    if (user?.role === 'assistant_teacher') {
        return <Navigate to="/" replace />;
    }
    return <Marks />;
}

function PrivateLayout() {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) return <FullScreenLoader />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return (
        <div className="min-h-screen flex flex-col">
            <TopBar />
            <main className="flex-1 w-full max-w-lg mx-auto safe-area-bottom">
                <Outlet />
            </main>
            <BottomNav user={user} location={location} />
        </div>
    );
}

export default function App() {
    const { isLoading } = useAuth();

    if (isLoading) return <FullScreenLoader />;

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<PrivateLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="timetable" element={<Timetable />} />
                <Route path="attendance" element={<AttendanceRoute />} />
                <Route path="marks" element={<MarksRoute />} />
                <Route path="students" element={<Students />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
