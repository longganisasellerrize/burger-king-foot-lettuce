import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ACTIVITY_TYPES } from '../../lib/activityMeta';
import type { ActivityType, AttendanceStatus } from '../../data/types';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx('card', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHead({ title, sub, icon: Icon, action }: { title: ReactNode; sub?: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h2>
          {Icon && <Icon size={18} aria-hidden />}
          {title}
        </h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone, hint }: { icon: LucideIcon; label: string; value: ReactNode; tone?: string; hint?: ReactNode }) {
  return (
    <div className={cx('card stat', tone)}>
      <div className="stat-icon">
        <Icon size={20} aria-hidden />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="small muted">{hint}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={22} aria-hidden />
      </div>
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success' | 'warn'; children: ReactNode }) {
  const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials = name
    .split(' ')
    .filter((p) => /^[A-Za-z]/.test(p))
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className={cx('avatar', large && 'avatar-lg')} aria-hidden>
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export function TypeBadge({ type }: { type: ActivityType }) {
  const meta = ACTIVITY_TYPES[type];
  const Icon = meta.icon;
  return (
    <span className={`badge type-${meta.color}`}>
      <Icon aria-hidden />
      {meta.label}
    </span>
  );
}

export function TypeIcon({ type }: { type: ActivityType }) {
  const meta = ACTIVITY_TYPES[type];
  const Icon = meta.icon;
  return (
    <span className={`type-icon type-${meta.color}`} aria-hidden>
      <Icon />
    </span>
  );
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
};

export function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span className="badge st-none">No record</span>;
  return <span className={`badge st-${status}`}>{STATUS_LABEL[status]}</span>;
}

// ---------------------------------------------------------------------------
// Modal + confirm
// ---------------------------------------------------------------------------

export function Modal({
  title,
  sub,
  onClose,
  children,
  footer,
  size,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm';
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    (first ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', size === 'sm' && 'modal-sm')} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {sub && <div className="small muted">{sub}</div>}
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close" data-close>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className={cx('btn', danger ? 'btn-danger-solid' : 'btn-primary')} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="small">{message}</div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('toast', t.kind)} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.kind === 'error' ? <AlertCircle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
