/**
 * WalletScreen.tsx — Wave 62: Mobile Wallet Screen
 *
 * Displays CRS ring, credential cards, and mini trust graph.
 *
 * NOTE: This file uses React Native types. It compiles with
 * "types": [] in tsconfig to avoid hoisted web @types conflicts.
 * Full RN types are available when running via Expo.
 */

// ── Types (standalone, no RN imports needed for structure) ────────────────

interface Credential {
  id: string;
  source: string;
  status: string;
  lifecycleState: string;
  verifiedAt: string;
  expiresAt: string | null;
}

interface CrsData {
  overallScore: number;
  overallBand: string;
}

interface WalletData {
  npi: string;
  crs: CrsData;
  credentials: Credential[];
}

// ── Screen Definition ─────────────────────────────────────────────────────

/**
 * WalletScreen component structure (Expo/RN implementation)
 *
 * Layout:
 *   - Header: "Credential Wallet" title
 *   - CRS Ring: Animated SVG circle (score / 100)
 *   - Credential Cards: FlatList of L0–L3 cards
 *   - Trust Graph: MiniTrustGraph component
 *   - Share Button: Opens ShareProofSheet
 *
 * Data Flow:
 *   1. Fetch /api/graph/explorer/:npi on mount
 *   2. Parse WalletData response
 *   3. Render CRS ring + credential list
 */

export interface WalletScreenProps {
  npi: string;
}

export interface WalletScreenState {
  data: WalletData | null;
  loading: boolean;
  error: string | null;
}

// Band → color mapping
export const BAND_COLORS: Record<string, string> = {
  GREEN: '#34D399',
  YELLOW: '#FBBF24',
  RED: '#EF4444',
};

// Credential lifecycle → claim level
export const CLAIM_LEVELS: Record<string, { level: string; color: string }> = {
  PSV_COMPLETE: { level: 'L3', color: '#34D399' },
  VERIFIED: { level: 'L2', color: '#FBBF24' },
  SELF_ATTESTED: { level: 'L1', color: '#60A5FA' },
  UNVERIFIED: { level: 'L0', color: '#71717A' },
};

/**
 * Fetch wallet data from API
 */
export async function fetchWalletData(npi: string, baseUrl: string): Promise<WalletData> {
  const res = await fetch(`${baseUrl}/api/graph/explorer/${npi}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<WalletData>;
}
