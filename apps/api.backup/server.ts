import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// GET /api/documents/:id/history
app.get('/api/documents/:id/history', (req: Request, res: Response) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  const mockResponse = {
    docId: id,
    clinicianId: `cln_${id.slice(0, 8)}`,
    lastUpdated: now,
    chain: {
      valid: true,
      issues: [],
      digest: `0x${id.slice(0, 16)}`,
      chainLength: 3,
      hashSeq: [
        `0x${id.slice(0, 16)}1`,
        `0x${id.slice(0, 16)}2`,
        `0x${id.slice(0, 16)}3`,
      ],
      persisted: true,
      entries: [
        {
          sequence: 1,
          hash: `0x${id.slice(0, 16)}1`,
          event: 'ingested',
          actor: `cln_${id.slice(0, 6)}`,
          observedAt: new Date(Date.now() - 135000).toISOString(),
          digest: `0x${id.slice(0, 16)}4`,
        },
        {
          sequence: 2,
          hash: `0x${id.slice(0, 16)}2`,
          event: 'reconciled',
          actor: 'system',
          observedAt: new Date(Date.now() - 90000).toISOString(),
          digest: `0x${id.slice(0, 16)}5`,
        },
        {
          sequence: 3,
          hash: `0x${id.slice(0, 16)}3`,
          event: 'verified',
          actor: 'system',
          observedAt: new Date(Date.now() - 45000).toISOString(),
          digest: `0x${id.slice(0, 16)}6`,
        },
      ],
    },
    provenance: {
      verdict: 'verified' as const,
      confidence: 0.85,
      captureDevice: 'Secure Capture Device v2.1',
      captureTimestamp: new Date(Date.now() - 180000).toISOString(),
      gps: {
        lat: 37.7749,
        lng: -122.4194,
        accuracyMeters: 15,
      },
      warnings: [],
      anomalies: [],
    },
    fingerprint: {
      duplicateScore: 0.12,
      collisions: [
        {
          fingerprintId: `fp_${id.slice(0, 8)}`,
          clinicianId: `cln_${id.slice(0, 8)}`,
          similarity: 0.78,
          reason: ['name_match', 'birthdate_match'],
          matchedFields: ['name', 'birthDate'],
          recordedAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      sampleSize: 1250,
    },
    liveness: {
      sessionId: `session_${id}`,
      clinicianId: `cln_${id.slice(0, 8)}`,
      score: 0.92,
      verdict: 'pass' as const,
      spoofLikelihood: 0.08,
      signals: {
        blink: 0.89,
        motion: 0.91,
        depth: 0.87,
        challenge: 0.94,
        illumination: 0.88,
      },
      frameCount: 45,
      evaluatedAt: new Date(Date.now() - 120000).toISOString(),
      challengeBreakdown: [
        {
          prompt: 'Turn head left',
          success: true,
          latencyMs: 234,
        },
        {
          prompt: 'Smile',
          success: true,
          latencyMs: 189,
        },
        {
          prompt: 'Blink twice',
          success: true,
          latencyMs: 156,
        },
      ],
      riskFactors: [],
      entropy: 0.76,
    },
    watermark: {
      digest: `wm_${id.slice(0, 16)}`,
      mutatedBytes: 0,
      traceVector: [0.1, 0.2, 0.3, 0.4, 0.5],
      insertedAt: new Date(Date.now() - 150000).toISOString(),
      bitCount: 128,
    },
    signatureChain: {
      docId: id,
      rootHash: `root_${id.slice(0, 16)}`,
      chainLength: 2,
      generatedAt: new Date(Date.now() - 100000).toISOString(),
      layers: [
        {
          signerId: `signer_${id.slice(0, 8)}`,
          algorithm: 'ECDSA',
          signature: `sig_${id.slice(0, 32)}`,
          timestamp: new Date(Date.now() - 100000).toISOString(),
          sequence: 1,
          layerHash: `layer1_${id.slice(0, 16)}`,
          previousLayerHash: null,
        },
        {
          signerId: 'system',
          algorithm: 'ECDSA',
          signature: `sig2_${id.slice(0, 32)}`,
          timestamp: new Date(Date.now() - 50000).toISOString(),
          sequence: 2,
          layerHash: `layer2_${id.slice(0, 16)}`,
          previousLayerHash: `layer1_${id.slice(0, 16)}`,
        },
      ],
    },
    botDefense: {
      riskScore: 0.15,
      flags: [],
      navigation: {
        samples: 120,
        averageSpeed: 2.3,
        maxSpeed: 4.1,
        impossible: false,
      },
      fingerprint: {
        deviceSig: `device_${id.slice(0, 16)}`,
        uniqueIpCount: 1,
        identicalAcrossIps: true,
        recentIps: ['192.168.1.100'],
      },
      runtime: {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1920x1080',
        timezone: 'America/Los_Angeles',
        language: 'en-US',
      },
      network: {
        ipChain: ['192.168.1.100'],
        residentialProxyHop: false,
        torSuspected: false,
        vpnSuspected: false,
      },
      anchor: {
        anchorId: `anchor_${id}`,
        txHash: `tx_${id.slice(0, 32)}`,
        blockHash: `block_${id.slice(0, 32)}`,
        blockNumber: 12345678,
        network: 'mainnet',
        timestamp: new Date(Date.now() - 80000).toISOString(),
      },
    },
    walletClones: {
      totalDevices: 1,
      findings: [
        {
          keyHash: `key_${id.slice(0, 16)}`,
          collisions: 0,
          accounts: [
            {
              clinicianId: `cln_${id.slice(0, 8)}`,
              deviceId: `device_${id.slice(0, 8)}`,
              lastUsedAt: now,
            },
          ],
        },
      ],
    },
    lifecycle: {
      phase: 'active',
      displayStatus: 'active' as const,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      transitions: [
        {
          id: `trans_${id.slice(0, 8)}1`,
          phase: 'issued',
          timestamp: new Date(Date.now() - 200000).toISOString(),
          metadata: {
            issuer: 'system',
            reason: 'initial_issue',
          },
        },
        {
          id: `trans_${id.slice(0, 8)}2`,
          phase: 'active',
          timestamp: new Date(Date.now() - 100000).toISOString(),
          metadata: {
            verified: true,
          },
        },
      ],
    },
  };

  res.json(mockResponse);
});

// GET /api/identity/fusion/:id
app.get('/api/identity/fusion/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  const mockResponse = {
    clinicianId: id,
    snapshotId: `snapshot_${id.slice(0, 8)}`,
    generatedAt: now,
    confidence: 0.92,
    payload: {
      clinicianId: id,
      generatedAt: now,
      primaryName: 'Dr. Jane Smith',
      normalizedName: 'JANE SMITH',
      aliases: ['Jane A. Smith', 'J. Smith'],
      birthDate: '1985-06-15',
      graduationYear: 2010,
      specialties: ['Internal Medicine', 'Cardiology'],
      sourceBreakdown: {
        nppes: 1,
        state_board: 2,
        npdb: 1,
      },
      reliability: {
        overall: 0.92,
        coverage: 0.88,
        agreement: 0.95,
        recency: 0.90,
        validationDensity: 0.85,
      },
      transparency: [
        {
          field: 'name',
          winningSource: 'nppes',
          supportingSources: ['state_board', 'npdb'],
          rationale: ['Consistent across all sources', 'Verified in NPPES registry'],
          confidence: 0.98,
        },
        {
          field: 'birthDate',
          winningSource: 'state_board',
          supportingSources: ['npdb'],
          rationale: ['Matches state board records', 'Cross-validated with NPDB'],
          confidence: 0.95,
        },
        {
          field: 'specialties',
          winningSource: 'nppes',
          supportingSources: ['state_board'],
          rationale: ['Primary source from NPPES', 'Confirmed by state board'],
          confidence: 0.90,
        },
      ],
    },
    anchor: {
      id: `anchor_${id}`,
      txHash: `tx_${id.slice(0, 32)}`,
      merkleRoot: `merkle_${id.slice(0, 32)}`,
      network: 'mainnet',
      payload: {
        timestamp: now,
      },
    },
    events: [
      {
        id: `event_${id.slice(0, 8)}1`,
        snapshotId: `snapshot_${id.slice(0, 8)}`,
        field: 'name',
        eventType: 'updated',
        changeHash: `hash_${id.slice(0, 16)}1`,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        oldValue: 'Dr. J. Smith',
        newValue: 'Dr. Jane Smith',
      },
      {
        id: `event_${id.slice(0, 8)}2`,
        snapshotId: `snapshot_${id.slice(0, 8)}`,
        field: 'specialties',
        eventType: 'added',
        changeHash: `hash_${id.slice(0, 16)}2`,
        createdAt: new Date(Date.now() - 43200000).toISOString(),
        oldValue: ['Internal Medicine'],
        newValue: ['Internal Medicine', 'Cardiology'],
      },
    ],
  };

  res.json(mockResponse);
});

// GET /api/region/health
app.get('/api/region/health', (req: Request, res: Response) => {
  const now = new Date().toISOString();

  const mockResponse = {
    timestamp: now,
    clientRegion: 'us-west-2',
    nearestRegion: 'us-west-2',
    nearestRegionLabel: 'US-West Region',
    activeRegion: 'us-west-2',
    replication: {
      mode: 'multi-master',
      lagMs: {
        'us-east-1': 45,
        'us-west-2': 12,
        'eu-central-1': 128,
      },
      conflictRate: {
        'us-east-1': 0.001,
        'us-west-2': 0.0005,
        'eu-central-1': 0.002,
      },
    },
    clusters: [
      {
        region: 'us-west-2',
        displayName: 'US-West Region',
        status: 'healthy',
        latencyMs: 12,
        replicationLagMs: 0,
        conflictRate: 0.0005,
        updatedAt: now,
      },
      {
        region: 'us-east-1',
        displayName: 'US-East Region',
        status: 'healthy',
        latencyMs: 45,
        replicationLagMs: 45,
        conflictRate: 0.001,
        updatedAt: new Date(Date.now() - 5000).toISOString(),
      },
      {
        region: 'eu-central-1',
        displayName: 'EU-Central Region',
        status: 'healthy',
        latencyMs: 128,
        replicationLagMs: 128,
        conflictRate: 0.002,
        updatedAt: new Date(Date.now() - 10000).toISOString(),
      },
    ],
  };

  res.json(mockResponse);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
