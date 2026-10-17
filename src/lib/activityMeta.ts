import {
  BookOpen,
  ClipboardList,
  FileQuestion,
  FileText,
  GraduationCap,
  Megaphone,
  PartyPopper,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityFormat, ActivityType, ProgressStatus } from '../data/types';

export interface ActivityTypeMeta {
  label: string;
  /** CSS custom property suffix, e.g. "lesson" -> var(--c-lesson). */
  color: string;
  icon: LucideIcon;
  /** Which section of the expanded day view the activity belongs to. */
  group: ActivityGroup;
  /** Whether students track completion for this type. */
  trackable: boolean;
}

export type ActivityGroup = 'activities' | 'lessons' | 'assessments' | 'events';

export const ACTIVITY_TYPES: Record<ActivityType, ActivityTypeMeta> = {
  lesson: { label: 'Lesson', color: 'lesson', icon: BookOpen, group: 'lessons', trackable: true },
  activity: { label: 'Class Activity', color: 'activity', icon: Users, group: 'activities', trackable: true },
  assignment: { label: 'Assignment', color: 'assignment', icon: FileText, group: 'assessments', trackable: true },
  quiz: { label: 'Quiz', color: 'quiz', icon: FileQuestion, group: 'assessments', trackable: true },
  exam: { label: 'Examination', color: 'exam', icon: GraduationCap, group: 'assessments', trackable: true },
  performance_task: { label: 'Performance Task', color: 'ptask', icon: ClipboardList, group: 'assessments', trackable: true },
  announcement: { label: 'Announcement', color: 'announcement', icon: Megaphone, group: 'events', trackable: false },
  event: { label: 'School Event', color: 'event', icon: PartyPopper, group: 'events', trackable: false },
};

export const ACTIVITY_TYPE_ORDER: ActivityType[] = [
  'lesson',
  'activity',
  'assignment',
  'quiz',
  'exam',
  'performance_task',
  'announcement',
  'event',
];

export const ACTIVITY_GROUPS: { id: ActivityGroup; title: string; letter: string; description: string }[] = [
  { id: 'lessons', letter: 'A', title: 'Lessons Discussed', description: 'Topics, summaries, and learning materials' },
  { id: 'activities', letter: 'B', title: 'Class Activities', description: 'Group work, seatwork, laboratory and practical exercises' },
  { id: 'assessments', letter: 'C', title: 'Assignments & Assessments', description: 'Homework, quizzes, exams, and performance tasks' },
  { id: 'events', letter: 'D', title: 'Events & Announcements', description: 'Announcements, schedule changes, and classroom events' },
];

export const FORMAT_LABELS: Record<ActivityFormat, string> = {
  individual: 'Individual exercise',
  group: 'Group activity',
  seatwork: 'Seatwork',
  laboratory: 'Laboratory activity',
  practical: 'Practical exercise',
};

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

/** Types whose dueDate is a submission deadline (vs. a scheduled date). */
export const HAS_DEADLINE: ActivityType[] = ['assignment', 'performance_task'];

export function dueLabel(type: ActivityType): string {
  if (HAS_DEADLINE.includes(type)) return 'Deadline';
  if (type === 'event') return 'Event date';
  return 'Scheduled on';
}

export const SUBJECTS = [
  'General Mathematics',
  'EALS',
  'Oral Communication',
  'Komunikasyon at Pananaliksik',
  'FPL',
  'HOPE',
  'Homeroom / Advisory',
];
