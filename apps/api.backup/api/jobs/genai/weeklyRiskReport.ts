/**
 * B131F-GENAI-006: Weekly GenAI risk report job
 *
 * Scheduled job that generates weekly risk reports for all GenAI models
 * and stores snapshots in the GenAiRiskReport table.
 */

import { generateWeeklyRiskReport } from '../../services/genai/reports/riskSummary';

/**
 * Generate weekly risk report for all models
 */
export async function runWeeklyRiskReport(): Promise<void> {
  console.log('[GenAI Risk Report] Starting weekly risk report job...');

  try {
    const { reportId, summary } = await generateWeeklyRiskReport();

    console.log(`[GenAI Risk Report] Weekly report generated: ${reportId}`);
    console.log(`[GenAI Risk Report] Total decisions: ${summary.totalDecisions}`);
    console.log(`[GenAI Risk Report] Overall override rate: ${(summary.overallOverrideRate * 100).toFixed(2)}%`);
    console.log(`[GenAI Risk Report] Top risks: ${summary.topRisksAcrossModels.length}`);

    // Log top risks
    summary.topRisksAcrossModels.slice(0, 5).forEach((risk, idx) => {
      console.log(
        `[GenAI Risk Report]   ${idx + 1}. ${risk.category} (${risk.riskId}): ${risk.totalCount} occurrences (${risk.percentage.toFixed(2)}%)`
      );
    });
  } catch (error) {
    console.error('[GenAI Risk Report] Weekly report generation failed:', error);
    throw error;
  }
}

/**
 * CLI entry point for running the job manually
 */
if (require.main === module) {
  runWeeklyRiskReport()
    .then(() => {
      console.log('[GenAI Risk Report] Weekly report job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[GenAI Risk Report] Weekly report job failed:', error);
      process.exit(1);
    });
}

export default runWeeklyRiskReport;

