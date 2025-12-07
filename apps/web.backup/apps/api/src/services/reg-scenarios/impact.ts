import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ScenarioImpact {
  clinicians: {
    affected: number;
    riskIncrease: number;
  };
  employers: {
    affected: number;
    complianceLoad: number;
  };
  verification: {
    loadIncrease: number;
    estimatedDelay: number;
  };
  compliance: {
    riskLevel: 'low' | 'medium' | 'high';
    gaps: string[];
  };
}

/**
 * Simulate scenario impact
 */
export async function simulateScenarioImpact(
  scenarioId: string,
): Promise<ScenarioImpact> {
  const scenario = await prisma.regScenario.findUnique({
    where: { id: scenarioId },
  });

  if (!scenario) {
    throw new Error('Scenario not found');
  }

  const rules = scenario.rules as Record<string, unknown>;
  const ruleChanges = (rules.changes as Array<{ type: string; severity: string }>) || [];

  // Simulate impact (simplified)
  const affectedClinicians = Math.floor(Math.random() * 1000) + 100;
  const riskIncrease = ruleChanges.length * 0.1;
  const affectedEmployers = Math.floor(affectedClinicians / 10);
  const complianceLoad = ruleChanges.length * 0.15;
  const loadIncrease = affectedClinicians * 0.05;
  const estimatedDelay = loadIncrease * 2; // hours

  const gaps: string[] = [];
  if (ruleChanges.some(c => c.type === 'new_requirement')) {
    gaps.push('New requirements may require system updates');
  }
  if (ruleChanges.some(c => c.severity === 'high')) {
    gaps.push('High-severity changes may impact existing workflows');
  }

  const riskLevel = riskIncrease > 0.3 ? 'high' : riskIncrease > 0.15 ? 'medium' : 'low';

  return {
    clinicians: {
      affected: affectedClinicians,
      riskIncrease,
    },
    employers: {
      affected: affectedEmployers,
      complianceLoad,
    },
    verification: {
      loadIncrease,
      estimatedDelay,
    },
    compliance: {
      riskLevel,
      gaps,
    },
  };
}

