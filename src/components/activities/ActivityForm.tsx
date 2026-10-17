import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ACTIVITY_TYPE_ORDER, ACTIVITY_TYPES, FORMAT_LABELS, HAS_DEADLINE, SUBJECTS } from '../../lib/activityMeta';
import { todayISO } from '../../lib/date';
import { validateActivity, type ActivityInput } from '../../data/db';
import type { Activity, ActivityFormat, ActivityType, Material } from '../../data/types';
import { Alert, Modal } from '../ui';

interface Props {
  sectionId: string;
  subjects: string[];
  initial?: Activity;
  /** Preset values for a new record (e.g. the date clicked on the calendar). */
  preset?: Partial<ActivityInput>;
  onCancel: () => void;
  /** Return an error message to keep the form open, or null on success. */
  onSubmit: (input: ActivityInput) => string | null;
}

export function ActivityForm({ sectionId, subjects, initial, preset, onCancel, onSubmit }: Props) {
  const subjectOptions = Array.from(new Set([...subjects, ...SUBJECTS]));
  const [type, setType] = useState<ActivityType>(initial?.type ?? preset?.type ?? 'lesson');
  const [subject, setSubject] = useState(initial?.subject ?? preset?.subject ?? subjectOptions[0]);
  const [date, setDate] = useState(initial?.date ?? preset?.date ?? todayISO());
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [format, setFormat] = useState<ActivityFormat>(initial?.format ?? 'individual');
  const [scheduleChange, setScheduleChange] = useState(!!initial?.scheduleChange);
  const [materials, setMaterials] = useState<Material[]>(initial?.materials?.length ? initial.materials : []);
  const [error, setError] = useState<string | null>(null);

  // Quizzes, exams, and events use the class date itself as their scheduled date.
  const canHaveDue = HAS_DEADLINE.includes(type);
  const showInstructions = ['assignment', 'quiz', 'exam', 'performance_task', 'activity'].includes(type);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: ActivityInput = {
      sectionId,
      type,
      subject,
      date,
      title,
      description,
      notes,
      instructions: showInstructions ? instructions : undefined,
      dueDate: canHaveDue ? dueDate : undefined,
      format: type === 'activity' ? format : undefined,
      scheduleChange: type === 'announcement' ? scheduleChange : undefined,
      materials,
    };
    const invalid = validateActivity(input);
    if (invalid) return setError(invalid);
    const err = onSubmit(input);
    if (err) setError(err);
  };

  const dateLabel = type === 'quiz' || type === 'exam' ? 'Date conducted / scheduled' : type === 'event' ? 'Event date' : 'Class date';

  return (
    <Modal
      title={initial ? 'Edit classroom record' : 'Add classroom record'}
      sub="Saved records appear on the student calendar for the selected date."
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="activity-form" className="btn btn-primary">
            {initial ? 'Save changes' : 'Add to calendar'}
          </button>
        </>
      }
    >
      <form id="activity-form" className="form" onSubmit={submit} noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="form-row">
          <div className="field">
            <label htmlFor="af-type">Record type</label>
            <select id="af-type" className="select" value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
              {ACTIVITY_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPES[t].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="af-date">{dateLabel}</label>
            <input id="af-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="af-subject">Subject</label>
            <select id="af-subject" className="select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjectOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {type === 'activity' ? (
            <div className="field">
              <label htmlFor="af-format">Activity format</label>
              <select id="af-format" className="select" value={format} onChange={(e) => setFormat(e.target.value as ActivityFormat)}>
                {(Object.keys(FORMAT_LABELS) as ActivityFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          ) : canHaveDue ? (
            <div className="field">
              <label htmlFor="af-due">Submission deadline *</label>
              <input id="af-due" type="date" className="input" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          ) : (
            <div />
          )}
        </div>
        <div className="field">
          <label htmlFor="af-title">{type === 'lesson' ? 'Topic / lesson title *' : 'Title *'}</label>
          <input id="af-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required />
        </div>
        <div className="field">
          <label htmlFor="af-desc">{type === 'lesson' ? 'Brief description of the lesson' : 'Description'}</label>
          <textarea id="af-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
        {showInstructions && (
          <div className="field">
            <label htmlFor="af-instr">Instructions</label>
            <textarea id="af-instr" className="textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} />
          </div>
        )}
        <div className="field">
          <label htmlFor="af-notes">Important notes / reminders</label>
          <textarea id="af-notes" className="textarea" style={{ minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </div>
        {type === 'announcement' && (
          <label className="checkbox">
            <input type="checkbox" checked={scheduleChange} onChange={(e) => setScheduleChange(e.target.checked)} />
            This announcement is a change in schedule
          </label>
        )}
        <div className="field">
          <span className="label">Learning materials</span>
          {materials.map((m, i) => (
            <div key={i} className="toolbar">
              <input
                className="input search"
                placeholder="Material name (e.g. Module 3 slides)"
                aria-label={`Material ${i + 1} name`}
                value={m.label}
                onChange={(e) => setMaterials((xs) => xs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className="input search"
                placeholder="Link (optional, https://…)"
                aria-label={`Material ${i + 1} link`}
                value={m.url ?? ''}
                onChange={(e) => setMaterials((xs) => xs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <button type="button" className="btn btn-danger btn-icon btn-sm" aria-label={`Remove material ${i + 1}`} onClick={() => setMaterials((xs) => xs.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaterials((xs) => [...xs, { label: '' }])}>
              <Plus size={14} aria-hidden /> Add material
            </button>
          </div>
          <span className="hint">File uploads need a backend; for now, add a name and an optional link (e.g. to Google Drive).</span>
        </div>
      </form>
    </Modal>
  );
}
