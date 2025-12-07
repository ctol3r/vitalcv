/**
 * B206A-WF-004: DemandForecastEngine
 *
 * Orchestrates demand forecasting:
 * - Predicts demand for 7, 14, 30, 90 days
 * - Returns ranges with confidence intervals
 * - Outputs DemandForecast records to database
 */

import { PrismaClient } from '@prisma/client';
import { DemandFeatureExtractor, DemandFeatures } from './extractors/demandFeatures.js';
import { DemandForecastModel, ModelType, ModelConfig } from './model/demandModel.js';
import { ForecastResult } from './model/demandModel.js';

export interface ForecastRequest {
  orgId?: string;
  department?: string;
  specialty?: string;
  role?: string;
  startDate?: Date;
  horizonDays?: number[]; // Default: [7, 14, 30, 90]
  modelType?: ModelType;
  modelConfig?: Partial<ModelConfig>;
}

export interface ForecastResponse {
  forecasts: Array<{
    forecastDate: Date;
    horizonDays: number;
    predictedDemand: number;
    lowerBound?: number;
    upperBound?: number;
    confidenceLevel?: number;
    modelType: string;
    forecastId?: string; // Database record ID
  }>;
  metadata: {
    modelType: string;
    modelVersion?: string;
    featuresUsed?: any;
    generatedAt: Date;
  };
}

export class DemandForecastEngine {
  private featureExtractor: DemandFeatureExtractor;
  private model: DemandForecastModel;

  constructor(
    private prisma: PrismaClient,
    modelConfig?: ModelConfig
  ) {
    this.featureExtractor = new DemandFeatureExtractor(prisma);

    // Default to ML model if no config provided
    const config: ModelConfig = modelConfig || {
      type: 'ml',
      confidenceInterval: 0.95,
    };

    this.model = new DemandForecastModel(config);
  }

  /**
   * Generate forecasts for specified horizons
   */
  async forecast(request: ForecastRequest): Promise<ForecastResponse> {
    const {
      orgId,
      department,
      specialty,
      role,
      startDate = new Date(),
      horizonDays = [7, 14, 30, 90],
      modelType,
      modelConfig,
    } = request;

    // If model type is specified, create new model
    if (modelType) {
      const config: ModelConfig = {
        type: modelType,
        confidenceInterval: 0.95,
        ...modelConfig,
      };
      this.model = new DemandForecastModel(config);
    }

    // Fetch historical mean for context
    const historicalMean = await this.getHistoricalMean({
      orgId,
      department,
      specialty,
      role,
    });

    const forecasts: Array<{
      forecastDate: Date;
      horizonDays: number;
      predictedDemand: number;
      lowerBound?: number;
      upperBound?: number;
      confidenceLevel?: number;
      modelType: string;
      forecastId?: string;
    }> = [];

    // Extract features once for the start date
    const baseFeatures = await this.featureExtractor.extractFeatures(startDate, {
      orgId,
      department,
      specialty,
      role,
    });

    // Generate forecasts for each horizon
    for (const horizon of horizonDays) {
      const forecastDate = new Date(startDate);
      forecastDate.setDate(forecastDate.getDate() + horizon);

      // Extract features for forecast date (may differ slightly from base)
      const features = await this.featureExtractor.extractFeatures(forecastDate, {
        orgId,
        department,
        specialty,
        role,
      });

      // Generate prediction
      const result = this.model.predict(features, historicalMean);

      // Save to database
      const forecastRecord = await this.saveForecast({
        orgId,
        department,
        specialty,
        role,
        forecastDate,
        horizonDays: horizon,
        result,
        features,
      });

      forecasts.push({
        forecastDate,
        horizonDays: horizon,
        predictedDemand: result.predictedValue,
        lowerBound: result.lowerBound,
        upperBound: result.upperBound,
        confidenceLevel: result.confidenceLevel,
        modelType: result.modelType,
        forecastId: forecastRecord.id,
      });
    }

    return {
      forecasts,
      metadata: {
        modelType: this.model['model']['modelType'] || 'ml',
        modelVersion: baseFeatures ? undefined : undefined,
        featuresUsed: {
          hasHistory: historicalMean > 0,
          featureCount: Object.keys(baseFeatures).length,
        },
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Get historical mean for context
   */
  private async getHistoricalMean(options: {
    orgId?: string;
    department?: string;
    specialty?: string;
    role?: string;
  }): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Last 90 days

    const where: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (options.orgId) where.orgId = options.orgId;
    if (options.department) where.department = options.department;
    if (options.specialty) where.specialty = options.specialty;
    if (options.role) where.role = options.role;

    const records = await this.prisma.demandTimeSeries.findMany({
      where,
      select: {
        shiftCount: true,
        volume: true,
      },
    });

    if (records.length === 0) return 0;

    const values = records.map(r => r.shiftCount || r.volume || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Save forecast to database
   */
  private async saveForecast(options: {
    orgId?: string;
    department?: string;
    specialty?: string;
    role?: string;
    forecastDate: Date;
    horizonDays: number;
    result: ForecastResult;
    features: DemandFeatures;
  }): Promise<{ id: string }> {
    const forecast = await this.prisma.demandForecast.create({
      data: {
        orgId: options.orgId || null,
        department: options.department || null,
        specialty: options.specialty || null,
        role: options.role || null,
        forecastDate: options.forecastDate,
        horizonDays: options.horizonDays,
        predictedDemand: options.result.predictedValue,
        lowerBound: options.result.lowerBound || null,
        upperBound: options.result.upperBound || null,
        confidenceLevel: options.result.confidenceLevel || null,
        modelType: options.result.modelType,
        modelVersion: options.result.modelVersion || null,
        features: options.features as any,
        metadata: options.result.metadata || null,
      },
    });

    return { id: forecast.id };
  }

  /**
   * Batch forecast for multiple contexts
   */
  async batchForecast(requests: ForecastRequest[]): Promise<ForecastResponse[]> {
    const results = await Promise.all(
      requests.map(req => this.forecast(req))
    );

    return results;
  }

  /**
   * Get recent forecasts from database
   */
  async getRecentForecasts(options: {
    orgId?: string;
    department?: string;
    specialty?: string;
    role?: string;
    horizonDays?: number;
    limit?: number;
  }): Promise<any[]> {
    const where: any = {};

    if (options.orgId) where.orgId = options.orgId;
    if (options.department) where.department = options.department;
    if (options.specialty) where.specialty = options.specialty;
    if (options.role) where.role = options.role;
    if (options.horizonDays) where.horizonDays = options.horizonDays;

    const forecasts = await this.prisma.demandForecast.findMany({
      where,
      orderBy: { forecastDate: 'desc' },
      take: options.limit || 100,
    });

    return forecasts;
  }
}

