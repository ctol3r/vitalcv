/**
 * demoEngine.ts — Wave 60: Demo Script Engine
 *
 * Orchestrates a guided demonstration of VitalCV's trust infrastructure.
 * Each step returns structured data for the frontend to animate.
 */

// ── Types ─────────────────────────────────────────────────────────────────

interface DemoStep {
  id: string;
  label: string;
  description: string;
  durationMs: number;
  data: Record<string, unknown>;
}

interface DemoScenario {
  npi: string;
  steps: DemoStep[];
  totalDurationMs: number;
}

interface VerificationResult {
  credentialId: string;
  source: string;
  status: 'verified' | 'pending' | 'failed';
  confidence: number;
  verifiedAt: string;
}

interface DecisionResult {
  capsuleId: string;
  type: string;
  status: 'VALID' | 'AT_RISK';
  credentialCount: number;
  artifactHash: string;
}

interface RevocationResult {
  revokedCredentialId: string;
  affectedNodes: number;
  cascadeDepth: number;
  impactedDecisions: number;
  estimatedImpact: number;
}

// ── Demo Data ─────────────────────────────────────────────────────────────

const DEMO_NPI = '9999999999';

const DEMO_CREDENTIALS = [
  { id: 'cred-medical-license', source: 'State Medical Board', confidence: 0.98 },
  { id: 'cred-dea-registration', source: 'DEA', confidence: 0.96 },
  { id: 'cred-board-cert', source: 'ABMS Board Certification', confidence: 0.99 },
  { id: 'cred-hospital-priv', source: 'Memorial Hospital Privileges', confidence: 0.94 },
];

const DEMO_ISSUERS = [
  { id: 'issuer-state-board', label: 'State Medical Board' },
  { id: 'issuer-dea', label: 'DEA' },
  { id: 'issuer-abms', label: 'ABMS' },
];

const DEMO_EMPLOYERS = [
  { id: 'employer-memorial', label: 'Memorial Hospital' },
  { id: 'employer-unity', label: 'Unity Health System' },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function sha256Stub(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0') + 'a1b2c3d4e5f6';
}

// ── Step Functions ────────────────────────────────────────────────────────

export function simulateVerification(npi: string): VerificationResult[] {
  return DEMO_CREDENTIALS.map((cred) => ({
    credentialId: cred.id,
    source: cred.source,
    status: 'verified' as const,
    confidence: cred.confidence,
    verifiedAt: new Date().toISOString(),
  }));
}

export function simulateDecision(npi: string, credentials: VerificationResult[]): DecisionResult {
  return {
    capsuleId: `demo-decision-${Date.now()}`,
    type: 'HIRING',
    status: 'VALID',
    credentialCount: credentials.length,
    artifactHash: sha256Stub(`${npi}-${credentials.length}-${Date.now()}`),
  };
}

export function simulateRevocation(credentialId: string): RevocationResult {
  return {
    revokedCredentialId: credentialId,
    affectedNodes: 7,
    cascadeDepth: 3,
    impactedDecisions: 2,
    estimatedImpact: 35000,
  };
}

// ── Full Scenario ─────────────────────────────────────────────────────────

export function runDemoScenario(npi?: string): DemoScenario {
  const targetNpi = npi ?? DEMO_NPI;
  const verifications = simulateVerification(targetNpi);
  const decision = simulateDecision(targetNpi, verifications);
  const revocation = simulateRevocation(verifications[0].credentialId);

  const steps: DemoStep[] = [
    {
      id: 'load-trust-state',
      label: 'Load Trust State',
      description: `Loading credential trust state for NPI ${targetNpi}`,
      durationMs: 3000,
      data: {
        npi: targetNpi,
        credentials: DEMO_CREDENTIALS,
        crsScore: 87,
        crsBand: 'GREEN',
      },
    },
    {
      id: 'build-knowledge-graph',
      label: 'Build Knowledge Graph',
      description: 'Constructing authority-bound knowledge graph',
      durationMs: 4000,
      data: {
        nodes: [
          { id: `clinician-${targetNpi}`, label: `NPI: ${targetNpi}`, group: 'clinician' },
          ...DEMO_CREDENTIALS.map((c) => ({ id: c.id, label: c.source, group: 'credential' })),
          ...DEMO_ISSUERS.map((i) => ({ id: i.id, label: i.label, group: 'issuer' })),
          ...DEMO_EMPLOYERS.map((e) => ({ id: e.id, label: e.label, group: 'employer' })),
        ],
        edges: [
          ...DEMO_CREDENTIALS.map((c) => ({ source: `clinician-${targetNpi}`, target: c.id, label: 'HOLDS' })),
          { source: 'cred-medical-license', target: 'issuer-state-board', label: 'ISSUED_BY' },
          { source: 'cred-dea-registration', target: 'issuer-dea', label: 'ISSUED_BY' },
          { source: 'cred-board-cert', target: 'issuer-abms', label: 'ISSUED_BY' },
          { source: 'cred-hospital-priv', target: 'employer-memorial', label: 'PRIVILEGED_AT' },
          { source: 'employer-memorial', target: 'employer-unity', label: 'NETWORK_PEER' },
        ],
      },
    },
    {
      id: 'verify-credentials',
      label: 'Primary Source Verification',
      description: `Verifying ${verifications.length} credentials against primary sources`,
      durationMs: 5000,
      data: { verifications },
    },
    {
      id: 'generate-decision',
      label: 'Generate Decision Capsule',
      description: 'Computing hiring decision with CRS evaluation',
      durationMs: 3000,
      data: { decision },
    },
    {
      id: 'simulate-revocation',
      label: 'Revocation Simulation',
      description: 'Simulating Medical License revocation cascade',
      durationMs: 5000,
      data: { revocation },
    },
    {
      id: 'verifier-approve',
      label: 'Instant Verification',
      description: 'Verifier approves credential bundle in real-time',
      durationMs: 3000,
      data: {
        approved: true,
        bundleHash: decision.artifactHash,
        approvedAt: new Date().toISOString(),
      },
    },
  ];

  return {
    npi: targetNpi,
    steps,
    totalDurationMs: steps.reduce((sum, s) => sum + s.durationMs, 0),
  };
}
