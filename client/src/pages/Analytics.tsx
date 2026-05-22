import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-[var(--color-text-primary)]" />
        <h1 className="text-[var(--font-size-heading)] font-medium text-[var(--color-text-primary)]">
          System Analytics
        </h1>
      </div>
      
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-8 text-center text-[var(--color-text-muted)]">
        Aggregated risk trends, network velocity charts, and trust distribution metrics will appear here.
      </div>
    </div>
  );
}
