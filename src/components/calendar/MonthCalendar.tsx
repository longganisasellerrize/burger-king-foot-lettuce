import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { ACTIVITY_TYPE_ORDER, ACTIVITY_TYPES } from '../../lib/activityMeta';
import { addDays, buildMonthGrid, formatLongDate, formatMonthYear, fromISODate, isWeekend, todayISO, WEEKDAY_SHORT } from '../../lib/date';
import type { Activity, AttendanceStatus, ISODate } from '../../data/types';
import { cx, STATUS_LABEL } from '../ui';

export interface DayMarker {
  status: AttendanceStatus;
  /** Short text inside the badge (defaults to the status initial). */
  text?: string;
  title?: string;
}

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  selected: ISODate;
  onSelect: (date: ISODate) => void;
  /** Called instead of onSelect when a date is clicked/tapped (e.g. to scroll the details into view). */
  onPick?: (date: ISODate) => void;
  activities: Map<ISODate, Activity[]>;
  deadlines: Map<ISODate, Activity[]>;
  marker?: (date: ISODate) => DayMarker | null;
}

const MAX_DOTS = 4;

export function MonthCalendar({ year, month, onMonthChange, selected, onSelect, onPick, activities, deadlines, marker }: Props) {
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = todayISO();
  const gridRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  const goToday = () => {
    const t = fromISODate(today);
    onMonthChange(t.getFullYear(), t.getMonth());
    onSelect(today);
  };

  const move = (date: ISODate) => {
    const d = fromISODate(date);
    if (d.getFullYear() !== year || d.getMonth() !== month) onMonthChange(d.getFullYear(), d.getMonth());
    focusPending.current = true;
    onSelect(date);
  };

  // Keep keyboard focus on the selected cell after arrow-key navigation.
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, year, month]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, date: ISODate) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      move(addDays(date, step[e.key]));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const d = fromISODate(date);
      const target = new Date(d.getFullYear(), d.getMonth() + (e.key === 'PageUp' ? -1 : 1), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(d.getDate(), lastDay));
      move(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(today);
    }
  };

  const selectedInView = cells.some((c) => c.date === selected && c.inMonth);
  const firstInMonth = cells.find((c) => c.inMonth)!.date;

  return (
    <div>
      <div className="cal-head">
        <h2 aria-live="polite">{formatMonthYear(year, month)}</h2>
        <div className="spacer" />
        <button className="btn btn-secondary btn-sm" onClick={goToday}>
          Today
        </button>
        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="cal-legend" aria-label="Legend">
        {ACTIVITY_TYPE_ORDER.map((t) => (
          <span key={t} className={`type-${ACTIVITY_TYPES[t].color}`}>
            <i /> {ACTIVITY_TYPES[t].label}
          </span>
        ))}
        {marker && (
          <>
            <span className="st-present">
              <i className="att" /> Present
            </span>
            <span className="st-late">
              <i className="att" /> Late
            </span>
            <span className="st-absent">
              <i className="att" /> Absent
            </span>
          </>
        )}
      </div>

      <div className="cal-grid" role="group" aria-label={`Class calendar, ${formatMonthYear(year, month)}`} ref={gridRef}>
        {WEEKDAY_SHORT.map((d) => (
          <div key={d} className="cal-dow" aria-hidden>
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const list = activities.get(cell.date) ?? [];
          const due = deadlines.get(cell.date) ?? [];
          const types = ACTIVITY_TYPE_ORDER.filter((t) => list.some((a) => a.type === t));
          const m = marker?.(cell.date) ?? null;
          const isSelected = cell.date === selected;
          const tabbable = selectedInView ? isSelected : cell.date === firstInMonth;
          const labelParts = [formatLongDate(cell.date)];
          if (cell.date === today) labelParts.push('today');
          if (m) labelParts.push(m.title ?? STATUS_LABEL[m.status]);
          if (list.length) labelParts.push(`${list.length} classroom record${list.length > 1 ? 's' : ''}`);
          if (due.length) labelParts.push(`${due.length} deadline${due.length > 1 ? 's' : ''}`);
          return (
            <button
              key={cell.date}
              data-date={cell.date}
              aria-pressed={isSelected}
              aria-current={cell.date === today ? 'date' : undefined}
              aria-label={labelParts.join(', ')}
              tabIndex={tabbable ? 0 : -1}
              className={cx(
                'cal-cell',
                !cell.inMonth && 'out',
                isWeekend(cell.date) && 'weekend',
                cell.date === today && 'today',
                isSelected && 'selected',
                m?.status === 'absent' && 'absent',
              )}
              onClick={() => {
                if (!cell.inMonth) {
                  const d = fromISODate(cell.date);
                  onMonthChange(d.getFullYear(), d.getMonth());
                }
                (onPick ?? onSelect)(cell.date);
              }}
              onKeyDown={(e) => onKey(e, cell.date)}
            >
              <span className="cal-top">
                <span className="cal-num">{cell.day}</span>
                {m && (
                  <span className={`cal-att st-${m.status}`} title={m.title ?? STATUS_LABEL[m.status]}>
                    {m.text ?? STATUS_LABEL[m.status][0]}
                  </span>
                )}
              </span>
              {due.length > 0 && (
                <span className="cal-due">
                  <CalendarClock aria-hidden />
                  <span>{due.length} due</span>
                </span>
              )}
              {types.length > 0 && (
                <span className="cal-dots" aria-hidden>
                  {types.slice(0, MAX_DOTS).map((t) => {
                    const Icon = ACTIVITY_TYPES[t].icon;
                    return (
                      <span key={t} className={`cal-dot type-${ACTIVITY_TYPES[t].color}`} title={ACTIVITY_TYPES[t].label}>
                        <Icon />
                      </span>
                    );
                  })}
                  {types.length > MAX_DOTS && <span className="cal-more">+{types.length - MAX_DOTS}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
