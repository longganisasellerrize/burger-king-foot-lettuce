import { AlarmClock, CalendarClock, CalendarOff, CalendarPlus, CheckCircle2, ClipboardCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ACTIVITY_GROUPS, ACTIVITY_TYPES } from '../../lib/activityMeta';
import { diffDays, formatLongDate, formatTime, isWeekend, todayISO } from '../../lib/date';
import type { AttendanceSummary } from '../../data/selectors';
import type { Activity, AttendanceRecord, ProgressStatus } from '../../data/types';
import { ActivityCard } from '../activities/ActivityCard';
import { EmptyState, StatusBadge, STATUS_LABEL } from '../ui';

interface StudentProps {
  mode: 'student';
  record: AttendanceRecord | null;
  progressOf: (activityId: string) => ProgressStatus;
  onProgress: (activityId: string, status: ProgressStatus) => void;
}

interface TeacherProps {
  mode: 'teacher';
  classSummary: AttendanceSummary | null;
  onAdd: () => void;
  onEdit: (a: Activity) => void;
  onDelete: (a: Activity) => void;
}

type Props = (StudentProps | TeacherProps) & {
  date: string;
  activities: Activity[];
  deadlines: Activity[];
};

export function DayDetail(props: Props) {
  const { date, activities, deadlines } = props;
  const today = todayISO();
  const isFuture = date > today;
  const absent = props.mode === 'student' && props.record && (props.record.status === 'absent' || props.record.status === 'excused');

  const renderCard = (a: Activity, open = false) => {
    if (props.mode === 'student') {
      const trackable = ACTIVITY_TYPES[a.type].trackable;
      const showProgress = trackable && (absent || !!a.dueDate);
      return (
        <ActivityCard
          key={a.id}
          activity={a}
          defaultOpen={open}
          progress={showProgress ? props.progressOf(a.id) : undefined}
          onProgress={showProgress ? (v) => props.onProgress(a.id, v) : undefined}
        />
      );
    }
    return <ActivityCard key={a.id} activity={a} defaultOpen={open} onEdit={() => props.onEdit(a)} onDelete={() => props.onDelete(a)} />;
  };

  const groups: ReactNode = ACTIVITY_GROUPS.map((g) => {
    const list = activities.filter((a) => ACTIVITY_TYPES[a.type].group === g.id);
    if (!list.length) return null;
    return (
      <section key={g.id} className="group" aria-label={g.title}>
        <div className="group-title">
          <span className="letter">{g.letter}</span>
          {g.title}
          <span className="muted" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
            ({list.length})
          </span>
        </div>
        {list.map((a) => renderCard(a, activities.length <= 2))}
      </section>
    );
  });

  let attendanceInfo: ReactNode = null;
  if (props.mode === 'student') {
    const r = props.record;
    if (r) {
      attendanceInfo = (
        <div className={`att-strip st-${r.status}`}>
          <ClipboardCheck size={18} aria-hidden />
          <span>Attendance: {STATUS_LABEL[r.status]}</span>
          <span className="muted small">
            {r.status === 'absent' ? 'No check-in recorded' : `Recorded ${formatTime(r.recordedAt)}`}
            {r.note ? ` · ${r.note}` : ''}
          </span>
        </div>
      );
    } else if (!isWeekend(date) && !isFuture) {
      attendanceInfo = (
        <div className="att-strip st-none">
          <ClipboardCheck size={18} aria-hidden />
          <span>No attendance record for this date</span>
        </div>
      );
    }
  } else if (props.classSummary) {
    const s = props.classSummary;
    attendanceInfo = (
      <div className="att-strip st-none" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ClipboardCheck size={18} aria-hidden /> Class attendance
        </span>
        <span className="small" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="badge st-present">{s.present} present</span>
          <span className="badge st-late">{s.late} late</span>
          <span className="badge st-absent">{s.absent} absent</span>
          {s.excused > 0 && <span className="badge st-excused">{s.excused} excused</span>}
        </span>
      </div>
    );
  }

  const relative = diffDays(today, date);
  const relLabel = relative === 0 ? 'Today' : relative === -1 ? 'Yesterday' : relative === 1 ? 'Tomorrow' : null;

  return (
    <div className="card day-panel" aria-live="polite">
      <div className="day-head day-enter" key={`h-${date}`}>
        <div className="row">
          <div>
            <div className="small muted" style={{ fontWeight: 600 }}>
              {relLabel ?? (isFuture ? 'Upcoming' : 'Selected date')}
            </div>
            <h2>{formatLongDate(date)}</h2>
          </div>
          {props.mode === 'teacher' ? (
            <button className="btn btn-primary btn-sm" onClick={props.onAdd}>
              <CalendarPlus size={16} aria-hidden /> Add record
            </button>
          ) : (
            props.record && <StatusBadge status={props.record.status} />
          )}
        </div>
        {attendanceInfo}
      </div>

      <div className="scroll">
        <div className="day-body day-enter" key={`b-${date}`}>
          {activities.length === 0 && deadlines.length === 0 ? (
            isWeekend(date) ? (
              <EmptyState icon={CalendarOff} title="No classes">
                This is a weekend. Nothing was recorded for this day.
              </EmptyState>
            ) : (
              <EmptyState
                icon={CalendarOff}
                title={isFuture ? 'Nothing scheduled yet' : 'No classroom records'}
                action={
                  props.mode === 'teacher' ? (
                    <button className="btn btn-primary btn-sm" onClick={props.onAdd}>
                      <CalendarPlus size={16} aria-hidden /> Add a record for this day
                    </button>
                  ) : undefined
                }
              >
                {props.mode === 'teacher'
                  ? 'Record the lessons, activities, assignments, or announcements for this date.'
                  : isFuture
                    ? 'Your teacher has not posted anything for this date yet.'
                    : 'Your teacher has not recorded any lessons or activities for this date.'}
              </EmptyState>
            )
          ) : absent ? (
            <section className="missed-box" aria-label="Activities you missed">
              <header>
                <span className="icon">
                  <AlarmClock size={18} aria-hidden />
                </span>
                <div>
                  <h3>Activities You Missed</h3>
                  <p className="small" style={{ color: '#7f1d1d' }}>
                    You were marked {props.mode === 'student' && props.record ? STATUS_LABEL[props.record.status].toLowerCase() : 'absent'} on this day.
                    Review the {activities.length} record{activities.length === 1 ? '' : 's'} below and update your progress as you catch up.
                  </p>
                </div>
              </header>
              {activities.length ? groups : <p className="small muted">No classroom records were posted for this day.</p>}
            </section>
          ) : (
            groups
          )}

          {deadlines.length > 0 && (
            <section className="group" aria-label="Deadlines on this day">
              <div className="group-title">
                <span className="letter">
                  <CalendarClock size={12} aria-hidden />
                </span>
                Due on this day ({deadlines.length})
              </div>
              {deadlines.map((a) => renderCard(a))}
            </section>
          )}

          {props.mode === 'student' && activities.length > 0 && !absent && props.record && (
            <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle2 size={14} aria-hidden /> You attended this day. Open a record to review the details.
            </p>
          )}
          {props.mode === 'teacher' && activities.length > 0 && (
            <p className="small muted">
              Changes here update the student calendar immediately. <Link to="/teacher/activities">Manage all records</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
