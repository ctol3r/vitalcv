/**
 * B128B-PSV-022: Compliance Coverage Endpoint
 * /compliance/coverage: %auto-PSV + stale-by-source + SLA badges
 *
 * Provides comprehensive coverage metrics for NCQA compliance:
 * - Percentage of auto-PSV verification
 * - Stale evidence by source
 * - SLA status badges
 * - Per-row evidence IDs
 */

import express, { Request, Response } from 'express';
import { getPSVRegistry } from '../../../services/psv/registry';
import { getSourceRegistry } from '../../../services/psv/source-registry.json';

const router = express.Router();

/**
 * SLA thresholds in days
 */
const SLA_THRESHOLDS = {
  green: 30,   // < 30 days: Green (current)
  yellow: 60,  // 30-60 days: Yellow (approaching stale)
  red: 90,     // > 90 days: Red (stale)
};

/**
 * Calculate days since timestamp
 */
function daysSince(timestamp: number): number {
  const now = Date.now();
  const diffMs = now - timestamp;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get SLA badge color based on age
 */
function getSLABadge(ageInDays: number): 'green' | 'yellow' | 'red' {
  if (ageInDays < SLA_THRESHOLDS.green) return 'green';
  if (ageInDays < SLA_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

/**
 * Calculate stale age category
 */
function getStaleCategory(ageInDays: number): 'current' | 'approaching_stale' | 'stale' {
  if (ageInDays < SLA_THRESHOLDS.green) return 'current';
  if (ageInDays < SLA_THRESHOLDS.red) return 'approaching_stale';
  return 'stale';
}

/**
 * GET /compliance/coverage
 * Returns comprehensive coverage metrics with auto-PSV percentage, stale tracking, and SLA badges
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const registry = getPSVRegistry();
    const allVerifications = registry.getVerificationHistory({});
    const allEndpoints = registry.listEndpoints({});

    // Calculate auto-PSV percentage
    const totalVerifications = allVerifications.length;
    const autoVerifications = allVerifications.filter(v => v.status === 'success').length;
    const autoPSVPercentage = totalVerifications > 0
      ? Math.round((autoVerifications / totalVerifications) * 100)
      : 0;

    // Group verifications by source
    const verificationsBySource = new Map<string, any[]>();
    allVerifications.forEach(verification => {
      const endpoint = allEndpoints.find(e => e.id === verification.endpointId);
      const sourceId = endpoint?.provider || 'unknown';

      if (!verificationsBySource.has(sourceId)) {
        verificationsBySource.set(sourceId, []);
      }
      verificationsBySource.get(sourceId)!.push(verification);
    });

    // Calculate stale metrics by source
    const staleBySource = Array.from(verificationsBySource.entries()).map(([sourceId, verifications]) => {
      const latestVerification = verifications.reduce((latest, current) => {
        return current.timestamp > latest.timestamp ? current : latest;
      }, verifications[0]);

      const ageInDays = daysSince(latestVerification.timestamp);
      const slaBadge = getSLABadge(ageInDays);
      const staleCategory = getStaleCategory(ageInDays);

      return {
        sourceId,
        sourceName: sourceId,
        totalVerifications: verifications.length,
        successfulVerifications: verifications.filter(v => v.status === 'success').length,
        latestVerificationId: latestVerification.id,
        latestVerificationTimestamp: latestVerification.timestamp,
        ageInDays,
        slaBadge,
        staleCategory,
        evidenceIds: verifications.map(v => v.id),
      };
    });

    // Calculate overall SLA distribution
    const slaDistribution = {
      green: staleBySource.filter(s => s.slaBadge === 'green').length,
      yellow: staleBySource.filter(s => s.slaBadge === 'yellow').length,
      red: staleBySource.filter(s => s.slaBadge === 'red').length,
    };

    // Calculate stale distribution
    const staleDistribution = {
      current: staleBySource.filter(s => s.staleCategory === 'current').length,
      approaching_stale: staleBySource.filter(s => s.staleCategory === 'approaching_stale').length,
      stale: staleBySource.filter(s => s.staleCategory === 'stale').length,
    };

    // Prepare coverage tiles
    const tiles = [
      {
        id: 'auto-psv-percentage',
        title: 'Auto-PSV Coverage',
        value: `${autoPSVPercentage}%`,
        description: `${autoVerifications} of ${totalVerifications} verifications automated`,
        badge: autoPSVPercentage >= 80 ? 'green' : autoPSVPercentage >= 60 ? 'yellow' : 'red',
      },
      {
        id: 'total-sources',
        title: 'Total Sources',
        value: staleBySource.length.toString(),
        description: `${verificationsBySource.size} unique verification sources`,
        badge: 'green',
      },
      {
        id: 'sla-green',
        title: 'Current (< 30 days)',
        value: slaDistribution.green.toString(),
        description: `${Math.round((slaDistribution.green / staleBySource.length) * 100)}% of sources`,
        badge: 'green',
      },
      {
        id: 'sla-yellow',
        title: 'Approaching Stale (30-90 days)',
        value: slaDistribution.yellow.toString(),
        description: `${Math.round((slaDistribution.yellow / staleBySource.length) * 100)}% of sources`,
        badge: 'yellow',
      },
      {
        id: 'sla-red',
        title: 'Stale (> 90 days)',
        value: slaDistribution.red.toString(),
        description: `${Math.round((slaDistribution.red / staleBySource.length) * 100)}% of sources`,
        badge: 'red',
      },
    ];

    res.json({
      summary: {
        autoPSVPercentage,
        totalVerifications,
        autoVerifications,
        manualVerifications: totalVerifications - autoVerifications,
        totalSources: staleBySource.length,
        slaDistribution,
        staleDistribution,
      },
      tiles,
      staleBySource: staleBySource.sort((a, b) => b.ageInDays - a.ageInDays), // Sort by stalest first
      slaThresholds: SLA_THRESHOLDS,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Coverage endpoint error:', error);
    res.status(500).json({
      error: 'coverage_query_failed',
      error_description: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /compliance/coverage/source/:sourceId
 * Get detailed coverage for a specific source
 */
router.get('/source/:sourceId', async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    const registry = getPSVRegistry();
    const allVerifications = registry.getVerificationHistory({});
    const allEndpoints = registry.listEndpoints({});

    // Filter verifications for this source
    const sourceVerifications = allVerifications.filter(v => {
      const endpoint = allEndpoints.find(e => e.id === v.endpointId);
      return endpoint?.provider === sourceId;
    });

    if (sourceVerifications.length === 0) {
      return res.status(404).json({
        error: 'source_not_found',
        error_description: `No verifications found for source: ${sourceId}`,
      });
    }

    const latestVerification = sourceVerifications.reduce((latest, current) => {
      return current.timestamp > latest.timestamp ? current : latest;
    }, sourceVerifications[0]);

    const ageInDays = daysSince(latestVerification.timestamp);
    const slaBadge = getSLABadge(ageInDays);
    const staleCategory = getStaleCategory(ageInDays);

    const successfulVerifications = sourceVerifications.filter(v => v.status === 'success').length;
    const successRate = Math.round((successfulVerifications / sourceVerifications.length) * 100);

    res.json({
      sourceId,
      sourceName: sourceId,
      totalVerifications: sourceVerifications.length,
      successfulVerifications,
      failedVerifications: sourceVerifications.length - successfulVerifications,
      successRate: `${successRate}%`,
      latestVerificationId: latestVerification.id,
      latestVerificationTimestamp: latestVerification.timestamp,
      ageInDays,
      slaBadge,
      staleCategory,
      verifications: sourceVerifications.map(v => ({
        id: v.id,
        verificationType: v.verificationType,
        subjectId: v.subjectId,
        status: v.status,
        timestamp: v.timestamp,
        ageInDays: daysSince(v.timestamp),
        slaBadge: getSLABadge(daysSince(v.timestamp)),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Source coverage query error:', error);
    res.status(500).json({
      error: 'source_query_failed',
      error_description: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /compliance/coverage/evidence/:evidenceId
 * Get specific evidence details
 */
router.get('/evidence/:evidenceId', async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const registry = getPSVRegistry();
    const allVerifications = registry.getVerificationHistory({});

    const verification = allVerifications.find(v => v.id === evidenceId);

    if (!verification) {
      return res.status(404).json({
        error: 'evidence_not_found',
        error_description: `Evidence not found: ${evidenceId}`,
      });
    }

    const ageInDays = daysSince(verification.timestamp);
    const slaBadge = getSLABadge(ageInDays);
    const staleCategory = getStaleCategory(ageInDays);

    res.json({
      evidenceId: verification.id,
      verificationType: verification.verificationType,
      subjectId: verification.subjectId,
      endpointId: verification.endpointId,
      status: verification.status,
      timestamp: verification.timestamp,
      ageInDays,
      slaBadge,
      staleCategory,
      requestPayload: verification.requestPayload,
      responsePayload: verification.responsePayload,
      durationMs: verification.durationMs,
    });
  } catch (error: any) {
    console.error('Evidence query error:', error);
    res.status(500).json({
      error: 'evidence_query_failed',
      error_description: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
