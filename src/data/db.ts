/**
 * Data operations ("repository") for the prototype.
 *
 * Every write goes through a function here that takes the current database
 * plus the acting user and returns a new database (or an error). Role checks
 * live here rather than only in the UI, so the same rules apply no matter
 * which screen calls them.
 *
 * IMPORTANT: this runs entirely in the browser. The checks prevent mistakes
 * in normal use but are NOT security — anyone with browser dev tools can edit
 * localStorage. A production deployment must move these functions behind an
 * authenticated server API (see README → "Backend integration").
 */
import { isValidISODate, todayISO } from '../lib/date';
import { parseQrPayload } from '../lib/qr';
import type {
  Activity,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Database,
  ISODate,
  ProgressStatus,
  Role,
  Student,
} from './types';

export interface Actor {
  role: Role;
  id: string;
}

export type Result<T> = { ok: true; db: Database; value: T } | { ok: false; error: string; code?: string };

const fail = <T,>(error: string, code?: string): Result<T> => ({ ok: false, error, code });

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rnd}`;
}

function newToken(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

function teacherHandlesSection(db: Database, actor: Actor, sectionId: string): boolean {
  if (actor.role !== 'teacher') return false;
  const t = db.teachers.find((x) => x.id === actor.id);
  return !!t && t.sectionIds.includes(sectionId);
}

// ---------------------------------------------------------------------------
// Classroom activities
// ---------------------------------------------------------------------------

export type ActivityInput = Omit<Activity, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

export function validateActivity(input: ActivityInput): string | null {
  if (!input.title.trim()) return 'Title is required.';
  if (!input.subject.trim()) return 'Subject is required.';
  if (!isValidISODate(input.date)) return 'Please choose a valid class date.';
  if (input.dueDate && !isValidISODate(input.dueDate)) return 'Please choose a valid deadline.';
  if ((input.type === 'assignment' || input.type === 'performance_task') && !input.dueDate) {
    return 'Assignments and performance tasks need a submission deadline.';
  }
  if (input.dueDate && input.dueDate < input.date && (input.type === 'assignment' || input.type === 'performance_task')) {
    return 'The deadline cannot be earlier than the date the work was given.';
  }
  return null;
}

function cleanActivity(input: ActivityInput): ActivityInput {
  return {
    ...input,
    title: input.title.trim(),
    subject: input.subject.trim(),
    description: input.description.trim(),
    notes: input.notes?.trim() || undefined,
    instructions: input.instructions?.trim() || undefined,
    materials: input.materials?.filter((m) => m.label.trim()).map((m) => ({ label: m.label.trim(), url: m.url?.trim() || undefined })),
    dueDate: input.dueDate || undefined,
    format: input.type === 'activity' ? input.format : undefined,
    scheduleChange: input.type === 'announcement' ? !!input.scheduleChange : undefined,
  };
}

export function createActivity(db: Database, actor: Actor, input: ActivityInput): Result<Activity> {
  if (!teacherHandlesSection(db, actor, input.sectionId)) return fail('Only the section’s teacher can add classroom records.', 'forbidden');
  const err = validateActivity(input);
  if (err) return fail(err, 'invalid');
  const now = Date.now();
  const activity: Activity = { ...cleanActivity(input), id: newId('ACT'), createdBy: actor.id, createdAt: now, updatedAt: now };
  return { ok: true, db: { ...db, activities: [...db.activities, activity] }, value: activity };
}

export function updateActivity(db: Database, actor: Actor, id: string, input: ActivityInput): Result<Activity> {
  const existing = db.activities.find((a) => a.id === id);
  if (!existing) return fail('This activity no longer exists. It may have been deleted.', 'not_found');
  if (!teacherHandlesSection(db, actor, existing.sectionId) || !teacherHandlesSection(db, actor, input.sectionId)) {
    return fail('Only the section’s teacher can edit classroom records.', 'forbidden');
  }
  const err = validateActivity(input);
  if (err) return fail(err, 'invalid');
  const updated: Activity = { ...existing, ...cleanActivity(input), id, updatedAt: Date.now() };
  return { ok: true, db: { ...db, activities: db.activities.map((a) => (a.id === id ? updated : a)) }, value: updated };
}

export function deleteActivity(db: Database, actor: Actor, id: string): Result<null> {
  const existing = db.activities.find((a) => a.id === id);
  if (!existing) return fail('This activity no longer exists.', 'not_found');
  if (!teacherHandlesSection(db, actor, existing.sectionId)) return fail('Only the section’s teacher can delete classroom records.', 'forbidden');
  return {
    ok: true,
    db: {
      ...db,
      activities: db.activities.filter((a) => a.id !== id),
      progress: db.progress.filter((p) => p.activityId !== id),
    },
    value: null,
  };
}

// ---------------------------------------------------------------------------
// Student progress on (missed) activities
// ---------------------------------------------------------------------------

export function setProgress(db: Database, actor: Actor, activityId: string, status: ProgressStatus): Result<null> {
  if (actor.role !== 'student') return fail('Only students can update their own progress.', 'forbidden');
  const student = db.students.find((s) => s.id === actor.id);
  const activity = db.activities.find((a) => a.id === activityId);
  if (!student || !activity) return fail('Activity not found.', 'not_found');
  if (activity.sectionId !== student.sectionId) return fail('This activity is not part of your section.', 'forbidden');
  const rest = db.progress.filter((p) => !(p.studentId === actor.id && p.activityId === activityId));
  return { ok: true, db: { ...db, progress: [...rest, { studentId: actor.id, activityId, status, updatedAt: Date.now() }] }, value: null };
}

// ---------------------------------------------------------------------------
// Attendance sessions
// ---------------------------------------------------------------------------

export interface SessionInput {
  sectionId: string;
  date: ISODate;
  label: string;
  graceMinutes: number;
}

export function openSessionFor(db: Database, sectionId: string): AttendanceSession | undefined {
  return db.sessions.find((s) => s.sectionId === sectionId && s.closedAt === null);
}

export function startSession(db: Database, actor: Actor, input: SessionInput, now = Date.now()): Result<AttendanceSession> {
  if (!teacherHandlesSection(db, actor, input.sectionId)) return fail('Only the section’s teacher can start an attendance session.', 'forbidden');
  if (!isValidISODate(input.date)) return fail('Please choose a valid date.', 'invalid');
  if (input.date > todayISO()) return fail('Attendance sessions cannot be started for a future date.', 'invalid');
  if (!input.label.trim()) return fail('Session name is required.', 'invalid');
  if (!(input.graceMinutes >= 0 && input.graceMinutes <= 240)) return fail('Grace period must be between 0 and 240 minutes.', 'invalid');
  const open = openSessionFor(db, input.sectionId);
  if (open) return fail(`"${open.label}" (${open.date}) is still open. Close it before starting a new session.`, 'conflict');
  const session: AttendanceSession = {
    id: newId('SES'),
    sectionId: input.sectionId,
    date: input.date,
    label: input.label.trim(),
    openedAt: now,
    graceMinutes: input.graceMinutes,
    closedAt: null,
    token: newToken(),
    createdBy: actor.id,
  };
  return { ok: true, db: { ...db, sessions: [...db.sessions, session] }, value: session };
}

export function rotateSessionToken(db: Database, actor: Actor, sessionId: string): Result<AttendanceSession> {
  const s = db.sessions.find((x) => x.id === sessionId);
  if (!s) return fail('Session not found.', 'not_found');
  if (!teacherHandlesSection(db, actor, s.sectionId)) return fail('Not allowed.', 'forbidden');
  if (s.closedAt !== null) return fail('This session is already closed.', 'closed');
  const updated = { ...s, token: newToken() };
  return { ok: true, db: { ...db, sessions: db.sessions.map((x) => (x.id === sessionId ? updated : x)) }, value: updated };
}

/** Close a session and mark every enrolled student without a record as absent. */
export function closeSession(db: Database, actor: Actor, sessionId: string, now = Date.now()): Result<{ markedAbsent: number }> {
  const s = db.sessions.find((x) => x.id === sessionId);
  if (!s) return fail('Session not found.', 'not_found');
  if (!teacherHandlesSection(db, actor, s.sectionId)) return fail('Only the section’s teacher can close this session.', 'forbidden');
  if (s.closedAt !== null) return fail('This session is already closed.', 'closed');
  const have = new Set(db.records.filter((r) => r.sessionId === sessionId).map((r) => r.studentId));
  const absent: AttendanceRecord[] = db.students
    .filter((st) => st.sectionId === s.sectionId && !have.has(st.id))
    .map((st) => ({
      id: newId('REC'),
      sessionId,
      studentId: st.id,
      sectionId: s.sectionId,
      date: s.date,
      status: 'absent' as const,
      recordedAt: now,
      method: 'auto-absent' as const,
      updatedBy: actor.id,
    }));
  return {
    ok: true,
    db: {
      ...db,
      sessions: db.sessions.map((x) => (x.id === sessionId ? { ...x, closedAt: now } : x)),
      records: [...db.records, ...absent],
    },
    value: { markedAbsent: absent.length },
  };
}

/** Teacher override of a student's status for a session (creates or updates the record). */
export function setAttendanceStatus(
  db: Database,
  actor: Actor,
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  note?: string,
): Result<AttendanceRecord> {
  const s = db.sessions.find((x) => x.id === sessionId);
  if (!s) return fail('Session not found.', 'not_found');
  if (!teacherHandlesSection(db, actor, s.sectionId)) return fail('Only the section’s teacher can edit attendance.', 'forbidden');
  const student = db.students.find((x) => x.id === studentId);
  if (!student || student.sectionId !== s.sectionId) return fail('Student is not enrolled in this section.', 'not_enrolled');
  const now = Date.now();
  const existing = db.records.find((r) => r.sessionId === sessionId && r.studentId === studentId);
  const record: AttendanceRecord = existing
    ? { ...existing, status, note: note ?? existing.note, method: 'manual', updatedBy: actor.id, recordedAt: existing.recordedAt }
    : { id: newId('REC'), sessionId, studentId, sectionId: s.sectionId, date: s.date, status, recordedAt: now, method: 'manual', note, updatedBy: actor.id };
  const records = existing ? db.records.map((r) => (r.id === existing.id ? record : r)) : [...db.records, record];
  return { ok: true, db: { ...db, records }, value: record };
}

// ---------------------------------------------------------------------------
// QR scanning
// ---------------------------------------------------------------------------

export interface ScanSuccess {
  record: AttendanceRecord;
  student: Student;
  session: AttendanceSession;
}

/**
 * Record attendance from a scanned QR code.
 *
 *  - A student scans the teacher's *session* QR → records that student.
 *  - A teacher scans a *student ID* QR while `activeSessionId` is open → records that student.
 *
 * Duplicate scans for the same student and session are rejected.
 */
export function recordScan(
  db: Database,
  actor: Actor,
  rawText: string,
  options: { activeSessionId?: string; now?: number } = {},
): Result<ScanSuccess> {
  const now = options.now ?? Date.now();
  const payload = parseQrPayload(rawText);
  if (!payload) return fail('This QR code is not a Bagong Silang HS attendance code.', 'invalid_qr');

  let session: AttendanceSession | undefined;
  let studentId: string;

  if (payload.kind === 'session') {
    if (actor.role !== 'student') {
      return fail('This is a session QR code. Students scan it with their own account. To check students in, scan their student ID QR codes.', 'wrong_code');
    }
    session = db.sessions.find((s) => s.id === payload.sessionId);
    if (!session) return fail('This attendance session does not exist.', 'unknown_session');
    if (session.token !== payload.token) return fail('This QR code has expired. Ask your teacher to show the current code.', 'expired');
    studentId = actor.id;
  } else {
    if (actor.role !== 'teacher') {
      return fail('This is a student ID QR code. To check in, scan the session QR code shown by your teacher.', 'wrong_code');
    }
    if (!options.activeSessionId) return fail('Start or select an open attendance session first.', 'no_session');
    session = db.sessions.find((s) => s.id === options.activeSessionId);
    if (!session) return fail('The selected session no longer exists.', 'unknown_session');
    if (!teacherHandlesSection(db, actor, session.sectionId)) return fail('You do not handle this section.', 'forbidden');
    studentId = payload.studentId;
  }

  if (session.closedAt !== null) return fail('This attendance session is already closed.', 'closed');
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return fail('Student ID not recognized.', 'unknown_student');
  if (student.sectionId !== session.sectionId) return fail(`${student.firstName} ${student.lastName} is not enrolled in this section.`, 'not_enrolled');

  const existing = db.records.find((r) => r.sessionId === session!.id && r.studentId === studentId);
  if (existing) {
    return fail(
      `${student.firstName} ${student.lastName} is already marked ${existing.status} for this session. Duplicate scan ignored.`,
      'duplicate',
    );
  }

  const status: AttendanceStatus = now > session.openedAt + session.graceMinutes * 60_000 ? 'late' : 'present';
  const record: AttendanceRecord = {
    id: newId('REC'),
    sessionId: session.id,
    studentId,
    sectionId: session.sectionId,
    date: session.date,
    status,
    recordedAt: now,
    method: payload.kind === 'session' ? 'qr-session' : 'qr-student-id',
    updatedBy: actor.id,
  };
  return { ok: true, db: { ...db, records: [...db.records, record] }, value: { record, student, session } };
}

// ---------------------------------------------------------------------------
// Validation of loaded data
// ---------------------------------------------------------------------------

export function isDatabaseShape(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === 'number' &&
    ['sections', 'students', 'teachers', 'sessions', 'records', 'activities', 'progress'].every((k) => Array.isArray(v[k]))
  );
}
