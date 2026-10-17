/**
 * Domain types for the attendance + class calendar prototype.
 *
 * These mirror the tables a real backend would hold (users, sections,
 * attendance sessions, attendance records, classroom activities, and
 * per-student progress), so the localStorage repository in `db.ts` can later
 * be swapped for API calls without changing the UI.
 */

export type Role = 'student' | 'teacher';

/** ISO calendar date in local time, e.g. "2026-10-20". */
export type ISODate = string;

export interface Section {
  id: string;
  name: string; // e.g. "Grade 11 – STEM A"
  gradeLevel: number;
  schoolYear: string;
  adviserId: string;
}

export interface Student {
  id: string; // student number used in the student ID QR code
  firstName: string;
  lastName: string;
  sectionId: string;
  gender?: 'M' | 'F';
  guardian?: string;
  email?: string;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  title: string; // e.g. "Ms.", "Mr."
  subjects: string[];
  sectionIds: string[];
  email?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

/** How the record was created. */
export type RecordMethod = 'qr-session' | 'qr-student-id' | 'manual' | 'auto-absent' | 'sample';

/** One attendance-taking session (e.g. the daily homeroom check-in). */
export interface AttendanceSession {
  id: string;
  sectionId: string;
  date: ISODate;
  label: string; // e.g. "Morning homeroom"
  /** Epoch ms when scanning opened. */
  openedAt: number;
  /** Students who scan after openedAt + graceMinutes are marked late. */
  graceMinutes: number;
  /** Epoch ms when the session was closed, or null while open. */
  closedAt: number | null;
  /** Random token embedded in the session QR code. Rotating it invalidates old printouts/screenshots. */
  token: string;
  createdBy: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  sectionId: string;
  date: ISODate;
  status: AttendanceStatus;
  /** Epoch ms when recorded (scan time, or edit time for manual changes). */
  recordedAt: number;
  method: RecordMethod;
  note?: string;
  updatedBy?: string;
}

export type ActivityType =
  | 'lesson'
  | 'activity'
  | 'assignment'
  | 'quiz'
  | 'exam'
  | 'performance_task'
  | 'announcement'
  | 'event';

/** Format of an in-class activity (only meaningful when type === 'activity'). */
export type ActivityFormat = 'individual' | 'group' | 'seatwork' | 'laboratory' | 'practical';

export interface Material {
  label: string;
  url?: string;
}

export interface Activity {
  id: string;
  sectionId: string;
  /** The class day the activity happened / was given. */
  date: ISODate;
  type: ActivityType;
  subject: string;
  title: string;
  description: string;
  /** Teacher notes, key points, reminders. */
  notes?: string;
  instructions?: string;
  materials?: Material[];
  /** Submission deadline (assignments, performance tasks) or schedule date (quiz/exam/event). */
  dueDate?: ISODate;
  format?: ActivityFormat;
  /** Marks an announcement as a schedule change so it is highlighted. */
  scheduleChange?: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProgressEntry {
  studentId: string;
  activityId: string;
  status: ProgressStatus;
  updatedAt: number;
}

export interface Database {
  version: number;
  /** True for the bundled demonstration dataset. Shown in the UI. */
  isSampleData: boolean;
  seededAt: number;
  sections: Section[];
  students: Student[];
  teachers: Teacher[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  activities: Activity[];
  progress: ProgressEntry[];
}
