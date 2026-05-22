import type { AppDispatch } from '../store/store';
import { setVerdictLoading, setVerdictSuccess, setVerdictError } from '../store/graphSlice';
import axiosInstance from './axiosInstance';
import type { Verdict } from '../types';

export const fetchVerdict = (nodeId: string) => async (dispatch: AppDispatch) => {
  dispatch(setVerdictLoading());
  
  try {
    const { data } = await axiosInstance.get(`/api/v1/trust/${encodeURIComponent(nodeId)}`);
    
    const mappedVerdict: Verdict = {
      nodeId: data.accountId,
      entityName: data.accountId,
      trustScore: data.ts,
      riskLevel: data.tier === 'CRITICAL' ? 'CRITICAL RISK' : 
                 data.tier === 'HIGH_RISK' ? 'HIGH RISK' : 'LOW RISK',
      indicators: [
        { label: 'Network Proximity', score: data.pdist },
        { label: 'Transaction Velocity', score: data.vvel },
        { label: 'Counterparty Risk', score: data.cpr }
      ],
      agentSummary: data.explanation?.summary || 'No detailed summary available.',
      accountMeta: {
        'Account ID': data.accountId,
        'Risk Tier': data.tier,
        'Last Analyzed': new Date().toLocaleTimeString()
      },
      nodeOrigin: 'Vantage Live Engine',
      riskVector: data.explanation?.verdict || 'Anomalous Activity'
    };

    dispatch(setVerdictSuccess(mappedVerdict));
  } catch (err) {
    console.error("Failed to fetch verdict:", err);
    dispatch(setVerdictError());
  }
};
