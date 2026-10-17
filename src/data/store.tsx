/**
 * Browser-persistent store for the prototype.
 *
 * Data is saved to localStorage on every change, so records survive page
 * refreshes on the same browser and device. Other tabs of the same browser
 * receive updates through the `storage` event (open the teacher view in one
 * tab and the student view in another to see changes appear).
 *
 * Limitation: localStorage is per-browser. A teacher's phone and a student's
 * phone do NOT share data — that requires the backend described in the README.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { isDatabaseShape, type Result } from './db';
import { createSeedDatabase, DB_VERSION } from './seed';
import type { Database } from './types';

const STORAGE_KEY = 'bshs-attendance-db';

export type Persistence = 'local' | 'memory';

interface StoreState {
  db: Database | null;
  error: string | null;
  persistence: Persistence;
}

let state: StoreState = { db: null, error: null, persistence: 'local' };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStorage(): StoreState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (e.g. some private-browsing modes): run in memory.
    return { db: createSeedDatabase(), error: null, persistence: 'memory' };
  }
  if (!raw) {
    const db = createSeedDatabase();
    const persistence = writeStorage(db);
    return { db, error: null, persistence };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDatabaseShape(parsed)) throw new Error('shape');
    if (parsed.version !== DB_VERSION) throw new Error('version');
    return { db: parsed, error: null, persistence: 'local' };
  } catch {
    return {
      db: null,
      error: 'The saved data in this browser could not be read (it may be from an older version or was modified). You can reset it to the sample dataset.',
      persistence: 'local',
    };
  }
}

function writeStorage(db: Database): Persistence {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return 'local';
  } catch {
    return 'memory';
  }
}

function ensureLoaded() {
  if (!state.db && !state.error) state = readStorage();
}

export function setDatabase(db: Database) {
  state = { db, error: null, persistence: writeStorage(db) };
  emit();
}

export function resetDatabase() {
  setDatabase(createSeedDatabase());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureLoaded();
  return state;
}

// ---------------------------------------------------------------------------

interface DataContextValue {
  db: Database;
  persistence: Persistence;
  /** Apply a repository operation; persists on success and returns the result. */
  run: <T>(op: (db: Database) => Result<T>) => Result<T>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: (error: string) => ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      state = { db: null, error: null, persistence: 'local' };
      ensureLoaded();
      emit();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const run = useCallback(<T,>(op: (db: Database) => Result<T>): Result<T> => {
    if (!state.db) return { ok: false, error: 'Data is not loaded.' };
    const result = op(state.db);
    if (result.ok) setDatabase(result.db);
    return result;
  }, []);

  const value = useMemo(() => (snap.db ? { db: snap.db, persistence: snap.persistence, run } : null), [snap, run]);

  if (!value) return <>{fallback(snap.error ?? 'Unknown error loading data.')}</>;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
