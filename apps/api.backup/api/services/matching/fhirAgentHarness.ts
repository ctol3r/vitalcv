/**
 * S72-STRETCH-D-008: Partial FHIR-AgentBench harness for matching tasks
 *
 * Loads synthetic FHIR bundles; defines scenarios (e.g., match ICU physician);
 * calculates precision/recall for top-k; outputs JSON report
 */

import { PrismaClient } from '@prisma/client';
import { score, extractFeatureScores } from './score';
import { embedProfile } from './embeddings';
import { cosineSimilarity } from './score';

const prisma = new PrismaClient();

/**
 * FHIR Bundle structure (simplified)
 */
export interface FHIRBundle {
  resourceType: 'Bundle';
  entry: Array<{
    resource: {
      resourceType: string;
      id?: string;
      [key: string]: any;
    };
  }>;
}

/**
 * Matching scenario definition
 */
export interface MatchingScenario {
  id: string;
  name: string;
  description: string;
  jobRequirements: {
    specialty: string;
    location?: { lat: number; lng: number };
    minExperienceYears?: number;
  };
  expectedCandidates: string[]; // Array of clinician IDs that should match
  topK: number; // Evaluate precision@k
}

/**
 * Evaluation result for a scenario
 */
export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  precisionAtK: number;
  recallAtK: number;
  topKCandidates: Array<{
    clinicianId: string;
    score: number;
    isExpected: boolean;
  }>;
  metrics: {
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
  };
}

/**
 * Load synthetic FHIR bundle from file or generate
 */
export async function loadFHIRBundle(path?: string): Promise<FHIRBundle> {
  // In production, would load from file or API
  // For now, return a mock bundle
  return {
    resourceType: 'Bundle',
    entry: [
      {
        resource: {
          resourceType: 'Practitioner',
          id: 'practitioner-1',
          name: [{ given: ['John'], family: 'Doe' }],
          qualification: [
            {
              code: {
                coding: [{ code: '207Q00000X', display: 'Family Medicine' }],
              },
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Practitioner',
          id: 'practitioner-2',
          name: [{ given: ['Jane'], family: 'Smith' }],
          qualification: [
            {
              code: {
                coding: [{ code: '207RC0000X', display: 'Cardiology' }],
              },
            },
          ],
        },
      },
    ],
  };
}

/**
 * Extract clinicians from FHIR bundle
 */
export function extractCliniciansFromBundle(
  bundle: FHIRBundle
): Array<{
  id: string;
  name: string;
  specialty: string;
  [key: string]: any;
}> {
  const clinicians = [];

  for (const entry of bundle.entry) {
    if (entry.resource.resourceType === 'Practitioner') {
      const practitioner = entry.resource;
      const name =
        practitioner.name?.[0]?.given?.join(' ') +
        ' ' +
        practitioner.name?.[0]?.family;
      const specialty =
        practitioner.qualification?.[0]?.code?.coding?.[0]?.code || '';

      clinicians.push({
        id: practitioner.id || '',
        name: name || 'Unknown',
        specialty,
        ...practitioner,
      });
    }
  }

  return clinicians;
}

/**
 * Run matching scenario
 */
export async function runScenario(
  scenario: MatchingScenario,
  clinicians: Array<{
    id: string;
    specialty: string;
    [key: string]: any;
  }>
): Promise<ScenarioResult> {
  // Generate job embedding
  const jobVec = await embedProfile(
    {
      specialty: scenario.jobRequirements.specialty,
      requirements: [],
    },
    `job-${scenario.id}`,
    'Job'
  );

  // Score all clinicians
  const candidates = [];

  for (const clinician of clinicians) {
    // Generate clinician embedding
    const clinVec = await embedProfile(
      {
        specialty: clinician.specialty,
      },
      clinician.id,
      'Clinician'
    );

    // Extract features
    const features = extractFeatureScores(
      {
        specialty: clinician.specialty,
        location: scenario.jobRequirements.location
          ? { lat: 0, lng: 0 } // Simplified
          : undefined,
        experienceYears: 5, // Simplified
        rating: 0.8,
        burnoutRisk: 0.3,
      },
      scenario.jobRequirements
    );

    // Compute score
    const matchScore = score(clinVec, jobVec, features);

    const isExpected = scenario.expectedCandidates.includes(clinician.id);

    candidates.push({
      clinicianId: clinician.id,
      score: matchScore,
      isExpected,
    });
  }

  // Sort by score
  candidates.sort((a, b) => b.score - a.score);

  // Get top K
  const topK = candidates.slice(0, scenario.topK);

  // Calculate metrics
  const truePositives = topK.filter((c) => c.isExpected).length;
  const falsePositives = topK.filter((c) => !c.isExpected).length;
  const falseNegatives =
    scenario.expectedCandidates.length -
    topK.filter((c) => c.isExpected).length;

  const precisionAtK = topK.length > 0 ? truePositives / topK.length : 0;
  const recallAtK =
    scenario.expectedCandidates.length > 0
      ? truePositives / scenario.expectedCandidates.length
      : 0;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    precisionAtK,
    recallAtK,
    topKCandidates: topK,
    metrics: {
      truePositives,
      falsePositives,
      falseNegatives,
    },
  };
}

/**
 * Run full benchmark suite
 */
export async function runBenchmark(
  scenarios: MatchingScenario[],
  bundlePath?: string
): Promise<{
  results: ScenarioResult[];
  summary: {
    averagePrecisionAtK: number;
    averageRecallAtK: number;
    totalScenarios: number;
  };
}> {
  // Load FHIR bundle
  const bundle = await loadFHIRBundle(bundlePath);
  const clinicians = extractCliniciansFromBundle(bundle);

  // Run all scenarios
  const results = await Promise.all(
    scenarios.map((scenario) => runScenario(scenario, clinicians))
  );

  // Calculate summary
  const averagePrecisionAtK =
    results.reduce((sum, r) => sum + r.precisionAtK, 0) / results.length;
  const averageRecallAtK =
    results.reduce((sum, r) => sum + r.recallAtK, 0) / results.length;

  return {
    results,
    summary: {
      averagePrecisionAtK,
      averageRecallAtK,
      totalScenarios: results.length,
    },
  };
}

/**
 * Generate JSON report
 */
export function generateReport(
  benchmarkResults: Awaited<ReturnType<typeof runBenchmark>>
): string {
  return JSON.stringify(benchmarkResults, null, 2);
}

