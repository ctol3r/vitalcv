import type { Express, Request, Response } from 'express';

function estimateRevenuePerDay(specialty?: string): number {
  const map: Record<string, number> = {
    cardiology: 6000,
    neurology: 5500,
    pediatrics: 4000,
    internal_medicine: 4500,
  };

  if (!specialty) return 5000;
  return map[specialty.toLowerCase()] || 5000;
}

export function registerImpactRoutes(app: Express): void {
  app.get('/impact/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    const legacyDays = 90;
    const vitalcvDays = 2;
    const daysSaved = legacyDays - vitalcvDays;

    const specialty = String(req.query.specialty || 'cardiology');
    const revenuePerDay = estimateRevenuePerDay(specialty);

    const estimatedRevenueRecovered = daysSaved * revenuePerDay;

    return res.json({
      npi,
      legacy_days: legacyDays,
      vitalcv_days: vitalcvDays,
      days_saved: daysSaved,
      revenue_per_day_assumption: revenuePerDay,
      estimated_revenue_recovered: estimatedRevenueRecovered,
      generated_at: new Date().toISOString(),
    });
  });
}
