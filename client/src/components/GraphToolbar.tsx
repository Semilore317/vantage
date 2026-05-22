import { Search, X, Grid, LayoutDashboard, RefreshCcw } from 'lucide-react';
import type { NodeStatus } from '../types';
import { useState } from 'react';

interface GraphToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterStatuses: NodeStatus[];
  onFilterChange: (statuses: NodeStatus[]) => void;
  onRescan: () => void;
}

export default function GraphToolbar({
  searchQuery,
  onSearchChange,
  filterStatuses,
  onFilterChange,
  onRescan
}: GraphToolbarProps) {
  const [isScanning, setIsScanning] = useState(false);

  const handleRescanClick = () => {
    setIsScanning(true);
    onRescan();
    setTimeout(() => setIsScanning(false), 800);
  };

  const hasFlaggedFilter = filterStatuses.includes('flagged');
  
  const toggleFlagged = () => {
    if (hasFlaggedFilter) {
      onFilterChange(filterStatuses.filter(s => s !== 'flagged'));
    } else {
      onFilterChange([...filterStatuses, 'flagged']);
    }
  };

  return (
    <div className="w-full h-14 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] flex items-center justify-between px-[var(--spacing-lg)] shrink-0 z-20">
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-[var(--color-text-muted)]" />
          </div>
          <input
            type="text"
            className="block w-[320px] pl-9 pr-3 py-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-[var(--radius-default)] text-[var(--font-size-body)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            placeholder="Search nodes or transactions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFlagged}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[var(--font-size-caption)] font-[var(--font-weight-medium)] transition-colors ${
              hasFlaggedFilter 
                ? 'bg-[var(--color-status-danger-subtle)] border-[var(--color-status-danger-border)] text-[var(--color-status-danger)]' 
                : 'bg-[var(--color-bg-raised)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Flagged
            {hasFlaggedFilter && <X size={14} className="opacity-70 hover:opacity-100" />}
          </button>
          
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] rounded-[var(--radius-sm)] transition-colors">
            <LayoutDashboard size={18} />
          </button>
          <button className="p-1.5 text-[var(--color-accent)] bg-[var(--color-bg-raised)] rounded-[var(--radius-sm)] transition-colors">
            <Grid size={18} />
          </button>
        </div>
        
        <div className="w-px h-6 bg-[var(--color-border-subtle)]" />
        
        <button 
          onClick={handleRescanClick}
          className="flex items-center gap-2 bg-[var(--color-accent)] hover:bg-blue-600 text-white px-4 py-1.5 rounded-[var(--radius-default)] text-[var(--font-size-body)] font-[var(--font-weight-medium)] transition-colors"
        >
          <RefreshCcw size={16} className={isScanning ? 'animate-spin' : ''} />
          Re-scan Network
        </button>
      </div>
    </div>
  );
}
