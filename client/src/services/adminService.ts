import axiosInstance from '../lib/axiosInstance';
import type { FlaggedAccount } from '../types';

export const adminService = {
  getFlaggedAccounts: async (): Promise<FlaggedAccount[]> => {
    const { data } = await axiosInstance.get<FlaggedAccount[]>('/api/v1/admin/flagged');
    return data;
  },
  flagAccount: async (id: string) => {
    const { data } = await axiosInstance.post(`/api/v1/admin/flag/${id}`);
    return data;
  },
  unflagAccount: async (id: string) => {
    const { data } = await axiosInstance.post(`/api/v1/admin/unflag/${id}`);
    return data;
  }
};
