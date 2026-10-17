import { CheckCircle2, ClipboardX, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMediumDate, formatShortDate, formatTime } from '../../lib/date';
import type { Result, ScanSuccess } from '../../data/db';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, RecordMethod } from '../../data/types';
import { EmptyState, StatusBadge, STATUS_LABEL } from '../ui';

export const METHOD_LABEL: Record<RecordMethod, string> = {
  'qr-session': 'QR (session code)',
  'qr-student-id': 'QR (student ID)',
  manual: 'Teacher entry',
  'auto-absent': 'Auto: no scan',
  sample: 'Sample record',
};

export function ScanResultPanel({ result, isTeacher }: { result: Result<ScanSuccess>; isTeacher?: boolean }) {
  if (!result.ok) {
    return (
      <div className="scan-result err" role="alert">
        <span className="big-icon">
          <XCircle size={26} aria-hidden />
        </span>
        <div>
          <h3>{result.code === 'duplicate' ? 'Already recorded' : 'Scan not accepted'}</h3>
          <p className="small">{result.error}</p>
        </div>
      </div>
    );
  }
  const { record, student, session } = result.value;
  return (
    <div className="scan-result ok" role="status">
      <span className="big-icon">
        <CheckCircle2 size={26} aria-hidden />
      </span>
      <div>
        <h3>Attendance recorded{isTeacher ? `: ${student.firstName} ${student.lastName}` : ''}</h3>
        <dl className="kv">
          <dt>Student</dt>
          <dd>
            {student.firstName} {student.lastName}
          </dd>
          <dt>Session</dt>
          <dd>{session.label}</dd>
          <dt>Date</dt>
          <dd>{formatMediumDate(record.date)}</dd>
          <dt>Time</dt>
          <dd>{formatTime(record.recordedAt)}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={record.status} />
          </dd>
        </dl>
        <p className="small muted" style={{ marginTop: 8 }}>
          Saved in this browser only (prototype). A production system would confirm this with the school server.
        </p>
      </div>
    </div>
  );
}

export function AttendanceHistory({
  records,
  sessions,
  calendarBase,
  limit,
}: {
  records: AttendanceRecord[];
  sessions: AttendanceSession[];
  /** e.g. "/student/calendar" – each date links to that day on the calendar. */
  calendarBase?: string;
  limit?: number;
}) {
  const [status, setStatus] = useState<AttendanceStatus | 'all'>('all');
  const filtered = records.filter((r) => status === 'all' || r.status === status);
  const shown = limit ? filtered.slice(0, limit) : filtered;
  const sessionLabel = (id: string) => sessions.find((s) => s.id === id)?.label ?? '—';

  return (
    <div>
      {!limit && (
        <div className="toolbar" style={{ padding: '0 18px 12px' }}>
          <div className="segmented" role="group" aria-label="Filter by status">
            {(['all', 'present', 'late', 'absent', 'excused'] as const).map((s) => (
              <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <span className="small muted">{filtered.length} record(s)</span>
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState icon={ClipboardX} title="No attendance records">
          {status === 'all' ? 'Records appear here after your first check-in.' : `No “${STATUS_LABEL[status as AttendanceStatus]}” records.`}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Time</th>
                <th>Session</th>
                <th>Recorded via</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{calendarBase ? <Link to={`${calendarBase}?date=${r.date}`}>{formatShortDate(r.date)}</Link> : formatShortDate(r.date)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="nowrap">{r.status === 'absent' ? '—' : formatTime(r.recordedAt)}</td>
                  <td>{sessionLabel(r.sessionId)}</td>
                  <td className="small muted">
                    {METHOD_LABEL[r.method]}
                    {r.note ? ` · ${r.note}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
