import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import cytoscape from 'cytoscape';
import type { GraphData, NodeStatus } from '../types';

export interface GraphCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitFlagged: () => void;
}

interface GraphCanvasProps {
  graphData: GraphData;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  filterStatuses: NodeStatus[];
  searchQuery: string;
}

// Solid fill colours per status (no icon, just a clean dot)
const STATUS_COLOR: Record<string, string> = {
  flagged: '#EF4444',   // red
  watch:   '#F59E0B',   // amber
  clean:   '#22C55E',   // green
  default: '#1C2845',
};

const STATUS_SIZE: Record<string, number> = {
  flagged: 44,
  watch:   36,
  clean:   28,
  default: 28,
};

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(({
  graphData,
  selectedNodeId,
  onNodeClick,
  filterStatuses,
  searchQuery,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [tooltip, setTooltip] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const [pulsingNodes, setPulsingNodes] = useState<{ id: string; x: number; y: number; size: number; color: string }[]>([]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25),
    zoomOut: () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8),
    fitFlagged: () => {
      const cy = cyRef.current;
      if (!cy) return;
      const flagged = cy.nodes('[status="flagged"]:visible');
      if (flagged.length > 0) {
        cy.fit(flagged, 80);
      } else {
        cy.fit(cy.elements(), 60);
      }
    },
  }));

  // Initialize Cytoscape once
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        // ── Base node: solid filled circle, no label content override ──
        {
          selector: 'node',
          style: {
            'shape': 'ellipse',
            'background-color': STATUS_COLOR.default,
            'border-width': 0,
            'width': STATUS_SIZE.default,
            'height': STATUS_SIZE.default,
            'label': 'data(label)',
            'color': '#8BA3C7',
            'font-size': '11px',
            'font-family': 'Inter, ui-sans-serif, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-background-opacity': 0,
            // Remove any emoji content functions; use plain label
            'content': 'data(label)',
          },
        },
        // ── Status: flagged (red) ──
        {
          selector: 'node[status="flagged"]',
          style: {
            'background-color': STATUS_COLOR.flagged,
            'width': STATUS_SIZE.flagged,
            'height': STATUS_SIZE.flagged,
          },
        },
        // ── Status: watch (amber) ──
        {
          selector: 'node[status="watch"]',
          style: {
            'background-color': STATUS_COLOR.watch,
            'width': STATUS_SIZE.watch,
            'height': STATUS_SIZE.watch,
          },
        },
        // ── Status: clean (green) ──
        {
          selector: 'node[status="clean"]',
          style: {
            'background-color': STATUS_COLOR.clean,
            'width': STATUS_SIZE.clean,
            'height': STATUS_SIZE.clean,
          },
        },
        // ── Selected highlight ──
        {
          selector: '.selected',
          style: {
            'border-width': 3,
            'border-color': '#4F9CF9',
          },
        },
        // ── Search highlight ──
        {
          selector: '.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#a5c8ff',
          },
        },
        // ── Edges: normal ──
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#1E2D50',
            'curve-style': 'bezier',
            'opacity': 0.7,
          },
        },
        // ── Edges: suspicious (connects to flagged node) ──
        {
          selector: 'edge[?suspicious]',
          style: {
            'width': 2,
            'line-color': '#EF4444',
            'line-style': 'dashed',
            'opacity': 0.6,
          },
        },
        // ── Edges: critical-path (pulsing) ──
        {
          selector: 'edge.critical-path',
          style: {
            'line-color': '#EF4444',
            'width': 3,
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4],
            'opacity': 1,
          },
        },
        // ── Filtered out (hidden by status filter toggles) ──
        {
          selector: '.filtered-out',
          style: { 'display': 'none' },
        },
      ],
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on('tap', 'node', (e) => {
      onNodeClick(e.target.id());
    });

    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      const pos = node.renderedPosition();
      setTooltip({ id: node.id(), label: node.data('label'), x: pos.x, y: pos.y });
    });

    cy.on('mouseout', 'node', () => setTooltip(null));

    // Update pulse overlay positions whenever cytoscape renders
    cy.on('render', () => {
      const risky = cy.nodes('[status="flagged"]:visible, [status="watch"]:visible');
      setPulsingNodes(
        risky.map(n => {
          const pos = n.renderedPosition();
          const status = n.data('status') as string;
          return { 
            id: n.id(), 
            x: pos.x, 
            y: pos.y, 
            size: STATUS_SIZE[status] || STATUS_SIZE.default,
            color: STATUS_COLOR[status] || STATUS_COLOR.default
          };
        })
      );
    });

    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync graph data + auto-center on most critical cluster on first load
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      // Remove stale elements
      const nodeIds = new Set(graphData.nodes.map(n => n.id));
      const edgeIds = new Set(graphData.edges.map(e => e.id));
      cy.elements().forEach(ele => {
        if (ele.isNode() && !nodeIds.has(ele.id())) cy.remove(ele);
        if (ele.isEdge() && !edgeIds.has(ele.id())) cy.remove(ele);
      });

      // Upsert nodes
      graphData.nodes.forEach(node => {
        const existing = cy.getElementById(node.id);
        if (existing.length > 0) {
          existing.data({ ...node });
        } else {
          cy.add({ group: 'nodes', data: { ...node } });
        }
      });

      // Upsert edges
      graphData.edges.forEach(edge => {
        const existing = cy.getElementById(edge.id);
        const sourceNode = cy.getElementById(edge.source);
        const targetNode = cy.getElementById(edge.target);
        
        // Mark as critical path if either end is flagged
        const isCritical = sourceNode.data('status') === 'flagged' || targetNode.data('status') === 'flagged';

        if (existing.length > 0) {
          existing.data({ ...edge });
          if (isCritical) existing.addClass('critical-path');
          else existing.removeClass('critical-path');
        } else {
          const newEdge = cy.add({ group: 'edges', data: { ...edge } });
          if (isCritical) newEdge.addClass('critical-path');
        }
      });
    });

    // Layout then auto-fit on the most critical cluster
    cy.layout({
      name: 'cose',
      animate: false,
      randomize: false,
      nodeRepulsion: () => 6000,
      idealEdgeLength: () => 80,
    }).run();

    // After layout, zoom to the flagged cluster (most critical)
    requestAnimationFrame(() => {
      const flagged = cy.nodes('[status="flagged"]:visible');
      if (flagged.length > 0) {
        cy.fit(flagged, 100);
      } else {
        cy.fit(cy.elements(), 60);
      }
    });
  }, [graphData]);

  // Sync filters — toggle .filtered-out class (fully typed, no show/hide needed)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const ALL_STATUSES: NodeStatus[] = ['flagged', 'watch', 'clean'];
    cy.batch(() => {
      ALL_STATUSES.forEach(status => {
        const nodes = cy.nodes(`[status="${status}"]`);
        if (filterStatuses.includes(status)) {
          nodes.removeClass('filtered-out');
        } else {
          nodes.addClass('filtered-out');
        }
      });
    });
  }, [filterStatuses]);

  // Animation loop for pulsing critical edges (marching ants effect)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    let offset = 0;
    let reqId: number;

    const animate = () => {
      offset = (offset + 0.5) % 10;
      cy.edges('.critical-path').style('line-dash-offset', -offset);
      reqId = requestAnimationFrame(animate);
    };

    reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
  }, [graphData]);



  // Sync selection
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().removeClass('selected');
      if (selectedNodeId) cy.getElementById(selectedNodeId).addClass('selected');
    });
  }, [selectedNodeId]);

  // Sync search
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => cy.nodes().removeClass('highlighted'));
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const match = cy.nodes().filter(n =>
        (n.data('label') && n.data('label').toLowerCase().includes(q)) ||
        n.id().toLowerCase().includes(q)
      ).first();
      if (match.length > 0 && match.visible()) {
        match.addClass('highlighted');
        cy.center(match);
        cy.zoom(2);
      }
    }
  }, [searchQuery]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--color-bg-canvas)' }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* CSS-animated solid pulse dots for flagged/critical nodes only */}
      {pulsingNodes.map(pos => (
        <div
          key={pos.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: pos.size,
            height: pos.size,
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -50%)',
            background: pos.color,
            animation: 'criticalPulse 1.6s ease-out infinite',
          }}
        />
      ))}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none rounded-default px-3 py-1.5 shadow-lg"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y + 16,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
            {tooltip.label}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
            ID: {tooltip.id}
          </div>
        </div>
      )}

      <style>{`
        @keyframes criticalPulse {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0;   }
        }
      `}</style>
    </div>
  );
});

export default GraphCanvas;
