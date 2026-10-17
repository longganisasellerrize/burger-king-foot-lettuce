import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireRole } from './auth/RequireRole';
import { AppLayout } from './components/layout/AppLayout';
import { Alert, Card, EmptyState, ToastProvider } from './components/ui';
import { DataProvider, resetDatabase } from './data/store';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/student/StudentDashboard';
import {
  StudentAnnouncements,
  StudentAssignments,
  StudentAttendance,
  StudentCalendar,
  StudentCheckIn,
  StudentMissed,
  StudentProfile,
} from './pages/student/StudentPages';
import { TeacherAttendance } from './pages/teacher/TeacherAttendance';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import {
  TeacherActivities,
  TeacherAnnouncements,
  TeacherAssignments,
  TeacherCalendar,
  TeacherStudentDetail,
  TeacherStudents,
} from './pages/teacher/TeacherPages';
import { TeacherQr } from './pages/teacher/TeacherQr';

function DataError({ message }: { message: string }) {
  return (
    <div className="login-page">
      <Card style={{ maxWidth: 520, padding: 24, display: 'grid', gap: 12 }}>
        <h1>Could not load data</h1>
        <Alert kind="error">{message}</Alert>
        <button className="btn btn-primary" onClick={() => resetDatabase()}>
          Reset to sample data
        </button>
      </Card>
    </div>
  );
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? (user.role === 'teacher' ? '/teacher' : '/student') : '/login'} replace />;
}

function NotFound() {
  const { user } = useAuth();
  const home = user ? (user.role === 'teacher' ? '/teacher' : '/student') : '/login';
  return (
    <Card>
      <EmptyState title="Page not found" action={<a className="btn btn-primary btn-sm" href={`#${home}`}>Go to dashboard</a>}>
        The page you are looking for does not exist.
      </EmptyState>
    </Card>
  );
}

export default function App() {
  return (
    <DataProvider fallback={(message) => <DataError message={message} />}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            <Route element={<RequireRole role="student" />}>
              <Route path="/student" element={<AppLayout />}>
                <Route index element={<StudentDashboard />} />
                <Route path="attendance" element={<StudentAttendance />} />
                <Route path="check-in" element={<StudentCheckIn />} />
                <Route path="calendar" element={<StudentCalendar />} />
                <Route path="missed" element={<StudentMissed />} />
                <Route path="assignments" element={<StudentAssignments />} />
                <Route path="announcements" element={<StudentAnnouncements />} />
                <Route path="profile" element={<StudentProfile />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="teacher" />}>
              <Route path="/teacher" element={<AppLayout />}>
                <Route index element={<TeacherDashboard />} />
                <Route path="attendance" element={<TeacherAttendance />} />
                <Route path="qr" element={<TeacherQr />} />
                <Route path="calendar" element={<TeacherCalendar />} />
                <Route path="activities" element={<TeacherActivities />} />
                <Route path="assignments" element={<TeacherAssignments />} />
                <Route path="announcements" element={<TeacherAnnouncements />} />
                <Route path="students" element={<TeacherStudents />} />
                <Route path="students/:studentId" element={<TeacherStudentDetail />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>

            <Route path="*" element={<Home />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </DataProvider>
  );
}
