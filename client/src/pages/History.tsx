import { History as HistoryIcon } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <HistoryIcon size={24} className="text-[var(--color-text-primary)]" />
        <h1 className="text-[var(--font-size-heading)] font-medium text-[var(--color-text-primary)]">
          Activity History
        </h1>
      </div>
      
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-8 text-center text-[var(--color-text-muted)]">
        Historical audit logs and past transaction investigations will appear here.
      </div>
    </div>
  );
}
