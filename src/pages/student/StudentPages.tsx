import { AlarmClock, CalendarCheck2, CalendarDays, CalendarX2, Clock, Megaphone, Percent, Printer, ScanLine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudent } from '../../auth/AuthContext';
import { ActivityCard } from '../../components/activities/ActivityCard';
import { AttendanceHistory, ScanResultPanel } from '../../components/attendance';
import { CalendarView } from '../../components/calendar/CalendarView';
import { QrImage } from '../../components/qr/QrImage';
import { QrScanner } from '../../components/qr/QrScanner';
import { Alert, Avatar, Card, CardHead, EmptyState, PageHead, StatCard, StatusBadge, STATUS_LABEL, useToast } from '../../components/ui';
import { DemoDataCard } from '../../components/DemoDataCard';
import { openSessionFor, recordScan, setProgress, type Result, type ScanSuccess } from '../../data/db';
import { announcements, attendanceSummary, missedDays, missedItems, progressOf, sectionActivities, studentRecords } from '../../data/selectors';
import { useData } from '../../data/store';
import type { ProgressStatus } from '../../data/types';
import { formatLongDate, formatTime, todayISO } from '../../lib/date';
import { buildSessionPayload, buildStudentPayload } from '../../lib/qr';
import { ACTIVITY_TYPES, PROGRESS_LABELS } from '../../lib/activityMeta';

function useProgressSetter() {
  const student = useStudent();
  const { run } = useData();
  const toast = useToast();
  return (activityId: string, status: ProgressStatus) => {
    const r = run((db) => setProgress(db, { role: 'student', id: student.id }, activityId, status));
    if (!r.ok) toast(r.error, 'error');
    else if (status === 'completed') toast('Marked as completed.');
  };
}

// ---------------------------------------------------------------------------

export function StudentCalendar() {
  const student = useStudent();
  return (
    <>
      <PageHead
        title="Class Calendar"
        sub="Select any date to see the lessons, activities, assignments, and announcements recorded that day. Days you were absent are highlighted in red."
      />
      <CalendarView mode="student" studentId={student.id} sectionId={student.sectionId} />
    </>
  );
}

// ---------------------------------------------------------------------------

export function StudentAttendance() {
  const student = useStudent();
  const { db } = useData();
  const summary = useMemo(() => attendanceSummary(db, student.id), [db, student.id]);
  const records = useMemo(() => studentRecords(db, student.id), [db, student.id]);
  return (
    <>
      <PageHead
        title="My Attendance"
        sub="Your attendance records for this school year. Select a date to see what happened in class that day."
        actions={
          <Link to="/student/check-in" className="btn btn-primary">
            <ScanLine size={16} aria-hidden /> QR Check-in
          </Link>
        }
      />
      <div className="stats">
        <StatCard icon={CalendarCheck2} tone="st-present" label="Present" value={summary.present} />
        <StatCard icon={Clock} tone="st-late" label="Late" value={summary.late} />
        <StatCard icon={CalendarX2} tone="st-absent" label="Absent / Excused" value={`${summary.absent} / ${summary.excused}`} />
        <StatCard icon={Percent} tone="type-lesson" label="Attendance rate" value={summary.rate === null ? '—' : `${summary.rate}%`} hint="Present + late ÷ recorded days" />
      </div>
      <Card>
        <CardHead title="Attendance history" sub={`${records.length} record(s)`} />
        <div className="card-body flush" style={{ paddingTop: 12 }}>
          <AttendanceHistory records={records} sessions={db.sessions} calendarBase="/student/calendar" />
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

export function StudentCheckIn() {
  const student = useStudent();
  const { db, run } = useData();
  const [result, setResult] = useState<Result<ScanSuccess> | null>(null);
  const open = openSessionFor(db, student.sectionId);
  const myRecord = open ? db.records.find((r) => r.sessionId === open.id && r.studentId === student.id) : undefined;

  const handle = (text: string) => setResult(run((d) => recordScan(d, { role: 'student', id: student.id }, text)));

  const simulate = [
    ...(open ? [{ label: `Current session code – ${open.label}`, value: buildSessionPayload(open.id, open.token) }] : []),
    ...(open ? [{ label: 'An old/expired session code', value: buildSessionPayload(open.id, 'oldtoken000') }] : []),
    { label: 'Someone’s student ID code (wrong type)', value: buildStudentPayload(student.id) },
    { label: 'A random, non-attendance QR code', value: 'https://example.com/not-an-attendance-code' },
  ];

  return (
    <>
      <PageHead title="QR Check-in" sub="Scan the attendance QR code displayed by your teacher to record your attendance." />
      <div className="grid grid-main">
        <Card>
          <CardHead icon={ScanLine} title="Scan session QR code" />
          <div className="card-body">
            <QrScanner onDetect={handle} simulateOptions={simulate} />
          </div>
        </Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          {result && <ScanResultPanel result={result} />}
          <Card>
            <CardHead title="Today’s session" />
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              {open ? (
                <>
                  <div>
                    <strong>{open.label}</strong>
                    <div className="small muted">
                      {formatLongDate(open.date)} · opened {formatTime(open.openedAt)} · late after {open.graceMinutes} min
                    </div>
                  </div>
                  {myRecord ? (
                    <Alert kind="success">
                      You are checked in: <StatusBadge status={myRecord.status} /> at {formatTime(myRecord.recordedAt)}.
                    </Alert>
                  ) : (
                    <Alert kind="info">You have not checked in for this session yet.</Alert>
                  )}
                </>
              ) : (
                <EmptyState icon={Clock} title="No open attendance session">
                  Your teacher has not started an attendance session. Check-in opens when the teacher displays the session QR code.
                </EmptyState>
              )}
            </div>
          </Card>
          <Alert kind="warn">
            <strong>Prototype limitation:</strong> check-ins are saved in this browser only. For a single-device demo, open the teacher’s QR Session in
            another tab of this browser, or have the teacher scan your <Link to="/student/profile">student QR ID</Link>.
          </Alert>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

type MissedFilter = 'pending' | ProgressStatus | 'all';

export function StudentMissed() {
  const student = useStudent();
  const { db } = useData();
  const setProg = useProgressSetter();
  const [filter, setFilter] = useState<MissedFilter>('pending');
  const days = useMemo(() => missedDays(db, student.id), [db, student.id]);
  const items = useMemo(() => missedItems(db, student.id), [db, student.id]);
  const counts = {
    not_started: items.filter((i) => i.status === 'not_started').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    completed: items.filter((i) => i.status === 'completed').length,
  };
  const urgent = items.filter((i) => i.urgency === 'overdue' || i.urgency === 'due_soon');
  const matches = (s: ProgressStatus) => filter === 'all' || (filter === 'pending' ? s !== 'completed' : s === filter);

  return (
    <>
      <PageHead
        title="Missed Activities"
        sub="Classroom activities recorded on the days you were marked absent. Track your progress as you catch up."
      />
      <div className="stats">
        <StatCard icon={CalendarX2} tone="st-absent" label="Days absent" value={days.length} />
        <StatCard icon={AlarmClock} tone="type-announcement" label="Not started" value={counts.not_started} />
        <StatCard icon={Clock} tone="type-assignment" label="In progress" value={counts.in_progress} />
        <StatCard icon={CalendarCheck2} tone="st-present" label="Completed" value={counts.completed} />
      </div>

      {urgent.length > 0 && (
        <Card style={{ borderColor: '#fdba74' }}>
          <CardHead icon={AlarmClock} title="Needs attention" sub="Missed work with deadlines that are close or have passed" />
          <div className="card-body" style={{ display: 'grid', gap: 8 }}>
            {urgent.map((i) => (
              <ActivityCard key={i.activity.id} activity={i.activity} showDate progress={i.status} onProgress={(v) => setProg(i.activity.id, v)} />
            ))}
          </div>
        </Card>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter by progress">
          {(['pending', 'not_started', 'in_progress', 'completed', 'all'] as MissedFilter[]).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'pending' ? 'Pending' : f === 'all' ? 'All' : PROGRESS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarCheck2} title="No absences recorded">
            You have not missed any class days. Activities from days you are absent will appear here automatically.
          </EmptyState>
        </Card>
      ) : (
        days.map((day) => {
          const visible = day.activities.filter((a) => {
            const trackable = ACTIVITY_TYPES[a.type].trackable;
            return trackable ? matches(progressOf(db, student.id, a.id)) : filter === 'all' || filter === 'pending';
          });
          return (
            <Card key={day.date}>
              <CardHead
                icon={CalendarX2}
                title={formatLongDate(day.date)}
                sub={
                  <>
                    Marked <strong>{STATUS_LABEL[day.record.status].toLowerCase()}</strong>
                    {day.record.note ? ` · ${day.record.note}` : ''} · {day.activities.length} record(s) that day
                  </>
                }
                action={
                  <Link to={`/student/calendar?date=${day.date}`} className="btn btn-secondary btn-sm">
                    <CalendarDays size={14} aria-hidden /> Open day
                  </Link>
                }
              />
              <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                {day.activities.length === 0 ? (
                  <p className="small muted">Your teacher has not recorded any classroom activities for this day.</p>
                ) : visible.length === 0 ? (
                  <p className="small muted">No items match this filter.</p>
                ) : (
                  visible.map((a) => {
                    const trackable = ACTIVITY_TYPES[a.type].trackable;
                    return (
                      <ActivityCard
                        key={a.id}
                        activity={a}
                        progress={trackable ? progressOf(db, student.id, a.id) : undefined}
                        onProgress={trackable ? (v) => setProg(a.id, v) : undefined}
                      />
                    );
                  })
                )}
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

export function StudentAssignments() {
  const student = useStudent();
  const { db } = useData();
  const setProg = useProgressSetter();
  const [tab, setTab] = useState<'pending' | 'completed' | 'all'>('pending');
  const today = todayISO();
  const missedDates = useMemo(() => new Set(missedDays(db, student.id).map((d) => d.date)), [db, student.id]);

  const items = useMemo(
    () =>
      sectionActivities(db, student.sectionId)
        .filter((a) => ['assignment', 'performance_task', 'quiz', 'exam'].includes(a.type))
        .map((a) => ({ a, status: progressOf(db, student.id, a.id), when: a.dueDate ?? a.date }))
        .sort((x, y) => {
          // Upcoming first (soonest), then past (most recent).
          const xf = x.when >= today, yf = y.when >= today;
          if (xf !== yf) return xf ? -1 : 1;
          return xf ? x.when.localeCompare(y.when) : y.when.localeCompare(x.when);
        }),
    [db, student.id, student.sectionId, today],
  );
  const shown = items.filter(({ status }) => tab === 'all' || (tab === 'completed' ? status === 'completed' : status !== 'completed'));

  return (
    <>
      <PageHead title="Assignments & Assessments" sub="Homework, performance tasks, quizzes, and examinations for your section." />
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter assignments">
          {(['pending', 'completed', 'all'] as const).map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'pending' ? 'Pending' : t === 'completed' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>
        <span className="small muted">{shown.length} item(s)</span>
      </div>
      <Card>
        <div className="card-body" style={{ display: 'grid', gap: 8 }}>
          {shown.length === 0 ? (
            <EmptyState title={tab === 'completed' ? 'Nothing marked completed yet' : 'No pending work'} />
          ) : (
            shown.map(({ a, status }) => (
              <ActivityCard
                key={a.id}
                activity={a}
                showDate
                progress={status}
                onProgress={(v) => setProg(a.id, v)}
                extra={missedDates.has(a.date) ? <span className="badge st-absent">Given while you were absent</span> : undefined}
              />
            ))
          )}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

export function StudentAnnouncements() {
  const student = useStudent();
  const { db } = useData();
  const today = todayISO();
  const list = useMemo(() => announcements(db, student.sectionId), [db, student.sectionId]);
  const upcoming = list.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = list.filter((a) => a.date < today);
  const missedDates = useMemo(() => new Set(missedDays(db, student.id).map((d) => d.date)), [db, student.id]);

  const render = (a: (typeof list)[number]) => (
    <ActivityCard key={a.id} activity={a} showDate defaultOpen={a.scheduleChange} extra={missedDates.has(a.date) ? <span className="badge st-absent">Announced while you were absent</span> : undefined} />
  );

  return (
    <>
      <PageHead title="Announcements & Events" sub="Classroom announcements, schedule changes, and school events." />
      <Card>
        <CardHead icon={CalendarDays} title="Upcoming events" />
        <div className="card-body" style={{ display: 'grid', gap: 8 }}>
          {upcoming.length ? upcoming.map(render) : <EmptyState icon={Megaphone} title="No upcoming events" />}
        </div>
      </Card>
      <Card>
        <CardHead icon={Megaphone} title="Past announcements" />
        <div className="card-body" style={{ display: 'grid', gap: 8 }}>
          {past.length ? past.map(render) : <EmptyState icon={Megaphone} title="No announcements yet" />}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

export function StudentProfile() {
  const student = useStudent();
  const { db } = useData();
  const section = db.sections.find((s) => s.id === student.sectionId);
  const adviser = db.teachers.find((t) => t.id === section?.adviserId);
  const summary = attendanceSummary(db, student.id);
  const name = `${student.firstName} ${student.lastName}`;

  return (
    <>
      <PageHead title="My Profile" sub="Your account details and student QR ID." />
      <div className="grid grid-2">
        <Card>
          <CardHead title="Account information" />
          <div className="card-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar name={name} large />
              <div>
                <h2>{name}</h2>
                <div className="small muted">Student · Sample account</div>
              </div>
            </div>
            <dl className="kv">
              <dt>Student number</dt>
              <dd>{student.id}</dd>
              <dt>Section</dt>
              <dd>{section?.name}</dd>
              <dt>School year</dt>
              <dd>{section?.schoolYear}</dd>
              <dt>Adviser</dt>
              <dd>{adviser ? `${adviser.title} ${adviser.firstName} ${adviser.lastName}` : '—'}</dd>
              <dt>Email</dt>
              <dd>{student.email ?? '—'}</dd>
              <dt>Guardian</dt>
              <dd>{student.guardian ?? '—'}</dd>
              <dt>Attendance rate</dt>
              <dd>{summary.rate === null ? '—' : `${summary.rate}%`}</dd>
            </dl>
            <p className="small muted">Profile details are managed by the school. Contact your adviser for corrections.</p>
          </div>
        </Card>
        <Card>
          <CardHead
            title="Student QR ID"
            sub="Your teacher can scan this to record your attendance"
            action={
              <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>
                <Printer size={14} aria-hidden /> Print
              </button>
            }
          />
          <div className="card-body">
            <div className="id-card">
              <header>Bagong Silang High School · Student ID (Sample)</header>
              <div className="body">
                <QrImage text={buildStudentPayload(student.id)} label={`Student QR ID for ${name}`} size={220} />
                <strong>{name}</strong>
                <span className="small muted">
                  {student.id} · {section?.name}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
      <DemoDataCard />
    </>
  );
}
