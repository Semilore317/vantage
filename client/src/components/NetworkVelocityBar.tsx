interface NetworkVelocityBarProps {
  tps: number;
  label: 'Normal' | 'Elevated' | 'Critical';
}

export default function NetworkVelocityBar({ tps, label }: NetworkVelocityBarProps) {
  const getLabelColor = () => {
    switch (label) {
      case 'Normal': return 'text-[var(--color-status-safe)]';
      case 'Elevated': return 'text-[var(--color-status-warning)]';
      case 'Critical': return 'text-[var(--color-status-danger)]';
      default: return 'text-[var(--color-text-secondary)]';
    }
  };

  return (
    <div className="w-full h-12 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] flex items-center px-[var(--spacing-lg)] shrink-0">
      <div className="flex items-center gap-3 w-1/3">
        <span className="text-[var(--font-size-caption)] text-[var(--color-text-muted)] font-[var(--font-weight-medium)] tracking-wider">
          NETWORK VELOCITY
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-[var(--font-size-subheading)] font-[var(--font-weight-medium)] text-[var(--color-text-primary)]">
            {tps} TPS
          </span>
          <span className={`text-[var(--font-size-caption)] ${getLabelColor()}`}>
            {label}
          </span>
        </div>
      </div>
      

    </div>
  );
}
