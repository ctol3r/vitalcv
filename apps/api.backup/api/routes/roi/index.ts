/**
 * B119C-ROI-024: ROI endpoint for Ambient-AI time-savings calculation
 *
 * Calculates ROI based on minutes saved per visit and projects dollar savings
 * Inputs: minutes_saved, visits_per_month, clinician_hourly_rate
 * Output: minutes_saved, dollar_projection, roi_metrics
 */

import express, { Request, Response } from 'express';

const router = express.Router();

export interface ROIInput {
  minutes_saved: number; // Minutes saved per visit using Ambient-AI
  visits_per_month: number; // Number of visits per month
  clinician_hourly_rate?: number; // Optional: hourly rate for dollar calculation (default: $150/hr)
}

export interface ROIOutput {
  minutes_saved: {
    per_visit: number;
    per_month: number;
    per_year: number;
  };
  dollar_projection: {
    per_month: number;
    per_year: number;
    hourly_rate_used: number;
  };
  roi_metrics: {
    time_savings_percentage: number; // Percentage of time saved vs baseline
    annual_savings: number;
    break_even_months?: number; // If implementation_cost provided
  };
  evidence_reference?: {
    study: string;
    doi: string;
    link: string;
  };
}

/**
 * POST /api/roi/calculate
 * Calculate ROI for Ambient-AI time savings
 */
router.post('/calculate', (req: Request, res: Response) => {
  try {
    const { minutes_saved, visits_per_month, clinician_hourly_rate, implementation_cost } = req.body;

    // Validate inputs
    if (!minutes_saved || minutes_saved <= 0) {
      return res.status(400).json({
        error: 'invalid_input',
        error_description: 'minutes_saved must be a positive number',
      });
    }

    if (!visits_per_month || visits_per_month <= 0) {
      return res.status(400).json({
        error: 'invalid_input',
        error_description: 'visits_per_month must be a positive number',
      });
    }

    // Default hourly rate: $150/hr (average clinician rate)
    const hourlyRate = clinician_hourly_rate || 150;
    const minutesPerHour = 60;

    // Calculate time savings
    const minutesPerMonth = minutes_saved * visits_per_month;
    const minutesPerYear = minutesPerMonth * 12;
    const hoursPerYear = minutesPerYear / minutesPerHour;

    // Calculate dollar projections
    const dollarPerMonth = (minutesPerMonth / minutesPerHour) * hourlyRate;
    const dollarPerYear = hoursPerYear * hourlyRate;

    // Calculate ROI metrics
    // Baseline: Assume 15 minutes per visit for documentation (industry average)
    const baselineMinutesPerVisit = 15;
    const timeSavingsPercentage = (minutes_saved / baselineMinutesPerVisit) * 100;

    // Calculate break-even if implementation cost provided
    let breakEvenMonths: number | undefined;
    if (implementation_cost && implementation_cost > 0) {
      breakEvenMonths = Math.ceil(implementation_cost / dollarPerMonth);
    }

    const output: ROIOutput = {
      minutes_saved: {
        per_visit: minutes_saved,
        per_month: Math.round(minutesPerMonth * 100) / 100,
        per_year: Math.round(minutesPerYear * 100) / 100,
      },
      dollar_projection: {
        per_month: Math.round(dollarPerMonth * 100) / 100,
        per_year: Math.round(dollarPerYear * 100) / 100,
        hourly_rate_used: hourlyRate,
      },
      roi_metrics: {
        time_savings_percentage: Math.round(timeSavingsPercentage * 100) / 100,
        annual_savings: Math.round(dollarPerYear * 100) / 100,
        break_even_months: breakEvenMonths,
      },
      evidence_reference: {
        study: 'Effect of Ambient Artificial Intelligence Documentation Technology on Clinician Burnout and Well-Being',
        doi: '10.1001/jamanetworkopen.2025.34976',
        link: '/api/evidence/registry?kpiReference=minutes-in-notes',
      },
    };

    res.json({
      success: true,
      roi: output,
      inputs: {
        minutes_saved,
        visits_per_month,
        clinician_hourly_rate: hourlyRate,
        implementation_cost: implementation_cost || null,
      },
    });
  } catch (error: any) {
    console.error('ROI calculation error:', error);
    res.status(500).json({
      error: 'calculation_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /api/roi/calculate
 * Calculate ROI via query parameters (for simple GET requests)
 */
router.get('/calculate', (req: Request, res: Response) => {
  try {
    const minutes_saved = parseFloat(req.query.minutes_saved as string);
    const visits_per_month = parseFloat(req.query.visits_per_month as string);
    const clinician_hourly_rate = req.query.clinician_hourly_rate
      ? parseFloat(req.query.clinician_hourly_rate as string)
      : undefined;
    const implementation_cost = req.query.implementation_cost
      ? parseFloat(req.query.implementation_cost as string)
      : undefined;

    // Use POST handler logic
    req.body = {
      minutes_saved,
      visits_per_month,
      clinician_hourly_rate,
      implementation_cost,
    };

    // Call POST handler
    return router.stack.find(layer => layer.route?.path === '/calculate' && layer.route?.methods?.post)
      ? router.handle(req, res)
      : res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('ROI calculation error:', error);
    res.status(500).json({
      error: 'calculation_failed',
      error_description: error.message,
    });
  }
});

/**
 * GET /api/roi/example
 * Get example ROI calculation
 */
router.get('/example', (req: Request, res: Response) => {
  const example = {
    inputs: {
      minutes_saved: 5, // 5 minutes saved per visit
      visits_per_month: 200, // 200 visits per month
      clinician_hourly_rate: 150, // $150/hour
    },
    example_request: {
      method: 'POST',
      url: '/api/roi/calculate',
      body: {
        minutes_saved: 5,
        visits_per_month: 200,
        clinician_hourly_rate: 150,
      },
    },
    example_response: {
      success: true,
      roi: {
        minutes_saved: {
          per_visit: 5,
          per_month: 1000,
          per_year: 12000,
        },
        dollar_projection: {
          per_month: 2500,
          per_year: 30000,
          hourly_rate_used: 150,
        },
        roi_metrics: {
          time_savings_percentage: 33.33,
          annual_savings: 30000,
        },
      },
    },
  };

  res.json(example);
});

export default router;

