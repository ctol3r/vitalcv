/**
 * Admin Portal Types & Enums
 *
 * Defines all types, enums, and interfaces for the VitalCV Staff & Admin Portal
 */

export enum AdminRole {
  SuperAdmin = 'SuperAdmin',
  Support = 'Support',
  Compliance = 'Compliance',
  Engineering = 'Engineering',
  Auditor = 'Auditor',
  CustomerSuccess = 'CustomerSuccess',
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  roles: AdminRole[];
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface AdminDashboardState {
  status: 'loading' | 'ready' | 'error';
  data?: AdminDashboardData;
  error?: string;
}

export interface AdminDashboardData {
  stats: {
    totalUsers: number;
    totalFacilities: number;
    totalCredentials: number;
    activeVerifications: number;
    chainHealth: 'healthy' | 'degraded' | 'down';
    aiDecisionsToday: number;
  };
  recentActivity: AdminActivityLog[];
  alerts: AdminAlert[];
}

export interface AdminActivityLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: 'user' | 'facility' | 'credential' | 'chain' | 'ai' | 'system';
  resourceId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

export interface AdminAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
  name?: string;
  npi?: string;
  roles: string[];
  trustScore?: number;
  credentialCount: number;
  chainStatus: 'synced' | 'pending' | 'error';
  complianceStatus: 'compliant' | 'warning' | 'non-compliant';
  claimLevel: number;
  createdAt: string;
}

export interface FacilitySearchResult {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'enterprise' | 'other';
  status: 'active' | 'onboarding' | 'frozen' | 'offboarded';
  apiUptime?: number;
  oidcConfigured: boolean;
  chainSync: 'synced' | 'pending' | 'error';
  seatCount: number;
  activeUsers: number;
  createdAt: string;
}

export interface ChainHealthStatus {
  primaryChain: {
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    blockHeight: number;
    lastBlockTime: string;
  };
  mirrorChain: {
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    blockHeight: number;
    lastBlockTime: string;
  };
  rollupLayer: {
    status: 'healthy' | 'degraded' | 'down';
    pendingTransactions: number;
    throughput: number;
  };
}

export interface AnchorBacklog {
  pending: number;
  failed: number;
  stale: number;
  items: AnchorBacklogItem[];
}

export interface AnchorBacklogItem {
  id: string;
  type: 'credential' | 'privilege' | 'facility' | 'user';
  resourceId: string;
  status: 'pending' | 'failed' | 'stale';
  createdAt: string;
  lastRetryAt?: string;
  error?: string;
  retryCount: number;
}

export interface AIDecisionLog {
  id: string;
  type: 'credential_anomaly' | 'skill_flag' | 'compliance_notice' | 'fraud_detection';
  resourceId: string;
  resourceType: 'credential' | 'user' | 'facility';
  confidence: number;
  decision: string;
  reasoning: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  override?: 'safe' | 'escalate' | 'ignore';
}

export interface PlatformAnalytics {
  dailyActiveUsers: number;
  verificationsPerDay: number;
  credentialAcceptanceRate: number;
  facilitiesOnboarded: number;
  matchScoreConversions: number;
  trends: {
    date: string;
    users: number;
    verifications: number;
    credentials: number;
  }[];
}

export interface ComplianceMetrics {
  deaExpirations: {
    expiring30Days: number;
    expiring60Days: number;
    expired: number;
    items: ComplianceItem[];
  };
  licenseExpirations: {
    expiring30Days: number;
    expiring60Days: number;
    expired: number;
    items: ComplianceItem[];
  };
  cmeDeficits: {
    total: number;
    items: ComplianceItem[];
  };
}

export interface ComplianceItem {
  id: string;
  userId: string;
  userName: string;
  type: 'dea' | 'license' | 'cme';
  expirationDate: string;
  daysUntilExpiration: number;
  status: 'active' | 'expiring' | 'expired';
}

