import re

with open('apps/api/backend/src/services/simulation/liveSimulationEngine.ts', 'r') as f:
    content = f.read()

# Update SimulationResult type
content = re.sub(
    r'estimatedImpact: \{\n\s*hospitalsAffected: number;\n\s*privilegesImpacted: number;\n\s*\};',
    '''estimatedImpact: {
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
  simulationId?: string;''',
    content
)

helpers = '''
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
'''

content = content.replace('// ── simulateCredentialRevocation ──────────────────────────────────────────────', helpers + '\n// ── simulateCredentialRevocation ──────────────────────────────────────────────')

content = content.replace(
'''    estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: privilegingCapsules.length,
    },
    simulatedAt,''',
'''    estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: privilegingCapsules.length,
      ...calculateImpactModels('DEFAULT', affectedOrgs),
    },
    simulationId: 'sim_' + Date.now() + Math.random().toString(36).substring(2, 9),
    simulatedAt,'''
)

content = content.replace(
'''    estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: invalidatedCapsules.length,
    },
    simulatedAt,''',
'''    estimatedImpact: {
      hospitalsAffected: affectedOrgs.length,
      privilegesImpacted: invalidatedCapsules.length,
      ...calculateImpactModels('DEFAULT', affectedOrgs),
    },
    simulationId: 'sim_' + Date.now() + Math.random().toString(36).substring(2, 9),
    simulatedAt,'''
)

with open('apps/api/backend/src/services/simulation/liveSimulationEngine.ts', 'w') as f:
    f.write(content)

