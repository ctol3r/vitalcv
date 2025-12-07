/**
 * B233B-CAREER-006: WorkforceDemandForecaster
 *
 * Aggregates anonymized market data on job postings and credential requirements;
 * predicts demand by specialty and region using statistical models;
 * updates daily; does not rely on sensitive personal attributes
 */

import { PrismaClient } from '@prisma/client';

export interface AnonymizedJobMarketData {
  specialty: string;
  region: string; // State or region code
  date: Date;
  jobPostingCount: number;
  requiredCredentials: string[]; // Credential types/codes
  averageCompensation?: number;
  modality: 'in-person' | 'telehealth' | 'hybrid';
}

export interface DemandForecast {
  specialty: string;
  region: string;
  forecastDate: Date;
  horizonDays: number;
  predictedDemand: number;
  lowerBound: number;
  upperBound: number;
  confidenceLevel: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  metadata?: {
    modelType: string;
    featuresUsed?: any;
  };
}

export interface ForecastRequest {
  specialty?: string;
  region?: string;
  horizonDays?: number[]; // Default: [7, 30, 90, 180]
  includeTrends?: boolean;
}

export class WorkforceDemandForecaster {
  constructor(private prisma: PrismaClient) {}

  /**
   * Aggregate anonymized market data from job postings
   * Excludes personal identifiers - only aggregates counts and requirements
   */
  async aggregateMarketData(
    startDate: Date,
    endDate: Date,
    specialty?: string,
    region?: string
  ): Promise<AnonymizedJobMarketData[]> {
    const where: any = {
      status: 'active',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (specialty) {
      where.specialty = specialty;
    }

    if (region) {
      where.location = {
        path: ['state'],
        equals: region,
      };
    }

    // Fetch job postings - anonymized, no personal data
    const jobPostings = await this.prisma.jobPosting.findMany({
      where,
      select: {
        specialty: true,
        location: true,
        createdAt: true,
        requiredStates: true,
        compRangeMin: true,
        compRangeMax: true,
        modality: true,
        // Note: We don't select partnerId, externalJobId, or any personal identifiers
      },
    });

    // Group by specialty, region, and date (daily aggregation)
    const grouped = new Map<string, AnonymizedJobMarketData>();

    for (const job of jobPostings) {
      const regionKey = this.extractRegion(job.location);
      const dateKey = new Date(job.createdAt);
      dateKey.setHours(0, 0, 0, 0); // Normalize to day

      const key = `${job.specialty}|${regionKey}|${dateKey.toISOString()}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          specialty: job.specialty,
          region: regionKey,
          date: dateKey,
          jobPostingCount: 0,
          requiredCredentials: [],
          modality: job.modality || 'in-person',
        });
      }

      const data = grouped.get(key)!;
      data.jobPostingCount += 1;

      // Aggregate required credentials (from requiredStates)
      if (job.requiredStates && job.requiredStates.length > 0) {
        const creds = job.requiredStates.map((s) => `license:${s}`);
        data.requiredCredentials = [
          ...new Set([...data.requiredCredentials, ...creds]),
        ];
      }

      // Track average compensation (anonymized)
      if (job.compRangeMin && job.compRangeMax) {
        const avg = (job.compRangeMin + job.compRangeMax) / 2;
        if (!data.averageCompensation) {
          data.averageCompensation = avg;
        } else {
          data.averageCompensation = (data.averageCompensation + avg) / 2;
        }
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * Predict demand by specialty and region using statistical models
   */
  async predictDemand(request: ForecastRequest = {}): Promise<DemandForecast[]> {
    const {
      specialty,
      region,
      horizonDays = [7, 30, 90, 180],
      includeTrends = true,
    } = request;

    // Get historical data (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const historicalData = await this.aggregateMarketData(
      startDate,
      endDate,
      specialty,
      region
    );

    // Group by specialty and region for forecasting
    const forecasts: DemandForecast[] = [];

    const specialties = specialty
      ? [specialty]
      : [...new Set(historicalData.map((d) => d.specialty))];
    const regions = region
      ? [region]
      : [...new Set(historicalData.map((d) => d.region))];

    for (const spec of specialties) {
      for (const reg of regions) {
        const specRegionData = historicalData.filter(
          (d) => d.specialty === spec && d.region === reg
        );

        if (specRegionData.length === 0) continue;

        // Generate forecasts for each horizon
        for (const horizon of horizonDays) {
          const forecast = this.generateForecast(
            specRegionData,
            spec,
            reg,
            horizon,
            includeTrends
          );
          forecasts.push(forecast);
        }
      }
    }

    return forecasts;
  }

  /**
   * Generate forecast using statistical model (moving average with trend)
   */
  private generateForecast(
    historicalData: AnonymizedJobMarketData[],
    specialty: string,
    region: string,
    horizonDays: number,
    includeTrends: boolean
  ): DemandForecast {
    // Sort by date
    historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate moving average (7-day window)
    const windowSize = Math.min(7, historicalData.length);
    const recentData = historicalData.slice(-windowSize);
    const avgDemand =
      recentData.reduce((sum, d) => sum + d.jobPostingCount, 0) / recentData.length;

    // Calculate trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (historicalData.length >= 14) {
      const firstHalf = historicalData.slice(0, Math.floor(historicalData.length / 2));
      const secondHalf = historicalData.slice(Math.floor(historicalData.length / 2));

      const firstAvg =
        firstHalf.reduce((sum, d) => sum + d.jobPostingCount, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, d) => sum + d.jobPostingCount, 0) / secondHalf.length;

      const change = (secondAvg - firstAvg) / firstAvg;
      if (change > 0.1) trend = 'increasing';
      else if (change < -0.1) trend = 'decreasing';
    }

    // Apply trend projection
    let predictedDemand = avgDemand;
    if (includeTrends && trend !== 'stable') {
      const trendFactor = trend === 'increasing' ? 1.05 : 0.95;
      const periods = Math.floor(horizonDays / 7); // Weekly periods
      predictedDemand = avgDemand * Math.pow(trendFactor, periods);
    }

    // Calculate confidence intervals (wider for longer horizons)
    const confidenceLevel = Math.max(0.5, 1 - horizonDays / 365);
    const stdDev = this.calculateStdDev(recentData.map((d) => d.jobPostingCount));
    const margin = stdDev * Math.sqrt(horizonDays / 7) * 1.96; // 95% CI approximation

    return {
      specialty,
      region,
      forecastDate: new Date(),
      horizonDays,
      predictedDemand: Math.round(predictedDemand),
      lowerBound: Math.max(0, Math.round(predictedDemand - margin)),
      upperBound: Math.round(predictedDemand + margin),
      confidenceLevel,
      trend,
      metadata: {
        modelType: 'moving_average_with_trend',
        featuresUsed: {
          windowSize,
          historicalDataPoints: historicalData.length,
          trend,
        },
      },
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Extract region from location JSON
   */
  private extractRegion(location: any): string {
    if (!location) return 'unknown';
    if (typeof location === 'string') return location;
    if (location.state) return location.state;
    if (location.region) return location.region;
    return 'unknown';
  }

  /**
   * Update daily forecasts (should be called by a scheduled job)
   */
  async updateDailyForecasts(): Promise<void> {
    const forecasts = await this.predictDemand({
      horizonDays: [7, 30, 90, 180],
      includeTrends: true,
    });

    // Store forecasts (could be saved to a ForecastCache table or similar)
    // For now, this method generates forecasts on-demand
    // In production, you might want to cache these in Redis or a ForecastCache table
    console.log(`Generated ${forecasts.length} demand forecasts`);
  }
}

