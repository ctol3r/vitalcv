/**
 * NCQA Monthly Sanctions/Licensure Monitoring Scheduler
 *
 * Runs every 30 days to check provider sanctions and licensure status.
 * Proofs are anchored to AuditScrapbook for immutable audit trail.
 *
 * Task: B119B-NCQA-011
 */

import { createHash } from 'crypto';
import { AuditScrapbook } from '../../backend/src/blockchain/audit_scrapbook';
import { PolkadotService } from '../../backend/src/blockchain/polkadot_service';

export interface SanctionsCheck {
  providerId: string;
  npi?: string;
  checkType: 'sanctions' | 'licensure';
  status: 'clear' | 'sanctioned' | 'expired' | 'unknown';
  source: string; // e.g., 'OIG', 'SAM', 'STATE_BOARD'
  checkedAt: number;
  details?: Record<string, any>;
}

export interface LicensureCheck {
  providerId: string;
  npi?: string;
  licenseNumber?: string;
  state?: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked' | 'unknown';
  expirationDate?: string;
  checkedAt: number;
  details?: Record<string, any>;
}

export interface MonitoringProof {
  proofId: string;
  providerId: string;
  checks: {
    sanctions?: SanctionsCheck;
    licensure?: LicensureCheck;
  };
  proofHash: string;
  anchoredAt?: number;
  txHash?: string;
}

/**
 * Check OIG (Office of Inspector General) sanctions list
 */
async function checkOIGSanctions(npi: string): Promise<SanctionsCheck> {
  // In production, this would call the OIG LEIE API
  // https://oig.hhs.gov/exclusions/exclusions_list.asp
  // For now, return mock data

  const mockStatus = Math.random() > 0.95 ? 'sanctioned' : 'clear';

  return {
    providerId: `provider-${npi}`,
    npi,
    checkType: 'sanctions',
    status: mockStatus as 'clear' | 'sanctioned',
    source: 'OIG',
    checkedAt: Date.now(),
    details: mockStatus === 'sanctioned' ? {
      exclusionType: 'Program Related',
      exclusionDate: new Date().toISOString(),
    } : undefined,
  };
}

/**
 * Check SAM (System for Award Management) exclusions
 */
async function checkSAMExclusions(npi: string): Promise<SanctionsCheck> {
  // In production, this would call the SAM API
  // For now, return mock data

  return {
    providerId: `provider-${npi}`,
    npi,
    checkType: 'sanctions',
    status: 'clear',
    source: 'SAM',
    checkedAt: Date.now(),
  };
}

/**
 * Check state licensure status
 */
async function checkLicensure(
  npi: string,
  licenseNumber?: string,
  state?: string
): Promise<LicensureCheck> {
  // In production, this would call state licensing board APIs
  // For now, return mock data

  const mockStatus = Math.random() > 0.9 ? 'expired' : 'active';
  const expirationDate = mockStatus === 'expired'
    ? new Date(Date.now() - 86400000).toISOString()
    : new Date(Date.now() + 365 * 86400000).toISOString();

  return {
    providerId: `provider-${npi}`,
    npi,
    licenseNumber: licenseNumber || `LIC-${npi}`,
    state: state || 'CA',
    status: mockStatus as 'active' | 'expired',
    expirationDate,
    checkedAt: Date.now(),
  };
}

/**
 * Create a proof hash from monitoring checks
 */
function createProofHash(checks: MonitoringProof['checks']): string {
  const payload = JSON.stringify({
    sanctions: checks.sanctions,
    licensure: checks.licensure,
    timestamp: Date.now(),
  });

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * NCQA Monitoring Scheduler
 */
export class NCQAMonitoringScheduler {
  private auditScrapbook: AuditScrapbook;
  private polkadot: PolkadotService;
  private proofs: Map<string, MonitoringProof>;

  constructor() {
    this.polkadot = new PolkadotService();
    this.auditScrapbook = new AuditScrapbook(this.polkadot);
    this.proofs = new Map();
  }

  /**
   * Run monitoring checks for a provider
   */
  async runMonitoringChecks(providerId: string, npi: string): Promise<MonitoringProof> {
    console.log(`[NCQA Monitoring] Running checks for provider ${providerId} (NPI: ${npi})`);

    // Run sanctions checks in parallel
    const [oigCheck, samCheck] = await Promise.all([
      checkOIGSanctions(npi),
      checkSAMExclusions(npi),
    ]);

    // Determine overall sanctions status
    const sanctionsStatus: SanctionsCheck = {
      providerId,
      npi,
      checkType: 'sanctions',
      status: oigCheck.status === 'sanctioned' || samCheck.status === 'sanctioned'
        ? 'sanctioned'
        : 'clear',
      source: 'OIG+SAM',
      checkedAt: Date.now(),
      details: {
        oig: oigCheck,
        sam: samCheck,
      },
    };

    // Run licensure check
    const licensureCheck = await checkLicensure(npi);

    // Create proof
    const checks = {
      sanctions: sanctionsStatus,
      licensure: licensureCheck,
    };

    const proofHash = createProofHash(checks);
    const proofId = `ncqa-proof-${providerId}-${Date.now()}`;

    const proof: MonitoringProof = {
      proofId,
      providerId,
      checks,
      proofHash,
    };

    // Anchor proof to AuditScrapbook
    await this.anchorProof(proof);

    this.proofs.set(proofId, proof);

    console.log(`[NCQA Monitoring] Proof created: ${proofId} (hash: ${proofHash})`);

    return proof;
  }

  /**
   * Anchor proof to AuditScrapbook
   */
  private async anchorProof(proof: MonitoringProof): Promise<void> {
    try {
      // Record audit action
      await this.auditScrapbook.recordIdentityAction(
        proof.providerId,
        `ncqa_monitoring_check:${proof.proofId}`
      );

      // Anchor proof hash on-chain
      const txHash = await this.polkadot.anchorData(proof.proofHash);

      proof.anchoredAt = Date.now();
      proof.txHash = txHash;

      console.log(`[NCQA Monitoring] Proof anchored: ${proof.proofId} (tx: ${txHash})`);
    } catch (error) {
      console.error(`[NCQA Monitoring] Failed to anchor proof ${proof.proofId}:`, error);
      // Continue execution even if anchoring fails (graceful degradation)
    }
  }

  /**
   * Run monthly monitoring for all providers
   */
  async runMonthlyMonitoring(): Promise<{
    completed: number;
    failed: number;
    proofs: MonitoringProof[];
    alerts: MonitoringProof[];
  }> {
    console.log('[NCQA Monitoring] Starting monthly monitoring cycle');

    // In production, fetch all providers from database
    // For now, use mock provider list
    const providers = [
      { id: 'provider-1', npi: '1234567890' },
      { id: 'provider-2', npi: '0987654321' },
      // Add more providers from database query
    ];

    const results = await Promise.allSettled(
      providers.map(p => this.runMonitoringChecks(p.id, p.npi))
    );

    const proofs: MonitoringProof[] = [];
    const alerts: MonitoringProof[] = [];
    let completed = 0;
    let failed = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const proof = result.value;
        proofs.push(proof);
        completed++;

        // Check for alerts (sanctions or expired licenses)
        const hasSanctions = proof.checks.sanctions?.status === 'sanctioned';
        const hasExpiredLicense = proof.checks.licensure?.status === 'expired'
          || proof.checks.licensure?.status === 'suspended'
          || proof.checks.licensure?.status === 'revoked';

        if (hasSanctions || hasExpiredLicense) {
          alerts.push(proof);
          console.warn(`[NCQA ALERT] Provider ${proof.providerId} has issues:`, {
            sanctions: hasSanctions,
            licensure: hasExpiredLicense,
          });
        }
      } else {
        failed++;
        console.error(`[NCQA Monitoring] Failed for provider ${providers[index]?.id}:`, result.reason);
      }
    });

    console.log('[NCQA Monitoring] Monthly cycle complete:', {
      completed,
      failed,
      proofs: proofs.length,
      alerts: alerts.length,
      timestamp: new Date().toISOString(),
    });

    return { completed, failed, proofs, alerts };
  }

  /**
   * Get proof by ID
   */
  getProof(proofId: string): MonitoringProof | undefined {
    return this.proofs.get(proofId);
  }

  /**
   * Get all proofs for a provider
   */
  getProviderProofs(providerId: string): MonitoringProof[] {
    return Array.from(this.proofs.values()).filter(p => p.providerId === providerId);
  }
}

// Singleton instance
let scheduler: NCQAMonitoringScheduler | null = null;

export function getNCQAScheduler(): NCQAMonitoringScheduler {
  if (!scheduler) {
    scheduler = new NCQAMonitoringScheduler();
  }
  return scheduler;
}

/**
 * Cron job wrapper for monthly NCQA monitoring
 * Call this from a cron scheduler (e.g., node-cron) every 30 days
 *
 * Example cron expression: "0 0 1 * *" (runs at midnight on the 1st of every month)
 */
export async function runNCQAMonitoringCron() {
  const scheduler = getNCQAScheduler();
  const result = await scheduler.runMonthlyMonitoring();

  console.log('[NCQA MONITORING CRON]', {
    completed: result.completed,
    failed: result.failed,
    proofs: result.proofs.length,
    alerts: result.alerts.length,
    timestamp: new Date().toISOString(),
  });

  // Emit alerts
  result.alerts.forEach(alert => {
    console.error('[NCQA ALERT]', {
      providerId: alert.providerId,
      proofId: alert.proofId,
      sanctions: alert.checks.sanctions?.status,
      licensure: alert.checks.licensure?.status,
    });
  });

  return result;
}

