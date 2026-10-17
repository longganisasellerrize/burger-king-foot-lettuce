import { useState, type ReactNode } from 'react';
import { useTeacher } from '../../auth/AuthContext';
import { createActivity, deleteActivity, updateActivity, type ActivityInput } from '../../data/db';
import { useData } from '../../data/store';
import type { Activity } from '../../data/types';
import { formatMediumDate } from '../../lib/date';
import { ConfirmDialog, useToast } from '../ui';
import { ActivityForm } from './ActivityForm';

type EditorState = { mode: 'new'; preset?: Partial<ActivityInput> } | { mode: 'edit'; activity: Activity } | { mode: 'delete'; activity: Activity } | null;

/** Add / edit / delete flow for classroom records, shared by all teacher pages. */
export function useActivityEditor(): {
  openNew: (preset?: Partial<ActivityInput>) => void;
  openEdit: (a: Activity) => void;
  requestDelete: (a: Activity) => void;
  element: ReactNode;
} {
  const teacher = useTeacher();
  const { run } = useData();
  const toast = useToast();
  const [state, setState] = useState<EditorState>(null);
  const actor = { role: 'teacher' as const, id: teacher.id };
  const sectionId = teacher.sectionIds[0];
  const close = () => setState(null);

  let element: ReactNode = null;
  if (state?.mode === 'new' || state?.mode === 'edit') {
    element = (
      <ActivityForm
        sectionId={sectionId}
        subjects={teacher.subjects}
        initial={state.mode === 'edit' ? state.activity : undefined}
        preset={state.mode === 'new' ? state.preset : undefined}
        onCancel={close}
        onSubmit={(input) => {
          const r = state.mode === 'edit' ? run((db) => updateActivity(db, actor, state.activity.id, input)) : run((db) => createActivity(db, actor, input));
          if (!r.ok) return r.error;
          toast(state.mode === 'edit' ? 'Changes saved. The student calendar is updated.' : `Added to the calendar on ${formatMediumDate(input.date)}.`);
          close();
          return null;
        }}
      />
    );
  } else if (state?.mode === 'delete') {
    element = (
      <ConfirmDialog
        title="Delete this record?"
        message={
          <>
            <strong>{state.activity.title}</strong> ({formatMediumDate(state.activity.date)}) will be removed from the class calendar and from students’ missed-activity lists, along with their progress on it. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onCancel={close}
        onConfirm={() => {
          const r = run((db) => deleteActivity(db, actor, state.activity.id));
          toast(r.ok ? 'Record deleted.' : r.error, r.ok ? 'success' : 'error');
          close();
        }}
      />
    );
  }

  return {
    openNew: (preset) => setState({ mode: 'new', preset }),
    openEdit: (activity) => setState({ mode: 'edit', activity }),
    requestDelete: (activity) => setState({ mode: 'delete', activity }),
    element,
  };
}
