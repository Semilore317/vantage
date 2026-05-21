import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [filterStatuses, setFilterStatuses] = useState<NodeStatus[]>(['flagged', 'watch', 'clean']);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const graphCanvasRef = useRef<GraphCanvasHandle>(null);

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

  // ── Live feed → graph status sync ────────────────────────────────────────
  useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    const latest = transactions[0];
    let newStatus: NodeStatus = 'clean';
    if (latest.status === 'CRITICAL') newStatus = 'flagged';
    else if (latest.status === 'HIGH_RISK') newStatus = 'watch';

    let updatedNodes = [...graphData.nodes];
    let nodesChanged = false;

    const sourceId = latest.accountId;
    let sourceNode = updatedNodes.find(n => n.id === sourceId || n.accountId === sourceId);
    
    if (sourceNode) {
      if (sourceNode.status !== newStatus) {
        updatedNodes = updatedNodes.map(n => 
          (n.id === sourceId || n.accountId === sourceId) ? { ...n, status: newStatus } : n
        );
        nodesChanged = true;
      }
    } else {
      sourceNode = {
        id: sourceId,
        label: latest.name || sourceId.substring(0, 8),
        type: 'account',
        status: newStatus,
        accountId: sourceId
      };
      updatedNodes.push(sourceNode);
      nodesChanged = true;
    }

    const targetId = latest.counterpartyId;
    if (targetId) {
      let targetNode = updatedNodes.find(n => n.id === targetId || n.accountId === targetId);
      if (!targetNode) {
        targetNode = {
          id: targetId,
          label: targetId.substring(0, 8),
          type: 'account',
          status: 'clean',
          accountId: targetId
        };
        updatedNodes.push(targetNode);
        nodesChanged = true;
      }
    }

    let updatedEdges = [...graphData.edges];
    let edgesChanged = false;
    
    if (targetId) {
      const edgeId = `live-${latest.id}`;
      if (!updatedEdges.find(e => e.id === edgeId)) {
        updatedEdges.push({
          id: edgeId,
          source: sourceNode.id,
          target: targetId,
          weight: latest.amount,
          suspicious: newStatus === 'flagged' || updatedNodes.find(n => n.id === targetId)?.status === 'flagged'
        });
        edgesChanged = true;
      }
    }

    if (nodesChanged || edgesChanged) {
      if (nodesChanged) {
        updatedEdges = updatedEdges.map(e => ({
          ...e,
          suspicious: (
            updatedNodes.find(n => n.id === e.source)?.status === 'flagged' ||
            updatedNodes.find(n => n.id === e.target)?.status === 'flagged'
          )
        }));
      }
      dispatch(updateGraphData({ nodes: updatedNodes, edges: updatedEdges }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const hasFlaggedOrWatch = graphData.nodes.some(n => n.status === 'flagged' || n.status === 'watch');
  const showEmptyState = !hasFlaggedOrWatch && !isRefreshing && !fetchError;

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
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
          filterStatuses={filterStatuses}
          searchQuery={searchQuery}
        />

        <NodeLegend nodes={graphData.nodes} />

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
