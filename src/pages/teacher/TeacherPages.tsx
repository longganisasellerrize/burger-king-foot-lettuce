import { AlarmClock, ArrowLeft, CalendarCheck2, CalendarPlus, CalendarX2, ClipboardList, Clock, Percent, Plus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTeacher } from '../../auth/AuthContext';
import { ActivityCard } from '../../components/activities/ActivityCard';
import { useActivityEditor } from '../../components/activities/useActivityEditor';
import { AttendanceHistory } from '../../components/attendance';
import { CalendarView } from '../../components/calendar/CalendarView';
import { Avatar, Card, CardHead, EmptyState, PageHead, StatCard, TypeBadge } from '../../components/ui';
import { attendanceSummary, missedItems, progressOf, sectionActivities, studentRecords } from '../../data/selectors';
import { useData } from '../../data/store';
import type { ActivityType } from '../../data/types';
import { ACTIVITY_TYPE_ORDER, ACTIVITY_TYPES, PROGRESS_LABELS } from '../../lib/activityMeta';
import { formatShortDate, todayISO } from '../../lib/date';

export function TeacherCalendar() {
  const teacher = useTeacher();
  const editor = useActivityEditor();
  return (
    <>
      <PageHead
        title="Class Calendar"
        sub="Select a date to review or record what happened in class. Everything you add appears on the student calendar for that date."
        actions={
          <button className="btn btn-primary" onClick={() => editor.openNew()}>
            <CalendarPlus size={16} aria-hidden /> Add record
          </button>
        }
      />
      <CalendarView mode="teacher" sectionId={teacher.sectionIds[0]} onAdd={(date) => editor.openNew({ date })} onEdit={editor.openEdit} onDelete={editor.requestDelete} />
      {editor.element}
    </>
  );
}

// ---------------------------------------------------------------------------

export function TeacherActivities({ types, title, sub, addType }: { types?: ActivityType[]; title?: string; sub?: string; addType?: ActivityType }) {
  const teacher = useTeacher();
  const { db } = useData();
  const editor = useActivityEditor();
  const sectionId = teacher.sectionIds[0];
  const [q, setQ] = useState('');
  const [type, setType] = useState<ActivityType | 'all'>('all');
  const [subject, setSubject] = useState('all');
  const [when, setWhen] = useState<'all' | 'past' | 'upcoming'>('all');
  const today = todayISO();
  const allowed = types ?? ACTIVITY_TYPE_ORDER;

  const all = useMemo(() => sectionActivities(db, sectionId).filter((a) => allowed.includes(a.type)), [db, sectionId, allowed]);
  const subjects = useMemo(() => Array.from(new Set(all.map((a) => a.subject))).sort(), [all]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((a) => type === 'all' || a.type === type)
      .filter((a) => subject === 'all' || a.subject === subject)
      .filter((a) => when === 'all' || (when === 'past' ? (a.dueDate ?? a.date) < today : (a.dueDate ?? a.date) >= today))
      .filter((a) => !needle || `${a.title} ${a.description} ${a.subject}`.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [all, q, type, subject, when, today]);

  // Student self-reported completion for trackable records.
  const sectionStudents = db.students.filter((s) => s.sectionId === sectionId);
  const completion = (id: string) => sectionStudents.filter((s) => progressOf(db, s.id, id) === 'completed').length;

  return (
    <>
      <PageHead
        title={title ?? 'Manage Activities'}
        sub={sub ?? 'All classroom records for your section: lessons, activities, assessments, announcements, and events.'}
        actions={
          <button className="btn btn-primary" onClick={() => editor.openNew(addType ? { type: addType } : undefined)}>
            <Plus size={16} aria-hidden /> Add {addType ? ACTIVITY_TYPES[addType].label.toLowerCase() : 'record'}
          </button>
        }
      />
      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} aria-hidden style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search title, description, subject…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search records" />
        </div>
        {allowed.length > 1 && (
          <select className="select" value={type} onChange={(e) => setType(e.target.value as ActivityType | 'all')} aria-label="Filter by type">
            <option value="all">All types</option>
            {allowed.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_TYPES[t].label}
              </option>
            ))}
          </select>
        )}
        <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject">
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="select" value={when} onChange={(e) => setWhen(e.target.value as typeof when)} aria-label="Filter by date">
          <option value="all">Any date</option>
          <option value="upcoming">Upcoming / due later</option>
          <option value="past">Past</option>
        </select>
      </div>
      <Card>
        <CardHead title={`${list.length} record(s)`} sub="Click a record to see its details" />
        <div className="card-body" style={{ display: 'grid', gap: 8 }}>
          {list.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={all.length ? 'No records match your filters' : 'No records yet'}
              action={
                <button className="btn btn-primary btn-sm" onClick={() => editor.openNew(addType ? { type: addType } : undefined)}>
                  <Plus size={14} aria-hidden /> Add a record
                </button>
              }
            />
          ) : (
            list.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                showDate
                onEdit={() => editor.openEdit(a)}
                onDelete={() => editor.requestDelete(a)}
                extra={
                  <>
                    <Link to={`/teacher/calendar?date=${a.date}`} className="btn btn-ghost btn-sm">
                      View on calendar
                    </Link>
                    {ACTIVITY_TYPES[a.type].trackable && ['assignment', 'performance_task', 'quiz', 'exam'].includes(a.type) && (
                      <span className="small muted" title="Self-reported by students">
                        {completion(a.id)}/{sectionStudents.length} marked completed
                      </span>
                    )}
                  </>
                }
              />
            ))
          )}
        </div>
      </Card>
      {editor.element}
    </>
  );
}

export function TeacherAssignments() {
  return (
    <TeacherActivities
      types={['assignment', 'performance_task', 'quiz', 'exam']}
      addType="assignment"
      title="Assignments & Assessments"
      sub="Post assignments, quizzes, examinations, and performance tasks, and set deadlines. Completion counts are self-reported by students."
    />
  );
}

export function TeacherAnnouncements() {
  return (
    <TeacherActivities
      types={['announcement', 'event']}
      addType="announcement"
      title="Announcements & Events"
      sub="Record classroom announcements, schedule changes, and events. Absent students see them in their missed-activity list."
    />
  );
}

// ---------------------------------------------------------------------------

export function TeacherStudents() {
  const teacher = useTeacher();
  const { db } = useData();
  const [q, setQ] = useState('');
  const sectionId = teacher.sectionIds[0];
  const rows = useMemo(
    () =>
      db.students
        .filter((s) => s.sectionId === sectionId)
        .map((s) => ({ s, sum: attendanceSummary(db, s.id), pending: missedItems(db, s.id).filter((i) => i.status !== 'completed').length }))
        .sort((a, b) => a.s.lastName.localeCompare(b.s.lastName)),
    [db, sectionId],
  );
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(({ s }) => !needle || `${s.firstName} ${s.lastName} ${s.id}`.toLowerCase().includes(needle));

  return (
    <>
      <PageHead title="Student Records" sub="Attendance history and catch-up progress for each student in your section." />
      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} aria-hidden style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search by name or student number…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
        </div>
      </div>
      <Card>
        <div className="card-body flush">
          {shown.length === 0 ? (
            <EmptyState icon={Users} title="No students found" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Attendance rate</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Absent</th>
                    <th>Excused</th>
                    <th>Pending missed items</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ s, sum, pending }) => (
                    <tr key={s.id}>
                      <td>
                        <Link to={`/teacher/students/${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                          <Avatar name={`${s.firstName} ${s.lastName}`} />
                          <span>
                            <strong>
                              {s.lastName}, {s.firstName}
                            </strong>
                            <span className="small muted" style={{ display: 'block' }}>
                              {s.id}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="small" style={{ fontWeight: 600 }}>
                          {sum.rate === null ? '—' : `${sum.rate}%`}
                        </div>
                        <div className="meter" aria-hidden>
                          <span style={{ width: `${sum.rate ?? 0}%`, background: (sum.rate ?? 100) < 85 ? 'var(--c-absent)' : undefined }} />
                        </div>
                      </td>
                      <td>{sum.present}</td>
                      <td>{sum.late}</td>
                      <td>{sum.absent ? <span className="badge st-absent">{sum.absent}</span> : 0}</td>
                      <td>{sum.excused}</td>
                      <td>{pending ? <span className="badge urg-due_soon">{pending}</span> : <span className="muted">0</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export function TeacherStudentDetail() {
  const { studentId } = useParams();
  const teacher = useTeacher();
  const { db } = useData();
  const student = db.students.find((s) => s.id === studentId);

  if (!student || !teacher.sectionIds.includes(student.sectionId)) {
    return (
      <Card>
        <EmptyState icon={Users} title="Student not found" action={<Link to="/teacher/students" className="btn btn-secondary btn-sm">Back to Student Records</Link>}>
          This student does not exist or is not in a section you handle.
        </EmptyState>
      </Card>
    );
  }
  const sum = attendanceSummary(db, student.id);
  const records = studentRecords(db, student.id);
  const missed = missedItems(db, student.id);

  return (
    <>
      <div>
        <Link to="/teacher/students" className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} aria-hidden /> Student Records
        </Link>
      </div>
      <PageHead title={`${student.firstName} ${student.lastName}`} sub={`${student.id} · ${db.sections.find((s) => s.id === student.sectionId)?.name}`} />
      <div className="stats">
        <StatCard icon={CalendarCheck2} tone="st-present" label="Present" value={sum.present} />
        <StatCard icon={Clock} tone="st-late" label="Late" value={sum.late} />
        <StatCard icon={CalendarX2} tone="st-absent" label="Absent / Excused" value={`${sum.absent} / ${sum.excused}`} />
        <StatCard icon={Percent} tone="type-lesson" label="Attendance rate" value={sum.rate === null ? '—' : `${sum.rate}%`} />
      </div>
      <div className="grid grid-main">
        <Card>
          <CardHead title="Attendance history" sub="Edit a status from Attendance Management" />
          <div className="card-body flush" style={{ paddingTop: 12 }}>
            <AttendanceHistory records={records} sessions={db.sessions} calendarBase="/teacher/calendar" />
          </div>
        </Card>
        <Card>
          <CardHead icon={AlarmClock} title="Missed activities" sub="Recorded on days this student was absent (progress is self-reported)" />
          <div className="card-body flush">
            {missed.length === 0 ? (
              <EmptyState title="No missed activities" />
            ) : (
              <ul className="list">
                {missed.map((i) => (
                  <li key={i.activity.id} className="list-item">
                    <div className="grow">
                      <div className="title">{i.activity.title}</div>
                      <div className="meta">
                        {i.activity.subject} · missed {formatShortDate(i.missedOn)}
                      </div>
                      <div className="toolbar" style={{ marginTop: 4, gap: 6 }}>
                        <TypeBadge type={i.activity.type} />
                        <span className={`badge ${i.status === 'completed' ? 'st-present' : i.status === 'in_progress' ? 'st-late' : 'st-none'}`}>{PROGRESS_LABELS[i.status]}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
