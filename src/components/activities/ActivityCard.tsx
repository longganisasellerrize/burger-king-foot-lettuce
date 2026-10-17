import { CalendarClock, ChevronDown, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { ACTIVITY_TYPES, dueLabel, FORMAT_LABELS, PROGRESS_LABELS } from '../../lib/activityMeta';
import { formatMediumDate, formatShortDate, relativeDue } from '../../lib/date';
import { urgencyOf, type Urgency } from '../../data/selectors';
import type { Activity, ProgressStatus } from '../../data/types';
import { cx, TypeIcon } from '../ui';

const URGENCY_LABEL: Record<Exclude<Urgency, 'none'>, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
};

function safeUrl(url?: string) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function ProgressControl({ value, onChange, label }: { value: ProgressStatus; onChange: (v: ProgressStatus) => void; label: string }) {
  return (
    <select className="progress-select" data-status={value} value={value} aria-label={`Progress for ${label}`} onChange={(e) => onChange(e.target.value as ProgressStatus)}>
      {(Object.keys(PROGRESS_LABELS) as ProgressStatus[]).map((k) => (
        <option key={k} value={k}>
          {PROGRESS_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

export function DueBadge({ activity, progress }: { activity: Activity; progress?: ProgressStatus }) {
  if (!activity.dueDate) return null;
  const urgency = urgencyOf(activity, progress ?? 'not_started');
  if (urgency === 'none') return null;
  return (
    <span className={`badge urg-${urgency}`} title={`${dueLabel(activity.type)}: ${formatMediumDate(activity.dueDate)}`}>
      <CalendarClock aria-hidden />
      {urgency === 'upcoming' ? relativeDue(activity.dueDate) : `${URGENCY_LABEL[urgency]} · ${relativeDue(activity.dueDate)}`}
    </span>
  );
}

interface Props {
  activity: Activity;
  defaultOpen?: boolean;
  /** Show the class date in the meta line (useful in lists spanning many days). */
  showDate?: boolean;
  /** Student progress tracking. */
  progress?: ProgressStatus;
  onProgress?: (v: ProgressStatus) => void;
  /** Teacher actions. */
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: ReactNode;
}

export function ActivityCard({ activity: a, defaultOpen, showDate, progress, onProgress, onEdit, onDelete, extra }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const detailId = useId();
  const meta = ACTIVITY_TYPES[a.type];

  return (
    <article className={cx('act', `type-${meta.color}`)} data-open={open}>
      <button className="act-summary" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((o) => !o)}>
        <TypeIcon type={a.type} />
        <div className="grow">
          <div className="act-title">{a.title}</div>
          <div className="act-meta">
            <span style={{ color: 'var(--c)', fontWeight: 650 }}>{a.format ? FORMAT_LABELS[a.format] : meta.label}</span>
            <span>{a.subject}</span>
            {showDate && <span>{formatShortDate(a.date)}</span>}
            {a.dueDate && (
              <span>
                {dueLabel(a.type)}: {formatShortDate(a.dueDate)}
              </span>
            )}
            {a.scheduleChange && <span style={{ color: 'var(--c-ptask)', fontWeight: 650 }}>Schedule change</span>}
          </div>
        </div>
        <ChevronDown size={18} className="act-chevron" aria-hidden />
      </button>
      {(onProgress || onEdit || onDelete || a.dueDate || extra) && (
        <div className="act-actions" style={{ padding: '0 12px 10px 56px' }}>
          <DueBadge activity={a} progress={progress} />
          {extra}
          {onProgress && progress && <ProgressControl value={progress} onChange={onProgress} label={a.title} />}
          {onEdit && (
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>
              <Pencil size={14} aria-hidden /> Edit
            </button>
          )}
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              <Trash2 size={14} aria-hidden /> Delete
            </button>
          )}
        </div>
      )}
      <div className="act-detail" id={detailId}>
        <div>
          <div className="act-detail-inner">
            <dl>
              {a.description && (
                <div>
                  <dt>Description</dt>
                  <dd>{a.description}</dd>
                </div>
              )}
              {a.instructions && (
                <div>
                  <dt>Instructions</dt>
                  <dd>{a.instructions}</dd>
                </div>
              )}
              {a.notes && (
                <div>
                  <dt>Teacher’s notes</dt>
                  <dd>{a.notes}</dd>
                </div>
              )}
              {a.dueDate && (
                <div>
                  <dt>{dueLabel(a.type)}</dt>
                  <dd>
                    {formatMediumDate(a.dueDate)} ({relativeDue(a.dueDate)})
                  </dd>
                </div>
              )}
              {!!a.materials?.length && (
                <div>
                  <dt>Learning materials</dt>
                  <dd>
                    <ul>
                      {a.materials.map((m, i) => {
                        const href = safeUrl(m.url);
                        return (
                          <li key={i}>
                            <Paperclip size={12} aria-hidden />{' '}
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer">
                                {m.label}
                              </a>
                            ) : (
                              m.label
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
                </div>
              )}
              <div className="small muted">
                Recorded for {formatMediumDate(a.date)}
                {a.updatedAt !== a.createdAt && ' · edited'}
                {progress && ` · Your progress: ${PROGRESS_LABELS[progress]}`}
              </div>
            </dl>
          </div>
        </div>
      </div>
    </article>
  );
}
