import { CalendarDays, ClipboardCheck, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTeacher } from '../../auth/AuthContext';
import { METHOD_LABEL } from '../../components/attendance';
import { Alert, Card, CardHead, EmptyState, Modal, PageHead, StatusBadge, STATUS_LABEL, useToast } from '../../components/ui';
import { setAttendanceStatus, startSession } from '../../data/db';
import { summarize } from '../../data/selectors';
import { useData } from '../../data/store';
import type { AttendanceStatus } from '../../data/types';
import { formatLongDate, formatShortDate, formatTime, todayISO } from '../../lib/date';

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

export function TeacherAttendance() {
  const teacher = useTeacher();
  const { db, run } = useData();
  const toast = useToast();
  const sectionId = teacher.sectionIds[0];
  const actor = { role: 'teacher' as const, id: teacher.id };
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);

  const sessions = useMemo(
    () => db.sessions.filter((s) => s.sectionId === sectionId).sort((a, b) => b.date.localeCompare(a.date) || b.openedAt - a.openedAt),
    [db, sectionId],
  );
  const selectedId = params.get('session') ?? sessions[0]?.id;
  const session = sessions.find((s) => s.id === selectedId) ?? sessions[0];
  const students = useMemo(() => db.students.filter((s) => s.sectionId === sectionId).sort((a, b) => a.lastName.localeCompare(b.lastName)), [db, sectionId]);
  const records = session ? db.records.filter((r) => r.sessionId === session.id) : [];
  const summary = summarize(records);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    if (!session) return;
    const r = run((d) => setAttendanceStatus(d, actor, session.id, studentId, status));
    if (!r.ok) toast(r.error, 'error');
  };
  const markAllUnrecorded = (status: AttendanceStatus) => {
    if (!session) return;
    const have = new Set(records.map((r) => r.studentId));
    let n = 0;
    for (const s of students) {
      if (have.has(s.id)) continue;
      const r = run((d) => setAttendanceStatus(d, actor, session.id, s.id, status));
      if (r.ok) n++;
    }
    toast(`${n} student(s) marked ${STATUS_LABEL[status].toLowerCase()}.`);
  };

  return (
    <>
      <PageHead
        title="Attendance Management"
        sub="Review who was present or absent for each session and correct records when needed (e.g. an excuse letter)."
        actions={
          <button className="btn btn-secondary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> New session (manual)
          </button>
        }
      />

      {sessions.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck} title="No attendance sessions yet" action={<Link to="/teacher/qr" className="btn btn-primary btn-sm">Start a QR session</Link>}>
            Start a session to begin taking attendance.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <label className="small" htmlFor="session-select" style={{ fontWeight: 600 }}>
              Session
            </label>
            <select id="session-select" className="select" value={session?.id} onChange={(e) => setParams({ session: e.target.value }, { replace: true })}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatShortDate(s.date)} · {s.label}
                  {s.closedAt === null ? ' (open)' : ''}
                </option>
              ))}
            </select>
            {session && (
              <Link to={`/teacher/calendar?date=${session.date}`} className="btn btn-ghost btn-sm">
                <CalendarDays size={14} aria-hidden /> Classroom records that day
              </Link>
            )}
          </div>

          {session && (
            <Card>
              <CardHead
                title={`${session.label} — ${formatLongDate(session.date)}`}
                sub={`Opened ${formatTime(session.openedAt)} · late after ${session.graceMinutes} min · ${session.closedAt === null ? 'OPEN' : `closed ${formatTime(session.closedAt)}`}`}
                action={
                  <span className="toolbar small">
                    <span className="badge st-present">{summary.present} present</span>
                    <span className="badge st-late">{summary.late} late</span>
                    <span className="badge st-absent">{summary.absent} absent</span>
                    <span className="badge st-excused">{summary.excused} excused</span>
                    <span className="badge st-none">{students.length - records.length} unrecorded</span>
                  </span>
                }
              />
              <div className="card-body" style={{ paddingBottom: 0 }}>
                {session.closedAt === null && (
                  <Alert kind="info">
                    This session is still open. Students who have not checked in show as “No record”. Closing the session on the{' '}
                    <Link to="/teacher/qr">QR page</Link> marks them absent automatically.
                  </Alert>
                )}
                {students.length > records.length && (
                  <div className="toolbar" style={{ marginTop: 10 }}>
                    <span className="small muted">Unrecorded students:</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => markAllUnrecorded('present')}>
                      Mark present
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => markAllUnrecorded('absent')}>
                      Mark absent
                    </button>
                  </div>
                )}
              </div>
              <div className="card-body flush">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Recorded via</th>
                        <th>Change status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const r = records.find((x) => x.studentId === s.id);
                        return (
                          <tr key={s.id}>
                            <td>
                              <Link to={`/teacher/students/${s.id}`}>
                                {s.lastName}, {s.firstName}
                              </Link>
                              <div className="small muted">{s.id}</div>
                            </td>
                            <td>
                              <StatusBadge status={r?.status ?? null} />
                            </td>
                            <td className="nowrap">{r && r.status !== 'absent' ? formatTime(r.recordedAt) : '—'}</td>
                            <td className="small muted">{r ? METHOD_LABEL[r.method] : '—'}</td>
                            <td>
                              <select
                                className="select"
                                style={{ minWidth: 130, minHeight: 34, padding: '4px 8px' }}
                                value={r?.status ?? ''}
                                aria-label={`Set status for ${s.firstName} ${s.lastName}`}
                                onChange={(e) => setStatus(s.id, e.target.value as AttendanceStatus)}
                              >
                                {!r && (
                                  <option value="" disabled>
                                    Set status…
                                  </option>
                                )}
                                {STATUSES.map((st) => (
                                  <option key={st} value={st}>
                                    {STATUS_LABEL[st]}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {creating && (
        <NewSessionModal
          onClose={() => setCreating(false)}
          onCreate={(date, label) => {
            const r = run((d) => startSession(d, actor, { sectionId, date, label, graceMinutes: 15 }));
            if (!r.ok) return r.error;
            setParams({ session: r.value.id }, { replace: true });
            toast('Session created. Set each student’s status below, or open the QR page to let students scan.');
            setCreating(false);
            return null;
          }}
        />
      )}
    </>
  );
}

function NewSessionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (date: string, label: string) => string | null }) {
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState('Morning homeroom');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="New attendance session"
      sub="For taking attendance manually (e.g. when devices are unavailable)."
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => setError(onCreate(date, label))}>
            Create session
          </button>
        </>
      }
    >
      {error && <Alert kind="error">{error}</Alert>}
      <div className="field">
        <label htmlFor="ns-date">Date</label>
        <input id="ns-date" type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ns-label">Session name</label>
        <input id="ns-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
    </Modal>
  );
}
