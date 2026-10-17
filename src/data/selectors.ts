/**
 * Read-only queries that connect attendance records with classroom activities.
 */
import { diffDays, todayISO } from '../lib/date';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_ORDER } from '../lib/activityMeta';
import type { Activity, AttendanceRecord, AttendanceStatus, Database, ISODate, ProgressStatus } from './types';

export const MISSED_STATUSES: AttendanceStatus[] = ['absent', 'excused'];

export function studentRecords(db: Database, studentId: string): AttendanceRecord[] {
  return db.records.filter((r) => r.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt - a.recordedAt);
}

/**
 * The student's attendance per date. If a day had several sessions, the
 * "worst" status wins so an afternoon absence is not hidden by a morning check-in.
 */
export function attendanceByDate(db: Database, studentId: string): Map<ISODate, AttendanceRecord> {
  const rank: Record<AttendanceStatus, number> = { present: 0, late: 1, excused: 2, absent: 3 };
  const map = new Map<ISODate, AttendanceRecord>();
  for (const r of db.records) {
    if (r.studentId !== studentId) continue;
    const prev = map.get(r.date);
    if (!prev || rank[r.status] > rank[prev.status]) map.set(r.date, r);
  }
  return map;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** (present + late) / total, 0–100, or null when there are no records. */
  rate: number | null;
}

export function summarize(records: AttendanceRecord[]): AttendanceSummary {
  const s = { total: records.length, present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of records) s[r.status]++;
  return { ...s, rate: s.total ? Math.round(((s.present + s.late) / s.total) * 1000) / 10 : null };
}

export function attendanceSummary(db: Database, studentId: string): AttendanceSummary {
  return summarize([...attendanceByDate(db, studentId).values()]);
}

export function sortActivities(list: Activity[]): Activity[] {
  return [...list].sort(
    (a, b) => ACTIVITY_TYPE_ORDER.indexOf(a.type) - ACTIVITY_TYPE_ORDER.indexOf(b.type) || a.subject.localeCompare(b.subject) || a.createdAt - b.createdAt,
  );
}

export function sectionActivities(db: Database, sectionId: string): Activity[] {
  return db.activities.filter((a) => a.sectionId === sectionId);
}

export function activitiesByDate(db: Database, sectionId: string): Map<ISODate, Activity[]> {
  const map = new Map<ISODate, Activity[]>();
  for (const a of sectionActivities(db, sectionId)) {
    const list = map.get(a.date) ?? [];
    list.push(a);
    map.set(a.date, list);
  }
  for (const [k, v] of map) map.set(k, sortActivities(v));
  return map;
}

/** Assignments / performance tasks whose deadline falls on each date. */
export function deadlinesByDate(db: Database, sectionId: string): Map<ISODate, Activity[]> {
  const map = new Map<ISODate, Activity[]>();
  for (const a of sectionActivities(db, sectionId)) {
    if (!a.dueDate || a.dueDate === a.date) continue;
    const list = map.get(a.dueDate) ?? [];
    list.push(a);
    map.set(a.dueDate, list);
  }
  return map;
}

export function progressOf(db: Database, studentId: string, activityId: string): ProgressStatus {
  return db.progress.find((p) => p.studentId === studentId && p.activityId === activityId)?.status ?? 'not_started';
}

export interface MissedDay {
  date: ISODate;
  record: AttendanceRecord;
  activities: Activity[];
}

/**
 * Steps 1–3 of the missed-learning feature: find the student's absences, then
 * the activities recorded on those dates, grouped per day (newest first).
 */
export function missedDays(db: Database, studentId: string): MissedDay[] {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return [];
  const byDate = activitiesByDate(db, student.sectionId);
  return [...attendanceByDate(db, studentId).values()]
    .filter((r) => MISSED_STATUSES.includes(r.status))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((record) => ({ date: record.date, record, activities: byDate.get(record.date) ?? [] }));
}

export type Urgency = 'overdue' | 'due_soon' | 'upcoming' | 'none';

/** Step 4: classify deadlines so pending work with close deadlines stands out. */
export function urgencyOf(activity: Activity, progress: ProgressStatus, today: ISODate = todayISO()): Urgency {
  if (!activity.dueDate || progress === 'completed') return 'none';
  const days = diffDays(today, activity.dueDate);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due_soon';
  return 'upcoming';
}

export interface MissedItem {
  activity: Activity;
  missedOn: ISODate;
  status: ProgressStatus;
  urgency: Urgency;
}

/** Flat list of trackable missed items (lessons, activities, assessments). */
export function missedItems(db: Database, studentId: string, today: ISODate = todayISO()): MissedItem[] {
  const items: MissedItem[] = [];
  for (const day of missedDays(db, studentId)) {
    for (const a of day.activities) {
      if (!ACTIVITY_TYPES[a.type].trackable) continue;
      const status = progressOf(db, studentId, a.id);
      items.push({ activity: a, missedOn: day.date, status, urgency: urgencyOf(a, status, today) });
    }
  }
  const order: Record<Urgency, number> = { overdue: 0, due_soon: 1, upcoming: 2, none: 3 };
  return items.sort((a, b) => order[a.urgency] - order[b.urgency] || b.missedOn.localeCompare(a.missedOn));
}

/** Assignments, performance tasks, quizzes, exams, and events from today onward. */
export function upcomingItems(db: Database, sectionId: string, today: ISODate = todayISO(), withinDays = 30): Activity[] {
  return sectionActivities(db, sectionId)
    .map((a) => ({ a, when: a.dueDate ?? a.date }))
    .filter(({ a, when }) => {
      if (!['assignment', 'performance_task', 'quiz', 'exam', 'event'].includes(a.type)) return false;
      const d = diffDays(today, when);
      return d >= 0 && d <= withinDays;
    })
    .sort((x, y) => x.when.localeCompare(y.when))
    .map(({ a }) => a);
}

export function announcements(db: Database, sectionId: string): Activity[] {
  return sectionActivities(db, sectionId)
    .filter((a) => a.type === 'announcement' || a.type === 'event')
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function studentName(db: Database, studentId: string): string {
  const s = db.students.find((x) => x.id === studentId);
  return s ? `${s.firstName} ${s.lastName}` : studentId;
}
