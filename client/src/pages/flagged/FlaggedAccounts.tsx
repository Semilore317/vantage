import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectNode } from '../../store/graphSlice';
import { fetchVerdict } from '../../lib/fetchVerdict';
import { ShieldAlert, ExternalLink, UserMinus } from 'lucide-react';
import { fetchFlaggedAccounts, addFlaggedAccount, removeFlaggedAccount } from '../../store/flaggedSlice';
import { adminService } from '../../services/adminService';

function getRiskBadgeColors(trustScore: number): { bg: string; border: string; color: string; label: string } {
  if (trustScore < 0.3) return {
    bg: 'var(--color-status-danger-subtle)',
    border: 'var(--color-status-danger-border)',
    color: 'var(--color-status-danger)',
    label: 'CRITICAL RISK'
  };
  if (trustScore < 0.6) return {
    bg: 'var(--color-status-warning-subtle)',
    border: 'var(--color-status-warning-border)',
    color: 'var(--color-status-warning)',
    label: 'HIGH RISK'
  };
  return {
    bg: 'var(--color-bg-raised)',
    border: 'var(--color-border-subtle)',
    color: 'var(--color-text-muted)',
    label: 'WATCH'
  };
}

export default function FlaggedAccounts() {
  const dispatch = useAppDispatch();
  const { accounts, isLoading } = useAppSelector((state) => state.flagged);
  const transactions = useAppSelector((state) => state.dashboard.transactions);

  useEffect(() => {
    dispatch(fetchFlaggedAccounts());
  }, [dispatch]);

  // Live update: if a new transaction is flagged, add it to the list immediately
  useEffect(() => {
    if (transactions.length > 0) {
      const latest = transactions[0];
      if (latest.status === 'CRITICAL' || latest.status === 'HIGH_RISK') {
        dispatch(addFlaggedAccount({
          id: latest.accountId,
          isBlacklisted: true,
          trustScore: latest.trustScore || 0.1,
          lastSeen: 'Just now',
          isFrozen: false
        }));
      }
    }
  }, [transactions, dispatch]);

  const handleOpenVerdict = (nodeId: string) => {
    dispatch(selectNode(nodeId));
    dispatch(fetchVerdict(nodeId));
  };

  const handleUnflag = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await adminService.unflagAccount(id);
      dispatch(removeFlaggedAccount(id));
    } catch (err) {
      console.error("Failed to unflag account", err);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* Page header */}
      <div
        className="flex items-center gap-3 mb-6"
        style={{ paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div
          className="flex items-center justify-center rounded-sm"
          style={{ width: 32, height: 32, background: 'var(--color-status-danger-subtle)', border: '1px solid var(--color-status-danger-border)' }}
        >
          <ShieldAlert size={16} style={{ color: 'var(--color-status-danger)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-heading)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
            Flagged Accounts
          </h1>
          <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)' }}>
            {accounts.length} accounts flagged — real-time monitoring active
          </p>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-(--radius-lg) overflow-hidden"
        style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[180px_140px_140px_160px_1fr_100px] px-5 py-3"
          style={{
            background: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {['Account ID', 'Last Seen', 'Trust Score', 'Risk Level', 'AI Recommendation', 'Actions'].map(col => (
            <span
              key={col}
              className="uppercase tracking-wider"
              style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)', fontWeight: 500 }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {accounts.map((account, i) => {
          const scoreValue = Math.round(account.trustScore * 100);
          const scoreColor = scoreValue < 30
            ? 'var(--color-status-danger)'
            : scoreValue < 60
              ? 'var(--color-status-warning)'
              : 'var(--color-status-safe)';

          return (
            <div
              key={account.id}
              onClick={() => handleOpenVerdict(account.id)}
              className="grid grid-cols-[180px_140px_140px_160px_1fr_100px] items-center px-5 py-4 cursor-pointer transition-colors hover:bg-bg-raised group"
              style={{
                borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : undefined,
              }}
            >
              {/* Account ID */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="font-mono truncate" title={account.id} style={{ fontSize: 'var(--font-size-body)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {account.id}
                </span>
                <span className="truncate" style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)' }}>
                  {account.email || 'No email associated'}
                </span>
              </div>

              {/* Last Seen */}
              <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-secondary)' }}>
                {account.lastSeen || 'Recently'}
              </span>

              {/* Trust score */}
              <div className="flex items-center gap-2">
                <span
                  className="font-mono"
                  style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, color: scoreColor }}
                >
                  {scoreValue}
                </span>
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--color-bg-raised)', maxWidth: 48 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${scoreValue}%`, background: scoreColor }}
                  />
                </div>
              </div>

              {/* Risk level badge */}
              <div>
                {(() => {
                  const { bg, border, color, label } = getRiskBadgeColors(account.trustScore);
                  return (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        border: `1px solid ${border}`,
                        background: bg,
                        color,
                        fontSize: 'var(--font-size-label)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>

              {/* AI Recommendation */}
              <div className="px-2">
                 <p 
                  className="line-clamp-2"
                  style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-secondary)', fontStyle: account.latestRecommendation ? 'normal' : 'italic' }}
                >
                  {account.latestRecommendation || 'Analysis pending...'}
                </p>
              </div>

              {/* Actions */}

              {/* Actions */}
              <div className="flex items-center gap-4 justify-end">
                <button
                  onClick={(e) => handleUnflag(e, account.id)}
                  className="p-1.5 rounded-sm hover:bg-bg-canvas transition-colors text-text-muted hover:text-status-safe"
                  title="Mark as False Positive"
                >
                  <UserMinus size={16} />
                </button>
                <ExternalLink
                  size={14}
                  className="text-text-muted opacity-40 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && !isLoading && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ShieldAlert size={32} />
            <span style={{ fontSize: 'var(--font-size-body)' }}>No flagged accounts found</span>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        )}
      </div>
    </div>
  );
}
