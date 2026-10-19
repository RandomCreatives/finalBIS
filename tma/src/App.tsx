import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Marks from './pages/Marks';
import Students from './pages/Students';
import Messages from './pages/Messages';
import BottomNav from './components/BottomNav';

function FullScreenLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        </div>
    );
}

/**
 * Layout route for the authenticated tabs. It must render an <Outlet /> —
 * nesting <Route> elements inside a wrapper component (the previous approach)
 * is not valid React Router and produced a blank screen.
 */
function PrivateLayout() {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) return <FullScreenLoader />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return (
        <>
            <Outlet />
            <BottomNav user={user} location={location} />
        </>
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
                <Route path="attendance" element={<Attendance />} />
                <Route path="marks" element={<Marks />} />
                <Route path="students" element={<Students />} />
                <Route path="messages" element={<Messages />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
