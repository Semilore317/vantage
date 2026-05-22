import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { FlaggedAccount } from '../types';
import { adminService } from '../services/adminService';

interface FlaggedState {
  accounts: FlaggedAccount[];
  isLoading: boolean;
  error: string | null;
}

const initialState: FlaggedState = {
  accounts: [],
  isLoading: false,
  error: null,
};

export const fetchFlaggedAccounts = createAsyncThunk(
  'flagged/fetchAll',
  async () => {
    return await adminService.getFlaggedAccounts();
  }
);

const flaggedSlice = createSlice({
  name: 'flagged',
  initialState,
  reducers: {
    addFlaggedAccount: (state, action: PayloadAction<FlaggedAccount>) => {
      if (!state.accounts.some(a => a.id === action.payload.id)) {
        state.accounts.unshift(action.payload);
      }
    },
    removeFlaggedAccount: (state, action: PayloadAction<string>) => {
      state.accounts = state.accounts.filter(a => a.id !== action.payload);
    },
    updateAccountStatus: (state, action: PayloadAction<{ id: string; trustScore: number; isBlacklisted: boolean }>) => {
      const account = state.accounts.find(a => a.id === action.payload.id);
      if (account) {
        account.trustScore = action.payload.trustScore;
        account.isBlacklisted = action.payload.isBlacklisted;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFlaggedAccounts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchFlaggedAccounts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accounts = action.payload;
      })
      .addCase(fetchFlaggedAccounts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch flagged accounts';
      });
  },
});

export const { addFlaggedAccount, removeFlaggedAccount, updateAccountStatus } = flaggedSlice.actions;
export default flaggedSlice.reducer;
