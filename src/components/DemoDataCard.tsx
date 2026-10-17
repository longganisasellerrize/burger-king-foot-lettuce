import { Database as DbIcon, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { resetDatabase, useData } from '../data/store';
import { Card, CardHead, ConfirmDialog, useToast } from './ui';

/** Shows where the prototype keeps its data and lets the demo be reset. */
export function DemoDataCard() {
  const { db, persistence } = useData();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  return (
    <Card>
      <CardHead icon={DbIcon} title="Prototype data" sub="How this demonstration stores information" />
      <div className="card-body" style={{ display: 'grid', gap: 10 }}>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          <li>
            Storage: <strong>{persistence === 'local' ? 'this browser’s localStorage' : 'memory only (storage blocked)'}</strong>. Data survives page
            refreshes{persistence === 'memory' ? ' only while this tab is open' : ''}, but is not shared with other devices.
          </li>
          <li>
            Dataset: <strong>{db.isSampleData ? 'sample data' : 'custom'}</strong> · {db.students.length} students · {db.activities.length} classroom
            records · {db.records.length} attendance records.
          </li>
          <li>Sign-in is a demo account picker; there is no password or server-side verification.</li>
        </ul>
        <div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>
            <RotateCcw size={14} aria-hidden /> Reset demo data
          </button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Reset demo data?"
          message="All changes made in this browser (added activities, check-ins, progress) will be replaced with a fresh sample dataset dated around today."
          confirmLabel="Reset"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            resetDatabase();
            setConfirm(false);
            toast('Demo data has been reset.');
          }}
        />
      )}
    </Card>
  );
}
