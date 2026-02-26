type ApiPath =
  | '/trust-state'
  | '/ingest/npi'
  | '/ingest/files'
  | '/verification/run'
  | '/acceptances'
  | '/starts'
  | '/verify'
  | '/api/pilot/activate';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const DEMO_PATHS: Record<
  Extract<ApiPath, '/trust-state' | '/ingest/npi'>,
  string
> = {
  '/trust-state': '/demo/status',
  '/ingest/npi': '/demo/issue',
};

function normalizeApiBase(base: string): string {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function isDemoPath(p: string): p is keyof typeof DEMO_PATHS {
  return p in DEMO_PATHS;
}

export function apiRoute(path: ApiPath): string {
  const resolvedPath = DEMO_MODE && isDemoPath(path) ? DEMO_PATHS[path] : path;
  const base = normalizeApiBase(API_BASE);
  return base ? `${base}${resolvedPath}` : resolvedPath;
}

export type { ApiPath };

/* ------------------------------------------------------------------ */
/*  Holder Wallet types (Wave 2.1)                                     */
/* ------------------------------------------------------------------ */

export type CredentialStatus = "Valid" | "Expiring" | "Revoked" | "Pending";
export type ClaimLevel = "L0" | "L1" | "L2" | "L3";

export interface CredentialItem {
  id: string;
  name: string;
  issuer: string;
  scope: string;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  issueDate: string;
  expirationDate?: string;
  npi?: string;
  licenseNumber?: string;
  holderName?: string;
  verifierDID?: string;
  methodologyVersion?: string;
  pouBinding?: string;
  // AuditScrapbook
  audit?: {
    psvArtifactTrace?: string;
    sourceQueried?: string;
    sourceQueriedAt?: string;
    rawSnapshotHash?: string; // SHA-256
  };
}

export interface TrustStateResponse {
  holderName: string;
  npi: string;
  credentials: CredentialItem[];
}

/** Returns a safe empty state when backend data is missing/null */
export function createSafeFallbackState<T>(
  data: T | null | undefined,
  fallback: T
): T {
  if (data == null) return fallback;
  return data;
}
