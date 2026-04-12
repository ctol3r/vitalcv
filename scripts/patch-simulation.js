const fs = require('fs');
const path = require('path');

const liveEnginePath = path.join(__dirname, '../apps/api/backend/src/services/simulation/liveSimulationEngine.ts');
let engineContent = fs.readFileSync(liveEnginePath, 'utf8');

// Update SimulationResult type
engineContent = engineContent.replace(
  /estimatedImpact: \{[\s\S]*?\};/,
  `estimatedImpact: {
    hospitalsAffected: number;
    privilegesImpacted: number;
    revenueImpact?: {
      dailyRevenue: number;
      daysUntilReplacement: number;
      totalAtRisk: number;
    };
    staffingGap?: {
      uncoveredShifts: number;
      affectedLocations: string[];
    };
  };
  simulationId?: string;`
);

// Add specialty defaults
const helpers = `
// ── Revenue and Staffing Models ──────────────────────────────────────────────

const SPECIALTY_MODELS: Record<string, { dailyRevenue: number; daysToReplace: number; shiftsPerWeek: number }> = {
  CRNA: { dailyRevenue: 5000, daysToReplace: 120, shiftsPerWeek: 4 },
  ANESTHESIOLOGIST: { dailyRevenue: 8000, daysToReplace: 150, shiftsPerWeek: 4 },
  RN: { dailyRevenue: 1500, daysToReplace: 60, shiftsPerWeek: 3.5 },
  NP: { dailyRevenue: 3000, daysToReplace: 90, shiftsPerWeek: 4 },
  DEFAULT: { dailyRevenue: 2500, daysToReplace: 90, shiftsPerWeek: 4 },
};

function calculateImpactModels(specialty?: string, organizations?: string[]) {
  const model = SPECIALTY_MODELS[specialty?.toUpperCase() || ''] || SPECIALTY_MODELS.DEFAULT;
  const totalAtRisk = model.dailyRevenue * model.daysToReplace;
  const uncoveredShifts = Math.floor(model.daysToReplace * (model.shiftsPerWeek / 7));

  return {
    revenueImpact: {
      dailyRevenue: model.dailyRevenue,
      daysUntilReplacement: model.daysToReplace,
      totalAtRisk,
    },
    staffingGap: {
      uncoveredShifts,
      affectedLocations: organizations || [],
    }
  };
}
`;

// Insert helpers before simulateCredentialRevocation
engineContent = engineContent.replace('// ── simulateCredentialRevocation ──────────────────────────────────────────────', helpers + '\n// ── simulateCredentialRevocation ──────────────────────────────────────────────');

// Update simulateCredentialRevocation
engineContent = engineContent.replace(
  /estimatedImpact: \{[\s\S]*?privilegesImpacted: privilegingCapsules\.length,\n\s*\}/,
  `estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: privilegingCapsules.length,
      ...calculateImpactModels('DEFAULT', affectedOrgs),
    },
    simulationId: 'sim_' + Date.now() + Math.random().toString(36).substring(2, 9)`
);

// Update simulateLicenseExpiration
engineContent = engineContent.replace(
  /estimatedImpact: \{[\s\S]*?privilegesImpacted: invalidatedCapsules\.length,\n\s*\}/,
  `estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: invalidatedCapsules.length,
      ...calculateImpactModels('DEFAULT', affectedOrgs),
    },
    simulationId: 'sim_' + Date.now() + Math.random().toString(36).substring(2, 9)`
);

fs.writeFileSync(liveEnginePath, engineContent, 'utf8');

const routesPath = path.join(__dirname, '../apps/api/backend/src/routes/simulation.ts');
let routesContent = fs.readFileSync(routesPath, 'utf8');

const getRoute = `
  // ── Live: get simulation results ─────────────────────────────────────────
  app.get('/api/simulation/:id/results', async (req: Request, res: Response) => {
    const { id } = req.params;
    // In a real system, we'd fetch this from the database or Redis using the simulation ID.
    // For now, we return a synthesized mocked result based on the ID.
    try {
      res.json({
        simulationId: id,
        status: 'COMPLETE',
        result: {
          estimatedImpact: {
            hospitalsAffected: 1,
            privilegesImpacted: 1,
            revenueImpact: {
              dailyRevenue: 2500,
              daysUntilReplacement: 90,
              totalAtRisk: 225000
            },
            staffingGap: {
              uncoveredShifts: 51,
              affectedLocations: ['Mocked Location']
            }
          }
        }
      });
    } catch (err) {
      log('error', 'simulation_route: fetch_results_failed', { id, error: String(err) });
      res.status(500).json({ error: 'Failed to fetch simulation results' });
    }
  });
`;

routesContent = routesContent.replace('export function registerSimulationRoutes(app: Express): void {', 'export function registerSimulationRoutes(app: Express): void {\n' + getRoute);

fs.writeFileSync(routesPath, routesContent, 'utf8');
console.log('Patched engine and routes');
