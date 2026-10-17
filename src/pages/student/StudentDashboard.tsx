import { AlarmClock, ArrowRight, CalendarCheck2, CalendarDays, CalendarX2, Clock, Megaphone, Percent, ScanLine } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStudent } from '../../auth/AuthContext';
import { ActivityCard, DueBadge } from '../../components/activities/ActivityCard';
import { AttendanceHistory } from '../../components/attendance';
import { Alert, Avatar, Card, CardHead, EmptyState, PageHead, StatCard, StatusBadge, TypeIcon } from '../../components/ui';
import { openSessionFor } from '../../data/db';
import { activitiesByDate, announcements, attendanceByDate, attendanceSummary, missedItems, progressOf, studentRecords, upcomingItems } from '../../data/selectors';
import { useData } from '../../data/store';
import { addDays, formatShortDate, fromISODate, isWeekend, todayISO, WEEKDAY_SHORT } from '../../lib/date';

export function StudentDashboard() {
  const student = useStudent();
  const { db } = useData();
  const today = todayISO();
  const section = db.sections.find((s) => s.id === student.sectionId);

  const summary = useMemo(() => attendanceSummary(db, student.id), [db, student.id]);
  const missed = useMemo(() => missedItems(db, student.id).filter((i) => i.status !== 'completed'), [db, student.id]);
  const upcoming = useMemo(() => upcomingItems(db, student.sectionId, today, 14), [db, student.sectionId, today]);
  const news = useMemo(() => announcements(db, student.sectionId).filter((a) => a.date <= today).slice(0, 4), [db, student.sectionId, today]);
  const records = useMemo(() => studentRecords(db, student.id), [db, student.id]);
  const openSession = openSessionFor(db, student.sectionId);
  const checkedIn = openSession && db.records.some((r) => r.sessionId === openSession.id && r.studentId === student.id);

  // This week's strip (Mon–Fri) for a quick calendar shortcut.
  const week = useMemo(() => {
    const t = fromISODate(today);
    const monday = addDays(today, -((t.getDay() + 6) % 7));
    const byDate = activitiesByDate(db, student.sectionId);
    const att = attendanceByDate(db, student.id);
    return [0, 1, 2, 3, 4].map((i) => {
      const date = addDays(monday, i);
      return { date, count: byDate.get(date)?.length ?? 0, record: att.get(date) ?? null };
    });
  }, [db, student.id, student.sectionId, today]);

  return (
    <>
      <PageHead
        title={`Good day, ${student.firstName}!`}
        sub="Here is your attendance and what is happening in class."
        actions={
          <>
            <Link to="/student/check-in" className="btn btn-primary">
              <ScanLine size={16} aria-hidden /> QR Check-in
            </Link>
            <Link to="/student/calendar" className="btn btn-secondary">
              <CalendarDays size={16} aria-hidden /> Class Calendar
            </Link>
          </>
        }
      />

      {openSession && !checkedIn && (
        <Alert kind="info">
          <strong>Attendance is open:</strong> {openSession.label} ({formatShortDate(openSession.date)}).{' '}
          <Link to="/student/check-in">Scan the QR code to check in →</Link>
        </Alert>
      )}

      <div className="stats">
        <StatCard icon={CalendarCheck2} tone="st-present" label="Days present" value={summary.present + summary.late} hint={summary.late ? `${summary.late} late arrival(s)` : undefined} />
        <StatCard icon={CalendarX2} tone="st-absent" label="Days absent" value={summary.absent + summary.excused} hint={summary.excused ? `${summary.excused} excused` : undefined} />
        <StatCard icon={Percent} tone="type-lesson" label="Attendance rate" value={summary.rate === null ? '—' : `${summary.rate}%`} hint={`${summary.total} school days recorded`} />
        <StatCard icon={AlarmClock} tone="type-ptask" label="Missed items to catch up" value={missed.length} />
      </div>

      <div className="grid grid-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card>
            <CardHead
              icon={AlarmClock}
              title="Activities you missed"
              sub="Lessons and work recorded on days you were absent"
              action={
                <Link to="/student/missed" className="btn btn-ghost btn-sm">
                  View all <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body" style={{ display: 'grid', gap: 8 }}>
              {missed.length === 0 ? (
                <EmptyState icon={CalendarCheck2} title="You’re all caught up">
                  No pending activities from days you were absent.
                </EmptyState>
              ) : (
                missed.slice(0, 4).map((i) => (
                  <ActivityCard key={i.activity.id} activity={i.activity} showDate progress={i.status} extra={<span className="badge st-absent">Missed {formatShortDate(i.missedOn)}</span>} />
                ))
              )}
              {missed.length > 4 && <p className="small muted">+ {missed.length - 4} more on the Missed Activities page</p>}
            </div>
          </Card>

          <Card>
            <CardHead
              icon={CalendarDays}
              title="This week in class"
              sub="Tap a day to open it on the class calendar"
              action={
                <Link to="/student/calendar" className="btn btn-ghost btn-sm">
                  Open calendar <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                {week.map((d) => (
                  <Link
                    key={d.date}
                    to={`/student/calendar?date=${d.date}`}
                    className={`cal-cell ${d.date === today ? 'today' : ''} ${d.record?.status === 'absent' ? 'absent' : ''}`}
                    style={{ minHeight: 84, textDecoration: 'none', color: 'inherit' }}
                    aria-label={`${formatShortDate(d.date)}: ${d.count} records${d.record ? `, ${d.record.status}` : ''}`}
                  >
                    <span className="small muted" style={{ fontWeight: 600 }}>
                      {WEEKDAY_SHORT[fromISODate(d.date).getDay()]}
                    </span>
                    <span className="cal-num">{fromISODate(d.date).getDate()}</span>
                    <span className="small muted">{isWeekend(d.date) ? '' : d.count ? `${d.count} record${d.count > 1 ? 's' : ''}` : '—'}</span>
                    {d.record && <StatusBadge status={d.record.status} />}
                  </Link>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              icon={Clock}
              title="Recent attendance"
              action={
                <Link to="/student/attendance" className="btn btn-ghost btn-sm">
                  Full history <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body flush">
              <AttendanceHistory records={records} sessions={db.sessions} calendarBase="/student/calendar" limit={5} />
            </div>
          </Card>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card>
            <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar name={`${student.firstName} ${student.lastName}`} large />
              <div style={{ minWidth: 0 }}>
                <h2>
                  {student.firstName} {student.lastName}
                </h2>
                <div className="small muted">{student.id}</div>
                <div className="small">{section?.name}</div>
                <Link to="/student/profile" className="small">
                  View profile & student QR ID
                </Link>
              </div>
            </div>
            <div style={{ padding: '0 18px 18px' }}>
              <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span>Attendance rate</span>
                <strong>{summary.rate === null ? '—' : `${summary.rate}%`}</strong>
              </div>
              <div className="meter" role="img" aria-label={`Attendance rate ${summary.rate ?? 0}%`}>
                <span style={{ width: `${summary.rate ?? 0}%` }} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              icon={CalendarCheck2}
              title="Upcoming deadlines & assessments"
              sub="Next 14 days"
              action={
                <Link to="/student/assignments" className="btn btn-ghost btn-sm">
                  All <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body flush">
              {upcoming.length === 0 ? (
                <EmptyState title="Nothing due soon" />
              ) : (
                <ul className="list">
                  {upcoming.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Link to={`/student/calendar?date=${a.dueDate ?? a.date}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <TypeIcon type={a.type} />
                        <div className="grow">
                          <div className="title">{a.title}</div>
                          <div className="meta">
                            {a.subject} · {formatShortDate(a.dueDate ?? a.date)}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <DueBadge activity={a} progress={progressOf(db, student.id, a.id)} />
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
              icon={Megaphone}
              title="Recent announcements"
              action={
                <Link to="/student/announcements" className="btn btn-ghost btn-sm">
                  All <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
            <div className="card-body flush">
              {news.length === 0 ? (
                <EmptyState icon={Megaphone} title="No announcements yet" />
              ) : (
                <ul className="list">
                  {news.map((a) => (
                    <li key={a.id}>
                      <Link to={`/student/calendar?date=${a.date}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <TypeIcon type={a.type} />
                        <div className="grow">
                          <div className="title">{a.title}</div>
                          <div className="meta">{formatShortDate(a.date)}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
