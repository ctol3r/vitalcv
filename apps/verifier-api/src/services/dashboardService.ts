// Mock dashboard service
import { createLogger } from '@chai-vc/logging-core';

const log = createLogger({ service: 'verifier-api-dashboard' });

export interface DashboardSummary {
  totalVerifications: number;
  averageCRS: number;
  revokedCount: number;
  uncheckableCount: number;
  lastUpdated: string;
}

// In-memory mock state
let state: DashboardSummary = {
  totalVerifications: 1250,
  averageCRS: 87.5,
  revokedCount: 15,
  uncheckableCount: 42,
  lastUpdated: new Date().toISOString(),
};

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  return state;
};

export const updateDashboardStats = (crsScore: number, isRevoked: boolean, isUnknown: boolean) => {
  state.totalVerifications += 1;
  // Moving average approx
  state.averageCRS =
    (state.averageCRS * (state.totalVerifications - 1) + crsScore) / state.totalVerifications;

  if (isRevoked) state.revokedCount += 1;
  if (isUnknown) state.uncheckableCount += 1;

  state.lastUpdated = new Date().toISOString();
};
