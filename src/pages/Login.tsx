import { ChevronRight, GraduationCap, QrCode, School } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DEMO_STUDENT_ID } from '../data/seed';
import { useData } from '../data/store';
import { Alert, Avatar } from '../components/ui';

export function Login() {
  const { db } = useData();
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAll, setShowAll] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;

  if (user) return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;

  const go = (role: 'student' | 'teacher', id: string) => {
    signIn(role, id);
    const fallback = role === 'teacher' ? '/teacher' : '/student';
    navigate(from && from.startsWith(`/${role}`) ? from : fallback, { replace: true });
  };

  const demoStudent = db.students.find((s) => s.id === DEMO_STUDENT_ID) ?? db.students[0];
  const others = db.students.filter((s) => s.id !== demoStudent?.id);

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-hero">
          <span className="brand-logo" style={{ width: 52, height: 52 }}>
            <QrCode size={28} aria-hidden />
          </span>
          <div>
            <div className="small" style={{ color: '#bfdbfe', fontWeight: 600 }}>
              Bagong Silang High School · Research Prototype
            </div>
            <h1>QR Code-Based Digital Attendance Monitoring System</h1>
          </div>
          <p className="small">
            A prototype for the study “Development and Performance Evaluation of a QR Code-Based Digital Attendance Monitoring System for Learners of
            Bagong Silang High School.”
          </p>
          <ul>
            <li>QR check-in with duplicate-scan protection</li>
            <li>Interactive class calendar of lessons, activities, and assessments</li>
            <li>Automatic “Activities You Missed” list for absent learners</li>
            <li>Teacher tools for attendance and classroom records</li>
          </ul>
        </div>

        <div className="login-form">
          <div>
            <h2>Sign in to the demo</h2>
            <p className="small muted">Choose a sample account to explore each role.</p>
          </div>
          <Alert kind="warn">
            <strong>Demo sign-in.</strong> There are no passwords and no server verification in this prototype. All accounts and records are sample
            data.
          </Alert>

          <div className="field">
            <span className="label">
              <School size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Teacher
            </span>
            {db.teachers.map((t) => (
              <button key={t.id} className="account-option" onClick={() => go('teacher', t.id)}>
                <Avatar name={`${t.firstName} ${t.lastName}`} />
                <span className="grow">
                  <strong>
                    {t.title} {t.firstName} {t.lastName}
                  </strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    Class adviser · {db.sections.find((s) => s.id === t.sectionIds[0])?.name}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            ))}
          </div>

          <div className="field">
            <span className="label">
              <GraduationCap size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Student
            </span>
            {demoStudent && (
              <button className="account-option" onClick={() => go('student', demoStudent.id)}>
                <Avatar name={`${demoStudent.firstName} ${demoStudent.lastName}`} />
                <span className="grow">
                  <strong>
                    {demoStudent.firstName} {demoStudent.lastName}
                  </strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    Recommended for the demo: has recorded absences and missed activities
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            )}
            {showAll ? (
              <select className="select" defaultValue="" onChange={(e) => e.target.value && go('student', e.target.value)} aria-label="Choose another sample student">
                <option value="" disabled>
                  Choose another sample student…
                </option>
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName}, {s.firstName} ({s.id})
                  </option>
                ))}
              </select>
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setShowAll(true)}>
                Sign in as another sample student
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
