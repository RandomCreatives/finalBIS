import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Marks from './pages/Marks';
import Students from './pages/Students';
import Messages from './pages/Messages';
import BottomNav from './components/BottomNav';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading } = useAuth();
    if (isLoading) return null;
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
};

const TabBarRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    const { user } = useAuth();
    return (
        <>
            {children}
            <BottomNav user={user} location={location} />
        </>
    );
};

export default function App() {
    const { isLoading } = useAuth();
    if (isLoading) return null;
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                element={
                    <PrivateRoute>
                        <TabBarRoute>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="timetable" element={<Timetable />} />
                            <Route path="attendance" element={<Attendance />} />
                            <Route path="marks" element={<Marks />} />
                            <Route path="students" element={<Students />} />
                            <Route path="messages" element={<Messages />} />
                        </TabBarRoute>
                    </PrivateRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

