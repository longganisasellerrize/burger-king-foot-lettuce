import { Maximize2, Play, QrCode, RefreshCw, ScanLine, Square, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTeacher } from '../../auth/AuthContext';
import { ScanResultPanel } from '../../components/attendance';
import { QrImage } from '../../components/qr/QrImage';
import { QrScanner } from '../../components/qr/QrScanner';
import { Alert, Card, CardHead, ConfirmDialog, EmptyState, PageHead, StatusBadge, useToast } from '../../components/ui';
import { closeSession, openSessionFor, recordScan, rotateSessionToken, startSession, type Result, type ScanSuccess } from '../../data/db';
import { useData } from '../../data/store';
import { formatLongDate, formatTime, todayISO } from '../../lib/date';
import { buildSessionPayload, buildStudentPayload } from '../../lib/qr';

export function TeacherQr() {
  const teacher = useTeacher();
  const { db, run } = useData();
  const toast = useToast();
  const sectionId = teacher.sectionIds[0];
  const actor = { role: 'teacher' as const, id: teacher.id };
  const open = openSessionFor(db, sectionId);
  const [tab, setTab] = useState<'display' | 'scan'>('display');
  const [confirmClose, setConfirmClose] = useState(false);
  const [scanLog, setScanLog] = useState<Result<ScanSuccess>[]>([]);
  const qrRef = useRef<HTMLDivElement>(null);

  const students = useMemo(() => db.students.filter((s) => s.sectionId === sectionId).sort((a, b) => a.lastName.localeCompare(b.lastName)), [db, sectionId]);
  const records = open ? db.records.filter((r) => r.sessionId === open.id).sort((a, b) => b.recordedAt - a.recordedAt) : [];
  const recordedIds = new Set(records.map((r) => r.studentId));

  useEffect(() => setScanLog([]), [open?.id]);

  const onScan = (text: string) => {
    const r = run((d) => recordScan(d, actor, text, { activeSessionId: open?.id }));
    setScanLog((log) => [r, ...log].slice(0, 6));
  };

  const fullscreen = () => {
    const el = qrRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => toast('Full screen is not available in this browser.', 'error'));
  };

  if (!open) return <StartSession onStart={(input) => run((d) => startSession(d, actor, { sectionId, ...input }))} />;

  const payload = buildSessionPayload(open.id, open.token);

  return (
    <>
      <PageHead
        title="QR Attendance Session"
        sub={`${open.label} · ${formatLongDate(open.date)} · opened ${formatTime(open.openedAt)} · late after ${open.graceMinutes} min`}
        actions={
          <button className="btn btn-danger" onClick={() => setConfirmClose(true)}>
            <Square size={16} aria-hidden /> Close session
          </button>
        }
      />
      <div className="segmented" role="group" aria-label="Attendance mode">
        <button aria-pressed={tab === 'display'} onClick={() => setTab('display')}>
          <QrCode size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Display session QR
        </button>
        <button aria-pressed={tab === 'scan'} onClick={() => setTab('scan')}>
          <ScanLine size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Scan student IDs
        </button>
      </div>

      <div className="grid grid-main">
        {tab === 'display' ? (
          <Card>
            <CardHead
              icon={QrCode}
              title="Students: scan this code to check in"
              sub="Project this on the screen or show it on your device"
              action={
                <span className="toolbar">
                  <button className="btn btn-secondary btn-sm" onClick={fullscreen}>
                    <Maximize2 size={14} aria-hidden /> Full screen
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const r = run((d) => rotateSessionToken(d, actor, open.id));
                      toast(r.ok ? 'New code generated. Previous codes no longer work.' : r.error, r.ok ? 'success' : 'error');
                    }}
                  >
                    <RefreshCw size={14} aria-hidden /> New code
                  </button>
                </span>
              }
            />
            <div className="card-body">
              <div className="qr-box" ref={qrRef} style={{ background: '#fff' }}>
                <QrImage text={payload} label={`Attendance QR code for ${open.label}`} size={360} />
                <strong>{open.label}</strong>
                <span className="small muted">{formatLongDate(open.date)}</span>
                <span className="qr-code-text">{payload}</span>
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                Tip: press “New code” if a photo of the code is being shared outside the classroom. Old codes are rejected as expired.
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHead icon={ScanLine} title="Scan student QR IDs" sub="Each scan records the student for this session" />
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              <QrScanner
                onDetect={onScan}
                simulateOptions={[
                  ...students.map((s) => ({ label: `${s.lastName}, ${s.firstName}${recordedIds.has(s.id) ? ' (already recorded)' : ''}`, value: buildStudentPayload(s.id) })),
                  { label: 'Unknown student ID', value: buildStudentPayload('SAMPLE-2026-9999') },
                  { label: 'Non-attendance QR code', value: 'WIFI:S:SchoolNet;;' },
                ]}
              />
              {scanLog.map((r, i) => (
                <div key={scanLog.length - i} style={{ opacity: i === 0 ? 1 : 0.65 }}>
                  <ScanResultPanel result={r} isTeacher />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <CardHead
            icon={Users}
            title={`Checked in: ${records.length} / ${students.length}`}
            sub="Updates automatically, including check-ins from other tabs in this browser"
          />
          <div className="card-body" style={{ paddingTop: 10 }}>
            <div className="meter" aria-hidden>
              <span style={{ width: `${students.length ? (records.length / students.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="card-body flush">
            {records.length === 0 ? (
              <EmptyState icon={Users} title="Waiting for check-ins">
                Scanned students will appear here.
              </EmptyState>
            ) : (
              <ul className="list">
                {records.map((r) => {
                  const s = db.students.find((x) => x.id === r.studentId);
                  return (
                    <li key={r.id} className="list-item" style={{ alignItems: 'center' }}>
                      <div className="grow">
                        <div className="title">{s ? `${s.lastName}, ${s.firstName}` : r.studentId}</div>
                        <div className="meta">{formatTime(r.recordedAt)}</div>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  );
                })}
              </ul>
            )}
            {students.length > records.length && (
              <div style={{ padding: '10px 18px' }} className="small muted">
                Not yet scanned:{' '}
                {students
                  .filter((s) => !recordedIds.has(s.id))
                  .map((s) => `${s.firstName} ${s.lastName[0]}.`)
                  .join(', ')}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Alert kind="warn">
        <strong>Prototype:</strong> scans are validated and saved in this browser only. Students checking in from their own phones would need the shared
        backend described in the README; for now, scan student IDs on this device or use another tab of this browser.
      </Alert>

      {confirmClose && (
        <ConfirmDialog
          title="Close this session?"
          message={
            <>
              {students.length - records.length} student(s) who have not checked in will be marked <strong>absent</strong>. Their missed-activity lists will
              include the records for {formatLongDate(open.date)}. You can still correct statuses in Attendance Management.
            </>
          }
          confirmLabel="Close session"
          danger
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            const r = run((d) => closeSession(d, actor, open.id));
            setConfirmClose(false);
            toast(r.ok ? `Session closed. ${r.value.markedAbsent} student(s) marked absent.` : r.error, r.ok ? 'success' : 'error');
          }}
        />
      )}
    </>
  );
}

function StartSession({ onStart }: { onStart: (input: { date: string; label: string; graceMinutes: number }) => Result<unknown> }) {
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState('Morning homeroom');
  const [grace, setGrace] = useState(15);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = onStart({ date, label, graceMinutes: grace });
    if (!r.ok) setError(r.error);
  };

  return (
    <>
      <PageHead title="QR Attendance Session" sub="Start a session to display a QR code for students, or to scan student QR IDs." />
      <div className="grid grid-2">
        <Card>
          <CardHead icon={Play} title="Start a new session" />
          <form className="card-body form" onSubmit={submit}>
            {error && <Alert kind="error">{error}</Alert>}
            <div className="form-row">
              <div className="field">
                <label htmlFor="ss-date">Date</label>
                <input id="ss-date" type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ss-grace">Late after (minutes)</label>
                <input id="ss-grace" type="number" min={0} max={240} className="input" value={grace} onChange={(e) => setGrace(Number(e.target.value))} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ss-label">Session name</label>
              <input id="ss-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <button className="btn btn-primary" type="submit">
                <Play size={16} aria-hidden /> Start session
              </button>
            </div>
          </form>
        </Card>
        <Card>
          <CardHead title="How it works" />
          <div className="card-body">
            <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>Start a session. A unique QR code is generated for it.</li>
              <li>Students scan the code from their account (QR Check-in), or you scan their student QR IDs.</li>
              <li>Each scan is checked: valid code, open session, enrolled student, and no duplicate for this session.</li>
              <li>Scans after the grace period are marked late.</li>
              <li>Close the session to mark everyone who did not scan as absent. Their calendars then flag the day’s activities as missed.</li>
            </ol>
            <p className="small muted" style={{ marginTop: 10 }}>
              Past sessions are in <Link to="/teacher/attendance">Attendance Management</Link>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
