export type TransactionStatus = 'CRITICAL' | 'HIGH_RISK' | 'SAFE';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface Transaction {
  id: string;
  name: string;
  accountId: string;         // masked format: "8824-****-9210"
  counterpartyId?: string;
  amount: number;
  timestamp: string;         // ISO UTC string
  status: TransactionStatus;
  avatarUrl?: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;         // relative label e.g. "2m ago"
  actions?: Array<{ label: string; variant: 'primary' | 'ghost' }>;
}

export interface DashboardMetrics {
  flagged: number;
  flaggedDelta: string;       // e.g. "+12% from previous hour"
  watch: number;
  cleared: number;
}

export type NodeType = 'account' | 'ip' | 'device';
export type NodeStatus = 'flagged' | 'watch' | 'clean';

export interface GraphNode {
  id: string;              // e.g. "8842-X", "992-XFA"
  label: string;           // display name e.g. "J. Adeyemi"
  type: NodeType;
  status: NodeStatus;
  trustScore?: number;     // 0–100
  accountId?: string;      // masked account ID if type === 'account'
}

export interface GraphEdge {
  id: string;
  source: string;          // GraphNode id
  target: string;          // GraphNode id
  weight?: number;         // transaction count or velocity indicator
  suspicious?: boolean;    // renders as dashed amber line if true
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type VerdictStatus = 'idle' | 'loading' | 'success' | 'error';
export type KillSwitchState = 'idle' | 'confirm' | 'processing' | 'done';

export interface RiskIndicator {
  label: string;
  score: number;           // signed float e.g. -0.42, +0.09
}

export interface Verdict {
  nodeId: string;
  entityName: string;
  trustScore: number;      // 0–1 float e.g. 0.18
  riskLevel: 'CRITICAL RISK' | 'HIGH RISK' | 'MODERATE RISK' | 'LOW RISK';
  indicators: RiskIndicator[];
  agentSummary: string;    // full text for typewriter animation
  accountMeta: Record<string, string>; // two-column label/value pairs
  nodeOrigin: string;      // e.g. "FRA-LHR-02"
  riskVector: string;      // e.g. "Sybil Cluster A"
}

export interface VerdictPageState {
  verdict: Verdict | null;
  status: VerdictStatus;
}

