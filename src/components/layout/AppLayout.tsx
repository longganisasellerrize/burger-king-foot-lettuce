import {
  AlarmClock,
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  QrCode,
  ScanLine,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { missedItems } from '../../data/selectors';
import { useData } from '../../data/store';
import { formatLongDate, todayISO } from '../../lib/date';
import { Avatar, cx } from '../ui';

interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
  mobile?: boolean;
}

function useNavItems(): NavItem[] {
  const { user } = useAuth();
  const { db } = useData();
  const pendingMissed = useMemo(
    () => (user?.role === 'student' ? missedItems(db, user.id).filter((i) => i.status !== 'completed').length : 0),
    [db, user],
  );

  if (user?.role === 'teacher') {
    return [
      { to: '/teacher', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true, mobile: true },
      { to: '/teacher/attendance', label: 'Attendance Management', short: 'Attendance', icon: ClipboardCheck, mobile: true },
      { to: '/teacher/qr', label: 'QR Scanner / Session', short: 'QR', icon: QrCode, mobile: true },
      { to: '/teacher/calendar', label: 'Class Calendar', short: 'Calendar', icon: CalendarDays, mobile: true },
      { to: '/teacher/activities', label: 'Manage Activities', short: 'Activities', icon: ClipboardList, mobile: true },
      { to: '/teacher/assignments', label: 'Assignments', icon: FileText },
      { to: '/teacher/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/teacher/students', label: 'Student Records', icon: Users },
    ];
  }
  return [
    { to: '/student', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true, mobile: true },
    { to: '/student/attendance', label: 'Attendance', icon: ClipboardCheck, mobile: true },
    { to: '/student/check-in', label: 'QR Check-in', short: 'Check-in', icon: ScanLine, mobile: true },
    { to: '/student/calendar', label: 'Class Calendar', short: 'Calendar', icon: CalendarDays, mobile: true },
    { to: '/student/missed', label: 'Missed Activities', short: 'Missed', icon: AlarmClock, badge: pendingMissed, mobile: true },
    { to: '/student/assignments', label: 'Assignments', icon: BookMarked },
    { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/student/profile', label: 'Profile', icon: User },
  ];
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { db, persistence } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const items = useNavItems();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!user) return null;
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find((i) => location.pathname.startsWith(i.to));
  const section = db.sections.find((s) => s.id === (user.role === 'student' ? user.student.sectionId : user.teacher.sectionIds[0]));

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className={cx('shell', drawer && 'drawer-open')}>
      <aside className="sidebar" aria-label="Main navigation">
        <NavLink to={user.role === 'teacher' ? '/teacher' : '/student'} className="brand">
          <span className="brand-logo">
            <QrCode size={22} aria-hidden />
          </span>
          <span className="brand-text">
            <strong>BSHS Attendance</strong>
            <span>QR Attendance & Class Calendar</span>
          </span>
        </NavLink>
        <div className="nav-label">{user.role === 'teacher' ? 'Teacher' : 'Student'}</div>
        <ul className="nav-list">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
                <item.icon size={18} aria-hidden />
                {item.label}
                {!!item.badge && (
                  <span className="count" aria-label={`${item.badge} pending`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Avatar name={user.displayName} />
            <div>
              <div className="name">{user.displayName}</div>
              <div className="role">{user.role === 'teacher' ? 'Adviser' : section?.name}</div>
            </div>
          </div>
          <button className="nav-link" style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%' }} onClick={handleSignOut}>
            <LogOut size={18} aria-hidden /> Sign out
          </button>
        </div>
      </aside>
      <div className="drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden />

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setDrawer(true)} aria-label="Open navigation menu">
            <Menu size={22} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title">{current?.label ?? 'BSHS Attendance'}</div>
            <div className="topbar-sub">
              {formatLongDate(todayISO())} · {section?.name}
            </div>
          </div>
          <div className="topbar-right">
            <span className="tag-sim" title="Front-end prototype: sample data stored only in this browser">
              Prototype
            </span>
          </div>
        </header>

        <main className="content" id="main">
          {(db.isSampleData || persistence === 'memory') && (
            <div className="demo-banner no-print" role="note">
              <TriangleAlert size={16} aria-hidden />
              <div>
                <strong>Demonstration prototype.</strong>{' '}
                {db.isSampleData && 'All names, attendance, and classroom records are clearly labeled sample data, not real school records. '}
                {persistence === 'memory'
                  ? 'This browser blocks local storage, so changes will be lost when the page is closed.'
                  : 'Changes are saved only in this browser (localStorage); there is no server or shared database yet.'}
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        {items
          .filter((i) => i.mobile)
          .map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx(isActive && 'active')}>
              <item.icon size={20} aria-hidden />
              {item.short ?? item.label}
              {!!item.badge && <span className="dot" aria-label={`${item.badge} pending`} />}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
