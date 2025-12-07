/**
 * B131F-GENAI-006: GenAI risk report API
 *
 * API endpoints for GenAI risk reports:
 * - GET /genai/reports/latest - Get latest risk summary
 * - GET /genai/reports/:modelId - Get model-specific risk report
 * - GET /genai/reports - Get risk reports for date range
 */

import { Router, Request, Response } from 'express';
import * as RiskReportService from '../../../../../services/genai/reports/riskSummary';

const router = Router();

/**
 * GET /genai/reports/latest
 * Get latest risk summary
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string | undefined;

    const report = await RiskReportService.getLatestRiskReport(modelId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Risk report not found',
        message: 'No risk report found for the specified criteria',
      });
    }

    res.json({
      success: true,
      data: report.summary || report,
    });
  } catch (error) {
    console.error('[GenAI Risk Report API] Error getting latest report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get latest risk report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /genai/reports/:modelId
 * Get model-specific risk report
 */
router.get('/:modelId', async (req: Request, res: Response) => {
  try {
    const modelId = req.params.modelId;
    const periodStart = req.query.periodStart
      ? new Date(req.query.periodStart as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
    const periodEnd = req.query.periodEnd
      ? new Date(req.query.periodEnd as string)
      : new Date(); // Default: now

    const { reportId, summary } = await RiskReportService.generateModelRiskReport(
      modelId,
      periodStart,
      periodEnd
    );

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Model risk report not found',
        message: `No risk report found for model "${modelId}"`,
      });
    }

    res.json({
      success: true,
      data: summary,
      reportId,
    });
  } catch (error) {
    console.error('[GenAI Risk Report API] Error getting model risk report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model risk report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /genai/reports
 * Get risk reports for date range
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const modelId = req.query.modelId as string | undefined;
    const periodStart = req.query.periodStart
      ? new Date(req.query.periodStart as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const periodEnd = req.query.periodEnd
      ? new Date(req.query.periodEnd as string)
      : new Date(); // Default: now

    const reports = await RiskReportService.getRiskReports(periodStart, periodEnd, modelId);

    res.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error) {
    console.error('[GenAI Risk Report API] Error getting risk reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get risk reports',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

