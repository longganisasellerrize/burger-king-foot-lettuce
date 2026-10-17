import { describe, expect, it } from 'vitest';
import { addDays, buildMonthGrid, todayISO } from '../lib/date';
import { buildSessionPayload, buildStudentPayload } from '../lib/qr';
import {
  closeSession,
  createActivity,
  deleteActivity,
  recordScan,
  setAttendanceStatus,
  setProgress,
  startSession,
  updateActivity,
  type ActivityInput,
  type Actor,
} from './db';
import { activitiesByDate, attendanceSummary, missedDays, missedItems, progressOf } from './selectors';
import { createSeedDatabase, DEMO_STUDENT_ID, SAMPLE_SECTION_ID, SAMPLE_TEACHER_ID } from './seed';

const teacher: Actor = { role: 'teacher', id: SAMPLE_TEACHER_ID };
const student: Actor = { role: 'student', id: DEMO_STUDENT_ID };
const today = todayISO();

function unwrap<T>(r: { ok: true; value: T; db: ReturnType<typeof createSeedDatabase> } | { ok: false; error: string }) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

const baseInput = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  sectionId: SAMPLE_SECTION_ID,
  date: today,
  type: 'lesson',
  subject: 'General Mathematics',
  title: 'Test lesson',
  description: 'desc',
  ...over,
});

describe('calendar grid', () => {
  it('always has 42 cells starting on Sunday and includes every day of the month', () => {
    for (let m = 0; m < 12; m++) {
      const cells = buildMonthGrid(2026, m);
      expect(cells).toHaveLength(42);
      const inMonth = cells.filter((c) => c.inMonth);
      expect(inMonth[0].day).toBe(1);
      expect(inMonth.length).toBe(new Date(2026, m + 1, 0).getDate());
    }
  });
  it('handles leap years', () => {
    expect(buildMonthGrid(2028, 1).filter((c) => c.inMonth)).toHaveLength(29);
  });
});

describe('seed data', () => {
  it('gives the demo student absences with recorded activities', () => {
    const db = createSeedDatabase(today);
    const days = missedDays(db, DEMO_STUDENT_ID);
    expect(days.length).toBe(3);
    expect(days.every((d) => d.activities.length > 0)).toBe(true);
    const sum = attendanceSummary(db, DEMO_STUDENT_ID);
    expect(sum.absent).toBe(3);
    expect(sum.rate).toBeGreaterThan(80);
  });
});

describe('activities', () => {
  it('teacher-created activity appears on the student calendar date, and updates/deletes propagate', () => {
    let db = createSeedDatabase(today);
    const date = addDays(today, 5);
    const created = unwrap(createActivity(db, teacher, baseInput({ date, title: 'New lab' })));
    db = created.db;
    expect(activitiesByDate(db, SAMPLE_SECTION_ID).get(date)?.some((a) => a.title === 'New lab')).toBe(true);

    db = unwrap(updateActivity(db, teacher, created.value.id, baseInput({ date: addDays(date, 1), title: 'Moved lab' }))).db;
    expect(activitiesByDate(db, SAMPLE_SECTION_ID).get(date)?.some((a) => a.id === created.value.id) ?? false).toBe(false);
    expect(activitiesByDate(db, SAMPLE_SECTION_ID).get(addDays(date, 1))?.find((a) => a.id === created.value.id)?.title).toBe('Moved lab');

    db = unwrap(deleteActivity(db, teacher, created.value.id)).db;
    expect(db.activities.some((a) => a.id === created.value.id)).toBe(false);
  });

  it('students cannot create or delete activities', () => {
    const db = createSeedDatabase(today);
    expect(createActivity(db, student, baseInput()).ok).toBe(false);
    expect(deleteActivity(db, student, db.activities[0].id).ok).toBe(false);
  });

  it('requires a deadline for assignments', () => {
    const db = createSeedDatabase(today);
    const r = createActivity(db, teacher, baseInput({ type: 'assignment' }));
    expect(r.ok).toBe(false);
  });

  it('an activity added on a date the student was absent becomes a missed item', () => {
    let db = createSeedDatabase(today);
    const absentDate = missedDays(db, DEMO_STUDENT_ID)[0].date;
    db = unwrap(createActivity(db, teacher, baseInput({ date: absentDate, type: 'assignment', title: 'Late-added HW', dueDate: addDays(today, 2) }))).db;
    const item = missedItems(db, DEMO_STUDENT_ID, today).find((i) => i.activity.title === 'Late-added HW');
    expect(item).toBeDefined();
    expect(item!.urgency).toBe('due_soon');
  });
});

describe('progress', () => {
  it('students can set their own progress', () => {
    let db = createSeedDatabase(today);
    const id = missedItems(db, DEMO_STUDENT_ID)[0].activity.id;
    db = unwrap(setProgress(db, student, id, 'completed')).db;
    expect(progressOf(db, DEMO_STUDENT_ID, id)).toBe('completed');
    expect(setProgress(db, teacher, id, 'completed').ok).toBe(false);
  });
});

describe('attendance sessions and QR scanning', () => {
  it('records a student session scan, rejects duplicates, and auto-marks absentees on close', () => {
    let db = createSeedDatabase(today);
    const started = unwrap(startSession(db, teacher, { sectionId: SAMPLE_SECTION_ID, date: today, label: 'Test', graceMinutes: 15 }, 1_000));
    db = started.db;
    const payload = buildSessionPayload(started.value.id, started.value.token);

    const first = unwrap(recordScan(db, student, payload, { now: 2_000 }));
    expect(first.value.record.status).toBe('present');
    db = first.db;

    const dup = recordScan(db, student, payload, { now: 3_000 });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.code).toBe('duplicate');

    const closed = unwrap(closeSession(db, teacher, started.value.id));
    expect(closed.value.markedAbsent).toBe(db.students.length - 1);
    const afterClose = recordScan(closed.db, { role: 'student', id: db.students[1].id }, payload);
    expect(afterClose.ok).toBe(false);
  });

  it('marks late scans after the grace period', () => {
    let db = createSeedDatabase(today);
    const s = unwrap(startSession(db, teacher, { sectionId: SAMPLE_SECTION_ID, date: today, label: 'T', graceMinutes: 10 }, 0));
    db = s.db;
    const r = unwrap(recordScan(db, { role: 'teacher', id: SAMPLE_TEACHER_ID }, buildStudentPayload(DEMO_STUDENT_ID), { activeSessionId: s.value.id, now: 11 * 60_000 }));
    expect(r.value.record.status).toBe('late');
  });

  it('rejects invalid, expired, and wrong-role codes', () => {
    let db = createSeedDatabase(today);
    const s = unwrap(startSession(db, teacher, { sectionId: SAMPLE_SECTION_ID, date: today, label: 'T', graceMinutes: 10 }));
    db = s.db;
    const codeOf = (r: ReturnType<typeof recordScan>) => (r.ok ? 'ok' : r.code);
    expect(codeOf(recordScan(db, student, 'hello world'))).toBe('invalid_qr');
    expect(codeOf(recordScan(db, student, buildSessionPayload(s.value.id, 'wrongtoken')))).toBe('expired');
    expect(codeOf(recordScan(db, student, buildStudentPayload(DEMO_STUDENT_ID)))).toBe('wrong_code');
    expect(codeOf(recordScan(db, teacher, buildStudentPayload('NOPE'), { activeSessionId: s.value.id }))).toBe('unknown_student');
  });

  it('only allows one open session per section', () => {
    let db = createSeedDatabase(today);
    db = unwrap(startSession(db, teacher, { sectionId: SAMPLE_SECTION_ID, date: today, label: 'A', graceMinutes: 10 })).db;
    expect(startSession(db, teacher, { sectionId: SAMPLE_SECTION_ID, date: today, label: 'B', graceMinutes: 10 }).ok).toBe(false);
  });

  it('teacher can override a status; students cannot', () => {
    const db = createSeedDatabase(today);
    const rec = db.records.find((r) => r.studentId === DEMO_STUDENT_ID && r.status === 'absent')!;
    const r = unwrap(setAttendanceStatus(db, teacher, rec.sessionId, DEMO_STUDENT_ID, 'excused', 'Medical certificate'));
    expect(r.value.status).toBe('excused');
    expect(setAttendanceStatus(db, student, rec.sessionId, DEMO_STUDENT_ID, 'present').ok).toBe(false);
  });
});
