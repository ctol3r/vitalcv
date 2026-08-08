/**
 * riskAnalysis.ts — Wave 83: Risk Analysis Module
 *
 * Detects expiring credentials, revoked dependencies,
 * issuer trust degradation, and incomplete credential chains.
 */

// ── Types ─────────────────────────────────────────────────────────────

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  id: string;
  type: 'EXPIRING_CREDENTIAL' | 'REVOKED_DEPENDENCY' | 'ISSUER_DEGRADATION' | 'INCOMPLETE_CHAIN' | 'EXPIRED_CREDENTIAL';
  severity: RiskSeverity;
  title: string;
  description: string;
  credentialId?: string;
  daysRemaining?: number;
}

// ── Artifact shape (minimal fields needed) ────────────────────────────

interface ArtifactInput {
  id: string;
  source: string;
  status: string;
  trustState: string;
  verifiedAt: Date | null;
  createdAt: Date;
  /**
   * The expiry the SOURCE published, or null when it published none.
   * Optional so existing callers compile; a caller that does not supply it
   * gets no expiry risks rather than invented ones.
   */
  expiresAt?: Date | null;
}

// ── Risk Detectors ────────────────────────────────────────────────────

/**
 * Expiry risks from the date the SOURCE published.
 *
 * This function previously computed `(verifiedAt ?? createdAt) + 365 days`
 * and fed the result into the decision engine as a HIGH-severity risk — the
 * same fabrication the monitoring scanner carried, but on a path that shapes
 * recommendations rather than a read API. An artifact with no published
 * expiry now produces no expiry risk at all: not knowing when something
 * expires is not a risk finding, and inventing one distorts every decision
 * downstream of it.
 */
function detectExpiringCredentials(artifacts: ArtifactInput[]): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const now = Date.now();

  for (const art of artifacts) {
    if (art.status === 'REVOKED' || art.status === 'SUSPENDED' || art.status === 'EXPIRED') continue;

    // No published expiry ⇒ nothing to say. Never estimated.
    if (!art.expiresAt) continue;
    const daysRemaining = Math.floor((new Date(art.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000));

    if (daysRemaining <= 0) {
      risks.push({
        id: `expired-${art.id}`,
        type: 'EXPIRED_CREDENTIAL',
        severity: 'HIGH',
        title: `"${art.source}" has expired`,
        description: `Credential expired ${Math.abs(daysRemaining)} days ago. Renewal required.`,
        credentialId: art.id,
        daysRemaining,
      });
    } else if (daysRemaining <= 30) {
      risks.push({
        id: `expiring-30-${art.id}`,
        type: 'EXPIRING_CREDENTIAL',
        severity: 'HIGH',
        title: `"${art.source}" expires in ${daysRemaining} days`,
        description: `Credential expires within 30 days. Immediate renewal action needed.`,
        credentialId: art.id,
        daysRemaining,
      });
    } else if (daysRemaining <= 90) {
      risks.push({
        id: `expiring-90-${art.id}`,
        type: 'EXPIRING_CREDENTIAL',
        severity: 'MEDIUM',
        title: `"${art.source}" expires in ${daysRemaining} days`,
        description: `Credential expires within 90 days. Plan renewal.`,
        credentialId: art.id,
        daysRemaining,
      });
    }
  }

  return risks;
}

function detectRevokedDependencies(artifacts: ArtifactInput[]): RiskFactor[] {
  const risks: RiskFactor[] = [];

  for (const art of artifacts) {
    if (art.status === 'REVOKED') {
      risks.push({
        id: `revoked-${art.id}`,
        type: 'REVOKED_DEPENDENCY',
        severity: 'CRITICAL',
        title: `"${art.source}" has been revoked`,
        description: `This credential was revoked. All dependent decisions must be reviewed.`,
        credentialId: art.id,
      });
    } else if (art.status === 'SUSPENDED') {
      risks.push({
        id: `suspended-${art.id}`,
        type: 'REVOKED_DEPENDENCY',
        severity: 'HIGH',
        title: `"${art.source}" is suspended`,
        description: `Credential is suspended pending investigation. Dependent decisions are at risk.`,
        credentialId: art.id,
      });
    }
  }

  return risks;
}

function detectIssuerDegradation(artifacts: ArtifactInput[]): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const issuerStats = new Map<string, { total: number; problematic: number }>();

  for (const art of artifacts) {
    const issuer = art.source;
    if (!issuerStats.has(issuer)) issuerStats.set(issuer, { total: 0, problematic: 0 });
    const stats = issuerStats.get(issuer)!;
    stats.total++;
    if (art.status === 'REVOKED' || art.status === 'SUSPENDED' || art.status === 'EXPIRED') {
      stats.problematic++;
    }
  }

  for (const [issuer, stats] of issuerStats) {
    if (stats.total >= 2 && stats.problematic / stats.total >= 0.5) {
      risks.push({
        id: `degradation-${issuer.replace(/\s+/g, '-')}`,
        type: 'ISSUER_DEGRADATION',
        severity: 'HIGH',
        title: `Issuer "${issuer}" shows trust degradation`,
        description: `${stats.problematic} of ${stats.total} credentials from this issuer are problematic.`,
      });
    }
  }

  return risks;
}

function detectIncompleteChains(artifacts: ArtifactInput[]): RiskFactor[] {
  const risks: RiskFactor[] = [];
  const sources = new Set(artifacts.map((a) => a.source.toLowerCase()));

  // Check for common credential chain gaps
  const hasStateLicense = [...sources].some((s) => s.includes('state') || s.includes('license') || s.includes('board'));
  const hasDEA = [...sources].some((s) => s.includes('dea'));

  if (artifacts.length > 0 && !hasStateLicense) {
    risks.push({
      id: 'incomplete-no-license',
      type: 'INCOMPLETE_CHAIN',
      severity: 'MEDIUM',
      title: 'No state license credential detected',
      description: 'State medical license is typically required for employment decisions.',
    });
  }

  if (artifacts.length > 2 && !hasDEA) {
    risks.push({
      id: 'incomplete-no-dea',
      type: 'INCOMPLETE_CHAIN',
      severity: 'LOW',
      title: 'No DEA credential detected',
      description: 'DEA registration may be required depending on specialty.',
    });
  }

  return risks;
}

// ── Main Analysis ─────────────────────────────────────────────────────

export function analyzeRisks(artifacts: ArtifactInput[]): RiskFactor[] {
  return [
    ...detectExpiringCredentials(artifacts),
    ...detectRevokedDependencies(artifacts),
    ...detectIssuerDegradation(artifacts),
    ...detectIncompleteChains(artifacts),
  ].sort((a, b) => {
    const order: Record<RiskSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });
}
