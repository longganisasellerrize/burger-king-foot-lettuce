import { ArrowRight, CalendarPlus, ClipboardCheck, ClipboardList, Percent, QrCode, TriangleAlert, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTeacher } from '../../auth/AuthContext';
import { DueBadge } from '../../components/activities/ActivityCard';
import { useActivityEditor } from '../../components/activities/useActivityEditor';
import { DemoDataCard } from '../../components/DemoDataCard';
import { Alert, Avatar, Card, CardHead, EmptyState, PageHead, StatCard, TypeIcon } from '../../components/ui';
import { openSessionFor } from '../../data/db';
import { attendanceSummary, sectionActivities, summarize, upcomingItems } from '../../data/selectors';
import { useData } from '../../data/store';
import { addDays, formatShortDate, formatTime, todayISO } from '../../lib/date';

export function TeacherDashboard() {
  const teacher = useTeacher();
  const { db } = useData();
  const editor = useActivityEditor();
  const sectionId = teacher.sectionIds[0];
  const section = db.sections.find((s) => s.id === sectionId);
  const today = todayISO();

  const students = useMemo(() => db.students.filter((s) => s.sectionId === sectionId), [db, sectionId]);
  const classSummary = useMemo(() => summarize(db.records.filter((r) => r.sectionId === sectionId)), [db, sectionId]);
  const open = openSessionFor(db, sectionId);
  const openRecords = open ? db.records.filter((r) => r.sessionId === open.id) : [];
  const lastClosed = useMemo(
    () => db.sessions.filter((s) => s.sectionId === sectionId && s.closedAt !== null).sort((a, b) => b.date.localeCompare(a.date) || b.openedAt - a.openedAt)[0],
    [db, sectionId],
  );
  const lastSummary = lastClosed ? summarize(db.records.filter((r) => r.sessionId === lastClosed.id)) : null;

  const watchlist = useMemo(
    () =>
      students
        .map((s) => ({ s, sum: attendanceSummary(db, s.id) }))
        .filter((x) => x.sum.absent + x.sum.late > 0)
        .sort((a, b) => b.sum.absent - a.sum.absent || b.sum.late - a.sum.late)
        .slice(0, 5),
    [db, students],
  );
  const recent = useMemo(() => sectionActivities(db, sectionId).filter((a) => a.date <= today).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6), [db, sectionId, today]);
  const upcoming = useMemo(() => upcomingItems(db, sectionId, today, 14).slice(0, 6), [db, sectionId, today]);
  const weekCount = sectionActivities(db, sectionId).filter((a) => a.date > addDays(today, -7) && a.date <= today).length;

  return (
    <>
      <PageHead
        title={`Welcome, ${teacher.title} ${teacher.lastName}`}
        sub={`${section?.name} · ${section?.schoolYear}`}
        actions={
          <>
            <Link to="/teacher/qr" className="btn btn-primary">
              <QrCode size={16} aria-hidden /> {open ? 'Show session QR' : 'Start attendance'}
            </Link>
            <button className="btn btn-secondary" onClick={() => editor.openNew({ date: today })}>
              <CalendarPlus size={16} aria-hidden /> Record activity
            </button>
          </>
        }
      />

      <div className="stats">
        <StatCard icon={Users} tone="type-lesson" label="Students in section" value={students.length} />
        <StatCard
          icon={ClipboardCheck}
          tone="st-present"
          label={open ? 'Checked in (open session)' : 'Present last session'}
          value={open ? `${openRecords.length}/${students.length}` : lastSummary ? `${lastSummary.present + lastSummary.late}/${lastSummary.total}` : '—'}
          hint={open ? open.label : lastClosed ? formatShortDate(lastClosed.date) : undefined}
        />
        <StatCard icon={Percent} tone="type-activity" label="Class attendance rate" value={classSummary.rate === null ? '—' : `${classSummary.rate}%`} hint={`${classSummary.absent} absences recorded`} />
        <StatCard icon={ClipboardList} tone="type-assignment" label="Records posted (7 days)" value={weekCount} />
      </div>

      {open ? (
        <Alert kind="info">
          <strong>{open.label}</strong> is open since {formatTime(open.openedAt)} — {openRecords.length} of {students.length} students checked in.{' '}
          <Link to="/teacher/qr">Manage session →</Link>
        </Alert>
      ) : (
        <Alert kind="info">
          No attendance session is open. <Link to="/teacher/qr">Start a QR session</Link> to let students check in.
        </Alert>
      )}

      <div className="grid grid-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card>
            <CardHead
              icon={ClipboardList}
              title="Recently recorded classroom activities"
              action={
                <Link to="/teacher/activities" className="btn btn-ghost btn-sm">
                  Manage <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body flush">
              {recent.length === 0 ? (
                <EmptyState title="No records yet" action={<button className="btn btn-primary btn-sm" onClick={() => editor.openNew({ date: today })}>Record an activity</button>} />
              ) : (
                <ul className="list">
                  {recent.map((a) => (
                    <li key={a.id}>
                      <Link to={`/teacher/calendar?date=${a.date}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <TypeIcon type={a.type} />
                        <div className="grow">
                          <div className="title">{a.title}</div>
                          <div className="meta">
                            {a.subject} · {formatShortDate(a.date)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <CardHead
              title="Upcoming deadlines & events"
              sub="Next 14 days"
              action={
                <Link to="/teacher/assignments" className="btn btn-ghost btn-sm">
                  All <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body flush">
              {upcoming.length === 0 ? (
                <EmptyState title="Nothing scheduled" />
              ) : (
                <ul className="list">
                  {upcoming.map((a) => (
                    <li key={a.id} className="list-item">
                      <TypeIcon type={a.type} />
                      <div className="grow">
                        <div className="title">{a.title}</div>
                        <div className="meta">
                          {a.subject} · {formatShortDate(a.dueDate ?? a.date)}
                        </div>
                      </div>
                      <DueBadge activity={a} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card>
            <CardHead
              icon={TriangleAlert}
              title="Attendance watchlist"
              sub="Most absences and late arrivals"
              action={
                <Link to="/teacher/students" className="btn btn-ghost btn-sm">
                  Records <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body flush">
              {watchlist.length === 0 ? (
                <EmptyState title="Perfect attendance so far" />
              ) : (
                <ul className="list">
                  {watchlist.map(({ s, sum }) => (
                    <li key={s.id}>
                      <Link to={`/teacher/students/${s.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                        <Avatar name={`${s.firstName} ${s.lastName}`} />
                        <div className="grow">
                          <div className="title">
                            {s.lastName}, {s.firstName}
                          </div>
                          <div className="meta">{sum.rate}% attendance</div>
                        </div>
                        <span className="badge st-absent">{sum.absent} absent</span>
                        {sum.late > 0 && <span className="badge st-late">{sum.late} late</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <DemoDataCard />
        </div>
      </div>
      {editor.element}
    </>
  );
}
