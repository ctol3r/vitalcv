/**
 * Tests for DemandForecastModel
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DemandForecastModel } from '../model/demandModel.js';
import { DemandFeatures } from '../extractors/demandFeatures.js';

describe('DemandForecastModel', () => {
  const mockFeatures: DemandFeatures = {
    dayOfWeek: 1,
    dayOfMonth: 15,
    month: 1,
    quarter: 1,
    isWeekend: false,
    isHoliday: false,
    daysSinceHoliday: null,
    seasonalityDaily: 0.5,
    seasonalityWeekly: 0.3,
    seasonalityMonthly: 0.2,
    lag1Day: 10,
    lag7Day: 12,
    lag30Day: 11,
    lag90Day: 10,
    rollingMean7Day: 11,
    rollingMean30Day: 11,
    rollingStd7Day: 2,
    rollingStd30Day: 2,
    trend7Day: 0.1,
    trend30Day: 0.05,
    surgeIndicator: 0,
    backlogIndicator: null,
    department: 'Emergency',
    specialty: '207R00000X',
    role: 'RN',
  };

  it('should create deterministic model', () => {
    const model = DemandForecastModel.createDeterministic(100);
    const result = model.predict(mockFeatures);

    expect(result.predictedValue).toBe(100);
    expect(result.modelType).toBe('deterministic');
    expect(result.confidenceLevel).toBe(1.0);
  });

  it('should predict with ARIMA model', () => {
    const model = DemandForecastModel.create('arima');
    const result = model.predict(mockFeatures, 10);

    expect(result.predictedValue).toBeGreaterThan(0);
    expect(result.modelType).toBe('arima');
    expect(result.lowerBound).toBeDefined();
    expect(result.upperBound).toBeDefined();
  });

  it('should predict with Prophet model', () => {
    const model = DemandForecastModel.create('prophet');
    const result = model.predict(mockFeatures, 10);

    expect(result.predictedValue).toBeGreaterThan(0);
    expect(result.modelType).toBe('prophet');
    expect(result.lowerBound).toBeDefined();
    expect(result.upperBound).toBeDefined();
  });

  it('should predict with ML model', () => {
    const model = DemandForecastModel.create('ml');
    const result = model.predict(mockFeatures, 10);

    expect(result.predictedValue).toBeGreaterThan(0);
    expect(result.modelType).toBe('ml');
    expect(result.lowerBound).toBeDefined();
    expect(result.upperBound).toBeDefined();
  });

  it('should handle holiday effects in Prophet model', () => {
    const holidayFeatures: DemandFeatures = {
      ...mockFeatures,
      isHoliday: true,
    };

    const model = DemandForecastModel.create('prophet');
    const holidayResult = model.predict(holidayFeatures, 10);
    const normalResult = model.predict(mockFeatures, 10);

    // Holiday effect should reduce demand
    expect(holidayResult.predictedValue).toBeLessThan(normalResult.predictedValue);
  });

  it('should handle surge indicators', () => {
    const surgeFeatures: DemandFeatures = {
      ...mockFeatures,
      surgeIndicator: 1.0,
    };

    const model = DemandForecastModel.create('prophet');
    const surgeResult = model.predict(surgeFeatures, 10);
    const normalResult = model.predict(mockFeatures, 10);

    // Surge should increase demand
    expect(surgeResult.predictedValue).toBeGreaterThan(normalResult.predictedValue);
  });

  it('should never predict negative values', () => {
    const model = DemandForecastModel.create('ml');
    const featuresWithNegatives: DemandFeatures = {
      ...mockFeatures,
      lag1Day: -10,
      lag7Day: -10,
      rollingMean7Day: -10,
    };

    const result = model.predict(featuresWithNegatives, 0);

    expect(result.predictedValue).toBeGreaterThanOrEqual(0);
    expect(result.lowerBound).toBeGreaterThanOrEqual(0);
  });
});

