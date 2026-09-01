import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="ks-page-header">
      <div>
        {eyebrow && <div className="ks-page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ks-page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'violet' }) {
  return (
    <div className={`ks-stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function StatusBadge({ status, children }: { status: 'active' | 'planned' | 'ended' | 'success' | 'warning' | 'danger' | 'muted'; children: ReactNode }) {
  return <span className={`ks-status-badge ${status}`}>{children}</span>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="ks-empty-state"><strong>{title}</strong><p>{text}</p>{action}</div>;
}
