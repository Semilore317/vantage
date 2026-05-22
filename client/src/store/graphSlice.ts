import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GraphData, Verdict, VerdictStatus, KillSwitchState } from '../types';

interface GraphState {
  graphData: GraphData;
  selectedNodeId: string | null;
  verdict: Verdict | null;
  verdictStatus: VerdictStatus;
  killSwitchState: KillSwitchState;
  networkVelocity: { tps: number; label: 'Normal' | 'Elevated' | 'Critical' };
}

const initialState: GraphState = {
  graphData: {
    nodes: [],
    edges: []
  },
  selectedNodeId: null,
  verdict: null,
  verdictStatus: 'idle',
  killSwitchState: 'idle',
  networkVelocity: { tps: 84.2, label: 'Normal' },
};

const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    selectNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload;
      state.verdictStatus = 'idle';
      state.verdict = null;
    },
    setVerdictLoading: (state) => {
      state.verdictStatus = 'loading';
    },
    setVerdictSuccess: (state, action: PayloadAction<Verdict>) => {
      state.verdict = action.payload;
      state.verdictStatus = 'success';
    },
    setVerdictError: (state) => {
      state.verdictStatus = 'error';
    },
    setKillSwitchState: (state, action: PayloadAction<KillSwitchState>) => {
      state.killSwitchState = action.payload;
    },
    updateGraphData: (state, action: PayloadAction<GraphData>) => {
      state.graphData = action.payload;
    }
  }
});

export const {
  selectNode,
  setVerdictLoading,
  setVerdictSuccess,
  setVerdictError,
  setKillSwitchState,
  updateGraphData
} = graphSlice.actions;

export default graphSlice.reducer;
