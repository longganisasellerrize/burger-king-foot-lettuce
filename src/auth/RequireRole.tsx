import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../data/types';
import { useAuth } from './AuthContext';

/** Route guard: redirects signed-out users to login and blocks the other role's pages. */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  return <Outlet />;
}
