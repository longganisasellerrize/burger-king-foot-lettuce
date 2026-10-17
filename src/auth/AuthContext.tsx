/**
 * DEMO sign-in only.
 *
 * Users pick a sample account; the choice is remembered in sessionStorage.
 * There are no passwords and nothing is verified by a server, so this must
 * not be used with real student data. A production version needs server-side
 * authentication (e.g. school-issued accounts) and the role checks in
 * `data/db.ts` enforced by the API.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useData } from '../data/store';
import type { Role, Student, Teacher } from '../data/types';

const KEY = 'bshs-attendance-session';

interface SessionInfo {
  role: Role;
  id: string;
}

export type CurrentUser =
  | { role: 'student'; id: string; student: Student; displayName: string }
  | { role: 'teacher'; id: string; teacher: Teacher; displayName: string };

interface AuthValue {
  user: CurrentUser | null;
  signIn: (role: Role, id: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readSession(): SessionInfo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionInfo) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { db } = useData();
  const [session, setSession] = useState<SessionInfo | null>(readSession);

  const signIn = useCallback((role: Role, id: string) => {
    const s = { role, id };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* in-memory only */
    }
    setSession(s);
  }, []);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  const user = useMemo<CurrentUser | null>(() => {
    if (!session) return null;
    if (session.role === 'student') {
      const student = db.students.find((s) => s.id === session.id);
      return student ? { role: 'student', id: student.id, student, displayName: `${student.firstName} ${student.lastName}` } : null;
    }
    const teacher = db.teachers.find((t) => t.id === session.id);
    return teacher ? { role: 'teacher', id: teacher.id, teacher, displayName: `${teacher.title} ${teacher.firstName} ${teacher.lastName}` } : null;
  }, [session, db]);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useStudent(): Student {
  const { user } = useAuth();
  if (user?.role !== 'student') throw new Error('Student account required');
  return user.student;
}

export function useTeacher(): Teacher {
  const { user } = useAuth();
  if (user?.role !== 'teacher') throw new Error('Teacher account required');
  return user.teacher;
}
