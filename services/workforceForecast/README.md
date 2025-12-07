# Workforce Forecast Services

## Overview

This service provides demand forecasting for workforce planning, including:
- Historical demand data storage (DemandTimeSeries)
- Feature extraction from historical patterns
- Multiple forecasting models (ARIMA, Prophet, ML, Deterministic)
- Demand forecasting engine with confidence intervals
- Critical shortage detection

## Components

### B206A-WF-001: DemandTimeSeries Model

Database model for storing historical workforce demand data:
- Shift counts
- Acuity levels
- Volumes per role/specialty
- Department and organization context

**Location**: `backend/prisma/schema.prisma`

### B206A-WF-002: DemandFeatureExtractor

Extracts historical features for forecasting:
- Seasonality (daily, weekly, monthly patterns)
- Day-of-week, month, holiday indicators
- Surge patterns
- Department backlog
- Lag features (1-day, 7-day, 30-day, 90-day)
- Rolling statistics (mean, std, trend)

**Location**: `services/workforceForecast/extractors/demandFeatures.ts`

### B206A-WF-003: DemandForecastModel

Forecasting models:
- **ARIMA-like**: Time series decomposition (trend + seasonality)
- **Prophet-like**: Growth + seasonality + holidays + surge effects
- **ML Regressor**: Linear regression with feature weights
- **Deterministic**: Fixed values for testing

**Location**: `services/workforceForecast/model/demandModel.ts`

### B206A-WF-004: DemandForecastEngine

Orchestrates forecasting:
- Generates forecasts for 7, 14, 30, 90 day horizons
- Returns confidence intervals (lower/upper bounds)
- Saves DemandForecast records to database
- Supports batch forecasting

**Location**: `services/workforceForecast/demandEngine.ts`

### B206A-WF-005: CriticalDemandForecastDetector

Detects critical shortages:
- Compares demand forecasts vs supply readiness
- Flags when demand > supply by threshold
- Integrates with WorkforceSupplyGraph
- Generates severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- Supports alert acknowledgment and resolution

**Location**: `services/workforceForecast/detectors/criticalDemandDetector.ts`

## Usage

### Basic Forecast

```typescript
import { DemandForecastEngine } from './services/workforceForecast';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const engine = new DemandForecastEngine(prisma);

const response = await engine.forecast({
  orgId: 'org-123',
  department: 'Emergency',
  specialty: '207R00000X',
  role: 'RN',
  horizonDays: [7, 14, 30, 90],
  modelType: 'ml',
});

console.log(response.forecasts);
```

### Critical Shortage Detection

```typescript
import { CriticalDemandForecastDetector } from './services/workforceForecast';
import { SimpleWorkforceSupplyGraph } from './services/workforceForecast';

const supplyGraph = new SimpleWorkforceSupplyGraph(prisma);
const detector = new CriticalDemandForecastDetector(
  prisma,
  engine,
  supplyGraph
);

const result = await detector.detectCriticalShortages(
  {
    orgId: 'org-123',
    department: 'Emergency',
    role: 'RN',
  },
  {
    threshold: 1.2, // Alert if demand > 120% of supply
    minSeverity: 'HIGH',
  }
);

console.log(result.alerts);
```

### Deterministic Mode (Testing)

```typescript
import { DemandForecastModel } from './services/workforceForecast';

const model = DemandForecastModel.createDeterministic(100);
const result = model.predict(features);

// Always returns 100 with perfect confidence
```

## Database Models

### DemandTimeSeries
Stores historical demand observations:
- orgId, department, specialty, role
- date, shiftCount, acuityLevel, volume
- metadata (backlog, surge patterns)

### DemandForecast
Stores forecast predictions:
- Links to DemandTimeSeries (optional)
- forecastDate, horizonDays
- predictedDemand, lowerBound, upperBound
- confidenceLevel, modelType, modelVersion
- features used for prediction

### CriticalDemandAlert
Stores critical shortage alerts:
- Links to DemandForecast
- demandValue, supplyReadiness, shortageAmount
- threshold, severity
- acknowledged/resolved tracking

## Testing

Run tests:
```bash
npm test -- services/workforceForecast/__tests__/
```

Test files:
- `__tests__/demandFeatures.test.ts` - Feature extraction tests
- `__tests__/demandModel.test.ts` - Model prediction tests

## Migration

Run Prisma migration to create database tables:

```bash
cd backend
npx prisma migrate dev --name add_workforce_forecast_models
npx prisma generate
```

This creates:
- DemandTimeSeries table
- DemandForecast table
- CriticalDemandAlert table

## Future Enhancements

- Integration with actual workforce scheduling systems
- More sophisticated ML models (XGBoost, neural networks)
- Real-time forecast updates
- Forecast accuracy tracking and model retraining
- Integration with EHR systems for patient volume predictions

