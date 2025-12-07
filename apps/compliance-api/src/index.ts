import './tracing';
import express, { Request, Response } from 'express';
import cors from 'cors';
import evidenceRouter from './routes/evidence';
import ncqaEvidenceRouter from './routes/ncqa-evidence';
import { fhirBadgeRouter } from './routes/fhir-badge';
import { fhirDashboardRouter } from './routes/fhir-dashboard';
import { blockEvidenceRouter } from './routes/block-evidence';
import coverageRouter from './routes/coverage';
import { getFreshnessManager } from '../../services/psv/freshness';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { getPSVChecksForProvider, getPSVCheck, getAllPSVChecks } from '../../services/psv/evidence';
import { getSource } from '../../services/psv/registry';
import { createLogger, serializeError } from '@chai-vc/logging-core';
import { requestIdMiddleware } from './middleware/requestId';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'compliance-api',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// B93-SEC-001: Enforce allowed_sinks on all inbound routes (repo-wide)
// Apply middleware to all routes except health checks
app.use((req, res, next) => {
  // Skip health checks
  if (req.path === '/health') {
    return next();
  }
  return allowedSinksEnforcer(req, res, next);
});

// Evidence export routes
app.use('/compliance', evidenceRouter);

// B119A-PSV-007: NCQA Evidence ZIP export routes
app.use('/compliance/ncqa', ncqaEvidenceRouter);

// FHIR Pipeline badge routes
app.use('/', fhirBadgeRouter);

// B121C-FHIR-021: FHIR Pipeline compliance dashboard routes
app.use('/', fhirDashboardRouter);

// B121C-OPS-030: Block-level hash evidence viewer routes
app.use('/', blockEvidenceRouter);

// B128B-PSV-022: Coverage endpoint with auto-PSV, stale tracking, and SLA badges
app.use('/compliance/coverage', coverageRouter);

// B135C: Privileging and compliance reporting routes
import privilegeReportRouter from './routes/org/privileges/report';
import oppeReportRouter from './routes/org/oppe/report';
import npdbReportRouter from './routes/org/npdb/report';
import exportBundleRouter from './routes/org/privileges/exportBundle';

// S72-STRETCH-B-008: Privilege evidence bundle exporter (enhanced version)
import { privilegeEvidenceBundleRouter } from './routes/org/privileges/evidenceBundle';

// B137C: Payer enrollment reporting routes
import payerReportRouter from './routes/org/payer/report';
import caqhReconRouter from './routes/org/payer/caqhRecon';
import pecosRevalidationRouter from './routes/org/payer/pecosRevalidation';

// B138C: Compacts reporting routes
import compactsReportRouter from './routes/org/compacts/report';
import compactsJobsReportRouter from './routes/org/compacts/jobsReport';

// B139C: International compliance reporting routes
import intlComplianceReportRouter from './routes/org/intl/complianceReport';

// B145C-EXEC-005: Executive quarterly analytics export
import quarterlyExportRouter from './routes/exec/quarterlyExport';

app.use('/', privilegeReportRouter);
app.use('/', oppeReportRouter);
app.use('/', npdbReportRouter);
app.use('/', exportBundleRouter);
// S72-STRETCH-B-008: Enhanced privilege evidence bundle exporter
app.use('/api/org', privilegeEvidenceBundleRouter);

// B137C-REPORT-001, B137C-REPORT-002, B137C-PECOS-003
app.use('/', payerReportRouter);
app.use('/', caqhReconRouter);
app.use('/', pecosRevalidationRouter);

// B138C-REPORT-003, B138C-REPORT-004
app.use('/', compactsReportRouter);
app.use('/', compactsJobsReportRouter);

// B139C-REPORT-005
app.use('/', intlComplianceReportRouter);

// B145C-EXEC-005
app.use('/exec/quarterly-export', quarterlyExportRouter);

/**
 * Freshness breaches endpoint
 * GET /compliance/freshness/breaches
 */
app.get('/compliance/freshness/breaches', (req: Request, res: Response) => {
  const manager = getFreshnessManager();
  const breaches = manager.getBreaches();

  res.json({
    count: breaches.length,
    breaches,
  });
});

/**
 * Freshness alerts endpoint
 * GET /compliance/freshness/alerts
 */
app.get('/compliance/freshness/alerts', (req: Request, res: Response) => {
  const manager = getFreshnessManager();
  const limit = parseInt(req.query.limit as string) || 100;
  const alerts = manager.getAlerts(limit);

  res.json({
    count: alerts.length,
    alerts,
  });
});

/**
 * Stale items export
 * GET /compliance/freshness/stale
 */
app.get('/compliance/freshness/stale', (req: Request, res: Response) => {
  const manager = getFreshnessManager();
  const stale = manager.exportStaleItems();

  res.json(stale);
});

/**
 * B121B-COV-011: SLA color thresholds configuration
 * Configurable thresholds via environment variables with defaults
 */
const SLA_THRESHOLDS = {
  excellent: parseFloat(process.env.SLA_THRESHOLD_EXCELLENT || '95'),
  good: parseFloat(process.env.SLA_THRESHOLD_GOOD || '85'),
  fair: parseFloat(process.env.SLA_THRESHOLD_FAIR || '70'),
  // Below fair threshold is considered poor/violation
};

/**
 * Coverage aggregations endpoint
 * GET /compliance/coverage
 * B104C-NCQA-046: Coverage API: %auto-PSV + stale list + SLA badges
 * B121B-COV-011: SLA color badges + stale list age tracking
 *
 * Exposes %auto-PSV, avg days, freshness breaches, stale list, and SLA badges
 *
 * Acceptance Criteria:
 * - JSON returns tiles + stale + SLA
 * - SLA thresholds configured via environment variables
 * - Stale list includes age tracking (days since verification)
 */
app.get('/compliance/coverage', async (req: Request, res: Response) => {
  try {
    const manager = getFreshnessManager();
    const breaches = manager.getBreaches();
    const staleExport = manager.exportStaleItems();
    const stale = staleExport.stale || [];

    // Get all PSV checks from evidence service
    // Note: In production, this would query a database
    // For now, we use the in-memory store from evidence.ts
    // TODO: Replace with database query when PSV checks are persisted
    const allChecks = getAllPSVChecks();

    const totalChecks = allChecks.length;

    // Count auto-PSV checks (those with methodOfVerification === 'API')
    const autoPSVChecks = allChecks.filter(
      (check) => check.evidenceBundle?.methodOfVerification === 'API'
    ).length;

    // Calculate average days since last verification
    const now = Date.now();
    const totalDays = allChecks.reduce((sum: number, check) => {
      const ageMs = now - (check.updatedAt || check.evidenceBundle?.timestamp || now);
      return sum + Math.floor(ageMs / (1000 * 60 * 60 * 24));
    }, 0);
    const avgDays = totalChecks > 0 ? Math.round(totalDays / totalChecks) : 0;

    const autoPSVPercentage = totalChecks > 0 ? (autoPSVChecks / totalChecks) * 100 : 0;

  // B121B-COV-011: Calculate SLA badges based on configurable thresholds
  const getSLABadge = (percentage: number): { status: string; color: string; label: string } => {
    if (percentage >= SLA_THRESHOLDS.excellent) {
      return { status: 'excellent', color: 'green', label: 'Excellent' };
    } else if (percentage >= SLA_THRESHOLDS.good) {
      return { status: 'good', color: 'blue', label: 'Good' };
    } else if (percentage >= SLA_THRESHOLDS.fair) {
      return { status: 'fair', color: 'yellow', label: 'Fair' };
    } else {
      return { status: 'poor', color: 'red', label: 'Needs Improvement' };
    }
  };

  const autoPSVBadge = getSLABadge(autoPSVPercentage);

  // Calculate freshness SLA (based on breaches)
  const freshnessScore = breaches.length === 0 ? 100 : Math.max(0, 100 - (breaches.length * 5));
  const freshnessBadge = getSLABadge(freshnessScore);

  // Tiles for dashboard display
  const tiles = [
    {
      id: 'auto-psv',
      title: 'Auto-PSV Coverage',
      value: `${autoPSVPercentage.toFixed(1)}%`,
      subtitle: `${autoPSVChecks} of ${totalChecks} checks`,
      badge: autoPSVBadge,
      trend: '+2.5%', // Mock trend - replace with actual calculation
    },
    {
      id: 'average-days',
      title: 'Average Days',
      value: `${avgDays}`,
      subtitle: 'Since last verification',
      badge: { status: 'good', color: 'blue', label: 'On Track' },
      trend: '-3 days',
    },
    {
      id: 'freshness-breaches',
      title: 'Freshness Breaches',
      value: `${breaches.length}`,
      subtitle: 'Items requiring attention',
      badge: freshnessBadge,
      trend: breaches.length > 0 ? `+${breaches.length}` : '0',
    },
    {
      id: 'stale-items',
      title: 'Stale Items',
      value: `${stale.length}`,
      subtitle: 'Exceeding freshness threshold',
      badge: stale.length === 0
        ? { status: 'excellent', color: 'green', label: 'None' }
        : { status: 'poor', color: 'red', label: 'Action Required' },
      trend: stale.length > 0 ? `+${stale.length}` : '0',
    },
  ];

  // B121B-COV-011: Transform stale items with age tracking
  // Include source information, age (days since verification), and evidence ID
  const transformedStale = stale.slice(0, 100).map((item) => {
    const check = getPSVCheck(item.checkId);
    const source = check ? getSource(check.sourceId) : null;

    // Calculate age in days since last verification
    const lastVerifiedTimestamp = item.breachedAt - (item.ageDays * 24 * 60 * 60 * 1000);
    const ageInDays = item.ageDays; // Already calculated in stale export

    return {
      id: item.checkId,
      evidenceId: check?.id || item.checkId, // Per-row evidence ID for download
      checkType: item.checkType,
      sourceId: check?.sourceId || item.providerId,
      sourceName: source?.name || 'Unknown',
      lastVerified: new Date(lastVerifiedTimestamp).toISOString(),
      daysSinceVerification: ageInDays,
      age: ageInDays, // Age in days for sorting/filtering
      source: source?.name || 'Unknown', // Include source name for display
      // B121B-COV-011: Additional age tracking metadata
      ageMetadata: {
        days: ageInDays,
        weeks: Math.floor(ageInDays / 7),
        months: Math.floor(ageInDays / 30),
        lastVerifiedDate: new Date(lastVerifiedTimestamp).toISOString(),
        breachedAt: new Date(item.breachedAt).toISOString(),
      },
    };
  });

  // Group stale items by source for filtering
  const staleBySource = transformedStale.reduce((acc, item) => {
    const sourceName = item.sourceName;
    if (!acc[sourceName]) {
      acc[sourceName] = [];
    }
    acc[sourceName].push(item);
    return acc;
  }, {} as Record<string, typeof transformedStale>);

  // Calculate stale counts by source
  const staleCountsBySource = Object.entries(staleBySource).map(([sourceName, items]) => ({
    source: sourceName,
    count: items.length,
    oldestAge: Math.max(...items.map(i => i.age)),
    averageAge: Math.round(items.reduce((sum, i) => sum + i.age, 0) / items.length),
  }));

  res.json({
    // Summary metrics
    autoPSVPercentage,
    averageDays: avgDays,
    freshnessBreaches: breaches.length,
    staleItemsCount: stale.length,

    // Tiles for dashboard
    tiles,

    // B121B-COV-011: Stale list with age tracking (limited to first 100 for performance)
    stale: transformedStale,
    staleTotal: stale.length,

    // Stale grouped by source (for filtering)
    staleBySource,
    staleCountsBySource,

    // B121B-COV-011: SLA badges with configured thresholds
    sla: {
      autoPSV: autoPSVBadge,
      freshness: freshnessBadge,
      overall: getSLABadge((autoPSVPercentage + freshnessScore) / 2),
      thresholds: SLA_THRESHOLDS, // Include thresholds in response for transparency
    },

    // Breaches by type
    breachesByType: breaches.reduce((acc, b) => {
      acc[b.checkType] = (acc[b.checkType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),

    // B121B-COV-011: Stale age statistics
    staleAgeStats: {
      oldestAge: transformedStale.length > 0 ? Math.max(...transformedStale.map(i => i.age)) : 0,
      averageAge: transformedStale.length > 0
        ? Math.round(transformedStale.reduce((sum, i) => sum + i.age, 0) / transformedStale.length)
        : 0,
      ageDistribution: {
        '0-30': transformedStale.filter(i => i.age >= 0 && i.age <= 30).length,
        '31-60': transformedStale.filter(i => i.age >= 31 && i.age <= 60).length,
        '61-90': transformedStale.filter(i => i.age >= 61 && i.age <= 90).length,
        '90+': transformedStale.filter(i => i.age > 90).length,
      },
    },

    // Timestamp
    timestamp: new Date().toISOString(),
  });
  } catch (error) {
    log.error('Coverage endpoint error', { error: serializeError(error) });
    res.status(500).json({
      error: 'coverage_calculation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'compliance-api' });
});

const PORT = process.env.PORT || 4004;

app.listen(PORT, () => {
  log.info('Compliance API listening', { port: PORT });
});

export default app;

