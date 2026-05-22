import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { selectNode, setKillSwitchState } from '../store/graphSlice';
import { fetchVerdict } from '../lib/fetchVerdict';
import VerdictContent from './VerdictContent';
import LoadingSkeleton from './LoadingSkeleton';
import axiosInstance from '../lib/axiosInstance';

interface VerdictModalProps {
  /** Override the nodeId source — useful when opening from outside the graph */
  nodeId?: string | null;
  onClose?: () => void;
}

export default function VerdictModal({ nodeId: externalNodeId, onClose: externalClose }: VerdictModalProps = {}) {
  const dispatch = useAppDispatch();
  const { verdict, verdictStatus, killSwitchState, selectedNodeId } = useAppSelector(s => s.graph);

  const activeNodeId = externalNodeId !== undefined ? externalNodeId : selectedNodeId;
  const isOpen = !!activeNodeId;

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleClose = () => {
    dispatch(selectNode(null));
    dispatch(setKillSwitchState('idle'));
    externalClose?.();
  };

  const handleKillSwitch = (newState: any) => {
    dispatch(setKillSwitchState(newState));
  };

  const handleRetry = () => {
    if (activeNodeId) dispatch(fetchVerdict(activeNodeId));
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) handleClose();
  };

  const handleMarkFalsePositive = async () => {
    if (!activeNodeId) return;
    try {
      await axiosInstance.post(`/api/v1/admin/unflag/${activeNodeId}`);
      handleClose();
    } catch (err) {
      console.error('Failed to mark as false positive:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(4, 8, 20, 0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'modalFadeIn 180ms ease-out',
      }}
    >
      {/* Modal panel */}
      <div
        className="relative flex flex-col w-full overflow-hidden"
        style={{
          maxWidth: 980,
          maxHeight: '92vh',
          margin: '0 var(--spacing-lg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-emphasis)',
          background: 'var(--color-bg-canvas)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,156,249,0.08)',
          animation: 'modalSlideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between shrink-0 px-6"
          style={{
            height: 52,
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Coloured status dot */}
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: verdictStatus === 'loading'
                  ? 'var(--color-text-muted)'
                  : verdictStatus === 'error'
                    ? 'var(--color-status-danger)'
                    : 'var(--color-accent)',
              }}
            />
            <span
              className="uppercase tracking-widest font-mono"
              style={{
                fontSize: 'var(--font-size-label)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
              }}
            >
              Verdict Panel
            </span>
            {activeNodeId && (
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--font-size-caption)',
                  color: 'var(--color-text-muted)',
                }}
              >
                · {activeNodeId}
              </span>
            )}
          </div>

          <button
            onClick={handleClose}
            className="flex items-center justify-center rounded-sm transition-colors hover:opacity-80"
            style={{
              width: 28,
              height: 28,
              background: 'var(--color-bg-raised)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
            aria-label="Close verdict panel"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--spacing-lg)' }}>
          {/* Loading */}
          {verdictStatus === 'loading' && (
            <LoadingSkeleton variant="alert" rows={6} />
          )}

          {/* Error */}
          {verdictStatus === 'error' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 52,
                  height: 52,
                  background: 'var(--color-status-danger-subtle)',
                  border: '1px solid var(--color-status-danger-border)',
                }}
              >
                <span style={{ fontSize: 22 }}>⚠</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)' }}>
                Could not load verdict for node <code
                  className="font-mono px-1 py-0.5 rounded"
                  style={{ background: 'var(--color-bg-raised)', color: 'var(--color-status-warning)', fontSize: 'var(--font-size-caption)' }}
                >{activeNodeId}</code>
              </p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-default transition-colors hover:opacity-80"
                style={{
                  background: 'var(--color-bg-raised)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-body)',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Success */}
          {verdictStatus === 'success' && verdict && (
            <VerdictContent
              verdict={verdict}
              verdictStatus={verdictStatus}
              killSwitchState={killSwitchState}
              onKillSwitch={handleKillSwitch}
              onMarkFalsePositive={handleMarkFalsePositive}
              mode="fullpage"
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}
