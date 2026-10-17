import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ACTIVITY_GROUPS, ACTIVITY_TYPES, type ActivityGroup } from '../../lib/activityMeta';
import { fromISODate, isValidISODate, todayISO } from '../../lib/date';
import { activitiesByDate, attendanceByDate, deadlinesByDate, progressOf, summarize } from '../../data/selectors';
import { setProgress } from '../../data/db';
import { useData } from '../../data/store';
import type { Activity, ISODate } from '../../data/types';
import { Card, useToast } from '../ui';
import { DayDetail } from './DayDetail';
import { MonthCalendar, type DayMarker } from './MonthCalendar';

type Props =
  | { mode: 'student'; studentId: string; sectionId: string }
  | { mode: 'teacher'; sectionId: string; onAdd: (date: ISODate) => void; onEdit: (a: Activity) => void; onDelete: (a: Activity) => void };

/**
 * Interactive class calendar. The selected date is kept in the URL
 * (?date=YYYY-MM-DD), so dashboards and lists can deep-link to a day.
 */
export function CalendarView(props: Props) {
  const { db, run } = useData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const paramDate = params.get('date');
  const selected = paramDate && isValidISODate(paramDate) ? paramDate : todayISO();
  const sel = fromISODate(selected);
  const [view, setView] = useState({ year: sel.getFullYear(), month: sel.getMonth() });
  const [filter, setFilter] = useState<ActivityGroup | 'all'>('all');

  const select = (date: ISODate) => setParams({ date }, { replace: true });

  // On narrow screens the day details sit below the calendar: bring them into view after a tap.
  const selectAndReveal = (date: ISODate) => {
    select(date);
    if (window.matchMedia('(max-width: 1180px)').matches) {
      requestAnimationFrame(() => document.querySelector('.day-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  // Follow the selected date when it changes from outside (e.g. a deep link).
  useEffect(() => {
    const d = fromISODate(selected);
    setView((v) => (v.year === d.getFullYear() && v.month === d.getMonth() ? v : { year: d.getFullYear(), month: d.getMonth() }));
  }, [selected]);

  const allByDate = useMemo(() => activitiesByDate(db, props.sectionId), [db, props.sectionId]);
  const byDate = useMemo(() => {
    if (filter === 'all') return allByDate;
    const m = new Map<ISODate, Activity[]>();
    for (const [k, v] of allByDate) {
      const f = v.filter((a) => ACTIVITY_TYPES[a.type].group === filter);
      if (f.length) m.set(k, f);
    }
    return m;
  }, [allByDate, filter]);
  const dueByDate = useMemo(() => deadlinesByDate(db, props.sectionId), [db, props.sectionId]);

  const studentId = props.mode === 'student' ? props.studentId : null;
  const attendance = useMemo(() => (studentId ? attendanceByDate(db, studentId) : null), [db, studentId]);

  const classRecordsByDate = useMemo(() => {
    if (props.mode !== 'teacher') return null;
    const m = new Map<ISODate, typeof db.records>();
    for (const r of db.records) {
      if (r.sectionId !== props.sectionId) continue;
      const l = m.get(r.date) ?? [];
      l.push(r);
      m.set(r.date, l);
    }
    return m;
  }, [db, props.mode, props.sectionId]);

  const marker = (date: ISODate): DayMarker | null => {
    if (attendance) {
      const r = attendance.get(date);
      return r ? { status: r.status } : null;
    }
    const list = classRecordsByDate?.get(date);
    if (!list?.length) return null;
    const s = summarize(list);
    const out = s.absent + s.excused;
    return out ? { status: 'absent', text: String(out), title: `${out} absent/excused` } : { status: 'present', text: '✓', title: 'Everyone present or late' };
  };

  const dayActivities = allByDate.get(selected) ?? [];
  const dayDeadlines = dueByDate.get(selected) ?? [];

  return (
    <div className="cal-layout">
      <Card>
        <MonthCalendar
          year={view.year}
          month={view.month}
          onMonthChange={(year, month) => setView({ year, month })}
          selected={selected}
          onSelect={select}
          onPick={selectAndReveal}
          activities={byDate}
          deadlines={dueByDate}
          marker={marker}
        />
        <div className="toolbar" style={{ padding: '0 18px 16px' }}>
          <span className="small muted">Show:</span>
          <div className="segmented" role="group" aria-label="Filter calendar records">
            <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </button>
            {ACTIVITY_GROUPS.map((g) => (
              <button key={g.id} aria-pressed={filter === g.id} onClick={() => setFilter(g.id)}>
                {g.title.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {props.mode === 'student' ? (
        <DayDetail
          mode="student"
          date={selected}
          activities={dayActivities}
          deadlines={dayDeadlines}
          record={attendance?.get(selected) ?? null}
          progressOf={(id) => progressOf(db, props.studentId, id)}
          onProgress={(id, status) => {
            const r = run((d) => setProgress(d, { role: 'student', id: props.studentId }, id, status));
            if (!r.ok) toast(r.error, 'error');
          }}
        />
      ) : (
        <DayDetail
          mode="teacher"
          date={selected}
          activities={dayActivities}
          deadlines={dayDeadlines}
          classSummary={classRecordsByDate?.get(selected)?.length ? summarize(classRecordsByDate.get(selected)!) : null}
          onAdd={() => props.onAdd(selected)}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
        />
      )}
    </div>
  );
}
