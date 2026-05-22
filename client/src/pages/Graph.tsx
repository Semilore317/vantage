import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { selectNode, updateGraphData } from '../store/graphSlice';

import { Shield, RefreshCw } from 'lucide-react';
import GraphToolbar from '../components/GraphToolbar';
import GraphCanvas, { type GraphCanvasHandle } from '../components/GraphCanvas';
import ZoomControls from '../components/ZoomControls';
import NodeLegend from '../components/NodeLegend';
import NetworkVelocityBar from '../components/NetworkVelocityBar';
import type { NodeStatus } from '../types';
import { fetchVerdict } from '../lib/fetchVerdict';
import { fetchGraphNetwork } from '../lib/graphService';

export default function Graph() {
  const dispatch = useAppDispatch();
  const graphData = useAppSelector(state => state.graph.graphData);
  const selectedNodeId = useAppSelector(state => state.graph.selectedNodeId);
  const networkVelocity = useAppSelector(state => state.graph.networkVelocity);
  const transactions = useAppSelector(state => state.dashboard.transactions);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<NodeStatus[]>(['flagged', 'watch']);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const graphCanvasRef = useRef<GraphCanvasHandle>(null);

  const flaggedAccounts = useAppSelector(state => state.flagged.accounts);

  // ── Fetch real graph data ─────────────────────────────────────────────────
  const loadGraphData = useCallback(async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      const data = await fetchGraphNetwork();
      dispatch(updateGraphData(data));
    } catch (err) {
      console.error('Failed to load graph network:', err);
      setFetchError('Could not load graph data. Check your connection.');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // ── Live feed & Flagged Accounts → graph status sync & dynamic injection ──
  useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    const latest = transactions[0];
    
    let newStatus: NodeStatus = 'clean';
    if (latest.status === 'CRITICAL') newStatus = 'flagged';
    else if (latest.status === 'HIGH_RISK') newStatus = 'watch';

    // Override with flagged accounts list if present
    const isExplicitlyFlagged = flaggedAccounts.some(a => a.id === latest.accountId && (a.isBlacklisted || a.trustScore < 40));
    if (isExplicitlyFlagged) newStatus = 'flagged';

    const nodes = [...graphData.nodes];
    const edges = [...graphData.edges];
    let changed = false;

    // 1. Upsert Account Node
    const accNodeIdx = nodes.findIndex(n => n.id === latest.accountId || n.accountId === latest.accountId);
    if (accNodeIdx === -1) {
      nodes.push({
        id: latest.accountId,
        label: latest.accountId,
        type: 'account',
        status: newStatus,
        trustScore: latest.trustScore ? Math.round(latest.trustScore * 100) : undefined
      });
      changed = true;
    } else if (nodes[accNodeIdx].status !== newStatus && (newStatus === 'flagged' || nodes[accNodeIdx].status !== 'flagged')) {
      // Only upgrade risk, don't downgrade automatically to clean if it was flagged before
      nodes[accNodeIdx] = { ...nodes[accNodeIdx], status: newStatus };
      changed = true;
    }

    // 2. Upsert Counterparty Node
    const counterpartyId = latest.counterpartyId;
    const cpNodeIdx = counterpartyId ? nodes.findIndex(n => n.id === counterpartyId || n.accountId === counterpartyId) : -1;
    if (counterpartyId && cpNodeIdx === -1) {
      const cpIsFlagged = flaggedAccounts.some(a => a.id === latest.counterpartyId && (a.isBlacklisted || a.trustScore < 40));
      nodes.push({
        id: counterpartyId,
        label: latest.counterpartyName || counterpartyId,
        type: 'account',
        status: cpIsFlagged ? 'flagged' : 'clean'
      });
      changed = true;
    }

    // 3. Upsert Edge
    const edgeId = counterpartyId ? `e_${latest.accountId}_${counterpartyId}` : null;
    if (edgeId && counterpartyId && !edges.some(e => e.id === edgeId)) {
      edges.push({
        id: edgeId,
        source: latest.accountId,
        target: counterpartyId,
        suspicious: newStatus === 'flagged',
        weight: latest.amount
      });
      changed = true;
    }

    if (changed) {
      const updatedEdges = edges.map(e => ({
        ...e,
        suspicious: (
          nodes.find(n => n.id === e.source)?.status === 'flagged' ||
          nodes.find(n => n.id === e.target)?.status === 'flagged'
        )
      }));
      dispatch(updateGraphData({ nodes, edges: updatedEdges }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, flaggedAccounts]);

  // FILTER: Only show risky nodes (flagged or watch) that are also active in filterStatuses
  const riskyGraphData = useMemo(() => {
    const nodes = graphData.nodes.filter(n => 
      (n.status === 'flagged' || n.status === 'watch') && 
      filterStatuses.includes(n.status)
    );
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [graphData, filterStatuses]);

  const showEmptyState = riskyGraphData.nodes.length === 0 && !isRefreshing && !fetchError;

  // Node click → select + fetch verdict → VerdictModal opens (via selectedNodeId in Redux)
  const handleNodeClick = (nodeId: string) => {
    dispatch(selectNode(nodeId));
    dispatch(fetchVerdict(nodeId));
  };

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <GraphToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterStatuses={filterStatuses}
        onFilterChange={setFilterStatuses}
        onRescan={async () => {
          await loadGraphData();
          setTimeout(() => graphCanvasRef.current?.fitFlagged(), 300);
        }}
      />

      {/* Full-width graph — modal overlays instead of sidebar split */}
      <div className="flex-1 relative overflow-hidden">
        <GraphCanvas
          ref={graphCanvasRef}
          graphData={riskyGraphData}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
          filterStatuses={filterStatuses}
          searchQuery={searchQuery}
        />

        <NodeLegend nodes={riskyGraphData.nodes} />

        <ZoomControls
          onZoomIn={() => graphCanvasRef.current?.zoomIn()}
          onZoomOut={() => graphCanvasRef.current?.zoomOut()}
          onFitFlagged={() => graphCanvasRef.current?.fitFlagged()}
        />

        {/* Refresh button */}
        <button
          onClick={loadGraphData}
          disabled={isRefreshing}
          className="absolute top-3 right-3 z-10 flex items-center gap-2 px-3 py-2 rounded-default transition-all hover:opacity-90"
          style={{
            background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border-emphasis)',
            color: isRefreshing ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            fontSize: 'var(--font-size-caption)',
            fontWeight: 500,
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Fetching…' : 'Refresh'}
        </button>

        {/* Loading overlay */}
        {isRefreshing && graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-muted)' }}>
                Loading network data…
              </span>
            </div>
          </div>
        )}

        {/* Fetch error */}
        {fetchError && (
          <div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-default"
            style={{
              background: 'var(--color-status-danger-subtle)',
              border: '1px solid var(--color-status-danger-border)',
              color: 'var(--color-status-danger)',
              fontSize: 'var(--font-size-caption)',
            }}
          >
            {fetchError}
          </div>
        )}

        {/* Empty state */}
        {showEmptyState && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            style={{ background: 'color-mix(in srgb, var(--color-bg-canvas) 60%, transparent)' }}
          >
            <div className="flex flex-col items-center max-w-120 text-center gap-4">
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: 80, height: 80, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
              >
                <Shield size={40} style={{ color: 'var(--color-status-safe)' }} />
              </div>
              <h2 style={{ fontSize: 'var(--font-size-heading)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                System Healthy
              </h2>
              <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)' }}>
                No flagged activity detected. All {graphData.nodes.length} active nodes are within established trust parameters.
              </p>
              <div className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-muted)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-status-safe)' }} />
                Live Surveillance Active &middot; Last check: Just now
              </div>
            </div>
          </div>
        )}
      </div>

      <NetworkVelocityBar tps={networkVelocity.tps} label={networkVelocity.label} />
    </div>
  );
}
