'use strict'

export type NciEntityType = 'clinician' | 'issuer' | 'verifier' | 'org' | 'state'

export interface NciGraphNode {
  id: string
  category: NciEntityType
  label: string
  region: string
  trustScore: number
  did?: string
  npi?: string
  summary: {
    proofs: number
    states: string[]
    trustAnchors: number
    lastVerifiedAt: string
  }
}

export type NciGraphEdgeRelationship =
  | 'issues'
  | 'verifies'
  | 'privileges'
  | 'covers'
  | 'anchors'
  | 'enrolls'

export interface NciGraphEdge {
  id: string
  source: string
  target: string
  relationship: NciGraphEdgeRelationship
  strength: number
}

export type NciCredentialCategory =
  | 'license'
  | 'board'
  | 'privilege'
  | 'enrollment'
  | 'compact'

export interface NciCredentialProof {
  category: NciCredentialCategory
  issuer: string
  verifier: string
  status: 'VERIFIED' | 'PENDING' | 'EXPIRED'
  scope: string
  trustScore: number
  reference: string
  effectiveAt: string
  updatedAt: string
  metadata: Record<string, string | number | string[]>
}

export interface NciClinicianProfile {
  did: string
  npi: string
  name: string
  specialty: string
  homeState: string
  trustScore: number
  lastSyncedAt: string
  stats: {
    issuers: number
    verifiers: number
    orgs: number
    states: number
  }
  credentials: NciCredentialProof[]
  connections: {
    issuers: string[]
    verifiers: string[]
    orgs: string[]
    states: string[]
  }
}

export interface NciTrustAnchor {
  id: string
  name: string
  did: string
  roles: Array<'issuer' | 'verifier'>
  jurisdiction: string
  accreditation: string
  attestationCount: number
  trustScore: number
  lastAudit: string
  contact: string
}

export interface NciProofBundle {
  clinicianDid: string
  clinicianNpi: string
  lastRefreshedAt: string
  proofs: Record<NciCredentialCategory, NciCredentialProof>
}

export const NCI_ENTITY_TYPE_ORDER: NciEntityType[] = [
  'clinician',
  'issuer',
  'verifier',
  'org',
  'state',
]

export const NCI_GRAPH_NODES: NciGraphNode[] = [
  {
    id: 'nci-clinician-patel',
    category: 'clinician',
    label: 'Dr. Aanya Patel',
    region: 'San Francisco, CA',
    trustScore: 92,
    did: 'did:web:nci.vitalcv/patel',
    npi: '1888777666',
    summary: {
      proofs: 24,
      states: ['CA', 'WA', 'AZ', 'TX'],
      trustAnchors: 6,
      lastVerifiedAt: '2025-11-12T04:00:00Z',
    },
  },
  {
    id: 'nci-clinician-santos',
    category: 'clinician',
    label: 'Dr. Miguel Santos',
    region: 'New York, NY',
    trustScore: 88,
    did: 'did:web:nci.vitalcv/santos',
    npi: '1777666555',
    summary: {
      proofs: 19,
      states: ['NY', 'MA', 'FL'],
      trustAnchors: 5,
      lastVerifiedAt: '2025-11-11T22:10:00Z',
    },
  },
  {
    id: 'nci-clinician-chen',
    category: 'clinician',
    label: 'Dr. Riley Chen',
    region: 'Seattle, WA',
    trustScore: 90,
    did: 'did:web:nci.vitalcv/chen',
    npi: '1666555444',
    summary: {
      proofs: 21,
      states: ['WA', 'OR', 'CO'],
      trustAnchors: 5,
      lastVerifiedAt: '2025-11-12T01:40:00Z',
    },
  },
  {
    id: 'nci-issuer-cmb',
    category: 'issuer',
    label: 'California Medical Board',
    region: 'Sacramento, CA',
    trustScore: 96,
    summary: {
      proofs: 540,
      states: ['CA'],
      trustAnchors: 8,
      lastVerifiedAt: '2025-11-09T18:00:00Z',
    },
  },
  {
    id: 'nci-issuer-nyprof',
    category: 'issuer',
    label: 'NY Office of Professions',
    region: 'Albany, NY',
    trustScore: 93,
    summary: {
      proofs: 487,
      states: ['NY'],
      trustAnchors: 7,
      lastVerifiedAt: '2025-11-08T17:00:00Z',
    },
  },
  {
    id: 'nci-issuer-abim',
    category: 'issuer',
    label: 'American Board of Internal Medicine',
    region: 'Philadelphia, PA',
    trustScore: 94,
    summary: {
      proofs: 320,
      states: ['National'],
      trustAnchors: 9,
      lastVerifiedAt: '2025-11-10T05:00:00Z',
    },
  },
  {
    id: 'nci-issuer-imlc',
    category: 'issuer',
    label: 'IMLC Compact Registry',
    region: 'Nationwide',
    trustScore: 91,
    summary: {
      proofs: 260,
      states: ['Multi-state'],
      trustAnchors: 6,
      lastVerifiedAt: '2025-11-09T09:00:00Z',
    },
  },
  {
    id: 'nci-verifier-northwind',
    category: 'verifier',
    label: 'Northwind Health Credentialing',
    region: 'Portland, OR',
    trustScore: 90,
    summary: {
      proofs: 210,
      states: ['CA', 'WA', 'OR'],
      trustAnchors: 5,
      lastVerifiedAt: '2025-11-11T12:00:00Z',
    },
  },
  {
    id: 'nci-verifier-tristate',
    category: 'verifier',
    label: 'TriState Telehealth QC',
    region: 'Newark, NJ',
    trustScore: 87,
    summary: {
      proofs: 180,
      states: ['NY', 'NJ', 'PA'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-10T19:30:00Z',
    },
  },
  {
    id: 'nci-verifier-bluesky',
    category: 'verifier',
    label: 'BlueSky Health Plan',
    region: 'Austin, TX',
    trustScore: 85,
    summary: {
      proofs: 150,
      states: ['TX', 'WA', 'FL'],
      trustAnchors: 3,
      lastVerifiedAt: '2025-11-10T15:15:00Z',
    },
  },
  {
    id: 'nci-verifier-evergreen',
    category: 'verifier',
    label: 'Evergreen Care Network',
    region: 'Seattle, WA',
    trustScore: 89,
    summary: {
      proofs: 172,
      states: ['WA', 'OR'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-11T04:45:00Z',
    },
  },
  {
    id: 'nci-org-northwind',
    category: 'org',
    label: 'Northwind Health System',
    region: 'Portland, OR',
    trustScore: 91,
    summary: {
      proofs: 124,
      states: ['WA', 'OR', 'CA'],
      trustAnchors: 5,
      lastVerifiedAt: '2025-11-10T08:30:00Z',
    },
  },
  {
    id: 'nci-org-sequoia',
    category: 'org',
    label: 'Sequoia Regional Care',
    region: 'San Jose, CA',
    trustScore: 88,
    summary: {
      proofs: 88,
      states: ['CA', 'AZ'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-09T23:20:00Z',
    },
  },
  {
    id: 'nci-org-tristate',
    category: 'org',
    label: 'TriState Telehealth',
    region: 'New York, NY',
    trustScore: 86,
    summary: {
      proofs: 96,
      states: ['NY', 'NJ', 'PA'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-10T21:10:00Z',
    },
  },
  {
    id: 'nci-org-bluesky',
    category: 'org',
    label: 'BlueSky Payer Network',
    region: 'Austin, TX',
    trustScore: 84,
    summary: {
      proofs: 75,
      states: ['TX', 'WA', 'FL'],
      trustAnchors: 3,
      lastVerifiedAt: '2025-11-09T16:05:00Z',
    },
  },
  {
    id: 'nci-state-california',
    category: 'state',
    label: 'California',
    region: 'US-West',
    trustScore: 90,
    summary: {
      proofs: 620,
      states: ['CA'],
      trustAnchors: 8,
      lastVerifiedAt: '2025-11-12T05:00:00Z',
    },
  },
  {
    id: 'nci-state-washington',
    category: 'state',
    label: 'Washington',
    region: 'US-Northwest',
    trustScore: 88,
    summary: {
      proofs: 410,
      states: ['WA'],
      trustAnchors: 6,
      lastVerifiedAt: '2025-11-11T18:15:00Z',
    },
  },
  {
    id: 'nci-state-texas',
    category: 'state',
    label: 'Texas',
    region: 'US-South',
    trustScore: 86,
    summary: {
      proofs: 520,
      states: ['TX'],
      trustAnchors: 7,
      lastVerifiedAt: '2025-11-11T15:30:00Z',
    },
  },
  {
    id: 'nci-state-newyork',
    category: 'state',
    label: 'New York',
    region: 'US-Northeast',
    trustScore: 87,
    summary: {
      proofs: 580,
      states: ['NY'],
      trustAnchors: 7,
      lastVerifiedAt: '2025-11-12T03:45:00Z',
    },
  },
  {
    id: 'nci-state-massachusetts',
    category: 'state',
    label: 'Massachusetts',
    region: 'US-Northeast',
    trustScore: 85,
    summary: {
      proofs: 320,
      states: ['MA'],
      trustAnchors: 5,
      lastVerifiedAt: '2025-11-09T20:00:00Z',
    },
  },
  {
    id: 'nci-state-florida',
    category: 'state',
    label: 'Florida',
    region: 'US-Southeast',
    trustScore: 82,
    summary: {
      proofs: 360,
      states: ['FL'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-10T14:20:00Z',
    },
  },
  {
    id: 'nci-state-oregon',
    category: 'state',
    label: 'Oregon',
    region: 'US-Northwest',
    trustScore: 84,
    summary: {
      proofs: 280,
      states: ['OR'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-11T11:00:00Z',
    },
  },
  {
    id: 'nci-state-colorado',
    category: 'state',
    label: 'Colorado',
    region: 'US-Mountain',
    trustScore: 83,
    summary: {
      proofs: 260,
      states: ['CO'],
      trustAnchors: 4,
      lastVerifiedAt: '2025-11-10T10:45:00Z',
    },
  },
]

export const NCI_GRAPH_EDGES: NciGraphEdge[] = [
  { id: 'edge-patel-cmb', source: 'nci-clinician-patel', target: 'nci-issuer-cmb', relationship: 'issues', strength: 0.94 },
  { id: 'edge-patel-abim', source: 'nci-clinician-patel', target: 'nci-issuer-abim', relationship: 'issues', strength: 0.92 },
  { id: 'edge-patel-imlc', source: 'nci-clinician-patel', target: 'nci-issuer-imlc', relationship: 'issues', strength: 0.9 },
  { id: 'edge-patel-northwind', source: 'nci-clinician-patel', target: 'nci-verifier-northwind', relationship: 'verifies', strength: 0.91 },
  { id: 'edge-patel-evergreen', source: 'nci-clinician-patel', target: 'nci-verifier-evergreen', relationship: 'verifies', strength: 0.89 },
  { id: 'edge-patel-bluesky', source: 'nci-clinician-patel', target: 'nci-verifier-bluesky', relationship: 'enrolls', strength: 0.87 },
  { id: 'edge-patel-northwind-org', source: 'nci-clinician-patel', target: 'nci-org-northwind', relationship: 'privileges', strength: 0.9 },
  { id: 'edge-patel-sequoia-org', source: 'nci-clinician-patel', target: 'nci-org-sequoia', relationship: 'privileges', strength: 0.84 },
  { id: 'edge-patel-state-ca', source: 'nci-clinician-patel', target: 'nci-state-california', relationship: 'covers', strength: 0.93 },
  { id: 'edge-patel-state-wa', source: 'nci-clinician-patel', target: 'nci-state-washington', relationship: 'covers', strength: 0.89 },
  { id: 'edge-patel-state-tx', source: 'nci-clinician-patel', target: 'nci-state-texas', relationship: 'covers', strength: 0.86 },
  { id: 'edge-santos-nyprof', source: 'nci-clinician-santos', target: 'nci-issuer-nyprof', relationship: 'issues', strength: 0.91 },
  { id: 'edge-santos-abim', source: 'nci-clinician-santos', target: 'nci-issuer-abim', relationship: 'issues', strength: 0.9 },
  { id: 'edge-santos-imlc', source: 'nci-clinician-santos', target: 'nci-issuer-imlc', relationship: 'issues', strength: 0.86 },
  { id: 'edge-santos-tristate', source: 'nci-clinician-santos', target: 'nci-verifier-tristate', relationship: 'verifies', strength: 0.88 },
  { id: 'edge-santos-bluesky', source: 'nci-clinician-santos', target: 'nci-verifier-bluesky', relationship: 'enrolls', strength: 0.83 },
  { id: 'edge-santos-tristate-org', source: 'nci-clinician-santos', target: 'nci-org-tristate', relationship: 'privileges', strength: 0.85 },
  { id: 'edge-santos-state-ny', source: 'nci-clinician-santos', target: 'nci-state-newyork', relationship: 'covers', strength: 0.9 },
  { id: 'edge-santos-state-ma', source: 'nci-clinician-santos', target: 'nci-state-massachusetts', relationship: 'covers', strength: 0.82 },
  { id: 'edge-santos-state-fl', source: 'nci-clinician-santos', target: 'nci-state-florida', relationship: 'covers', strength: 0.8 },
  { id: 'edge-chen-cmb', source: 'nci-clinician-chen', target: 'nci-issuer-cmb', relationship: 'issues', strength: 0.9 },
  { id: 'edge-chen-abim', source: 'nci-clinician-chen', target: 'nci-issuer-abim', relationship: 'issues', strength: 0.89 },
  { id: 'edge-chen-imlc', source: 'nci-clinician-chen', target: 'nci-issuer-imlc', relationship: 'issues', strength: 0.88 },
  { id: 'edge-chen-northwind', source: 'nci-clinician-chen', target: 'nci-verifier-northwind', relationship: 'verifies', strength: 0.9 },
  { id: 'edge-chen-evergreen', source: 'nci-clinician-chen', target: 'nci-verifier-evergreen', relationship: 'verifies', strength: 0.88 },
  { id: 'edge-chen-bluesky', source: 'nci-clinician-chen', target: 'nci-verifier-bluesky', relationship: 'enrolls', strength: 0.82 },
  { id: 'edge-chen-northwind-org', source: 'nci-clinician-chen', target: 'nci-org-northwind', relationship: 'privileges', strength: 0.9 },
  { id: 'edge-chen-state-wa', source: 'nci-clinician-chen', target: 'nci-state-washington', relationship: 'covers', strength: 0.91 },
  { id: 'edge-chen-state-or', source: 'nci-clinician-chen', target: 'nci-state-oregon', relationship: 'covers', strength: 0.86 },
  { id: 'edge-chen-state-co', source: 'nci-clinician-chen', target: 'nci-state-colorado', relationship: 'covers', strength: 0.84 },
]

export const NCI_CLINICIAN_DIRECTORY: NciClinicianProfile[] = [
  {
    did: 'did:web:nci.vitalcv/patel',
    npi: '1888777666',
    name: 'Dr. Aanya Patel',
    specialty: 'Hospitalist',
    homeState: 'CA',
    trustScore: 92,
    lastSyncedAt: '2025-11-12T04:02:00Z',
    stats: {
      issuers: 4,
      verifiers: 5,
      orgs: 3,
      states: 6,
    },
    credentials: [
      {
        category: 'license',
        issuer: 'California Medical Board',
        verifier: 'Northwind Health Credentialing',
        status: 'VERIFIED',
        scope: 'CA · MD-CA-7712',
        trustScore: 96,
        reference: 'NCI-LIC-CA-7712',
        effectiveAt: '2023-06-01T00:00:00Z',
        updatedAt: '2025-11-11T16:15:00Z',
        metadata: {
          jurisdiction: 'CA',
          expiration: '2026-06-01',
          states: ['CA', 'WA'],
        },
      },
      {
        category: 'board',
        issuer: 'American Board of Internal Medicine',
        verifier: 'TriState Telehealth QC',
        status: 'VERIFIED',
        scope: 'ABIM · Hospital Medicine',
        trustScore: 94,
        reference: 'NCI-BOARD-44521',
        effectiveAt: '2022-04-01T00:00:00Z',
        updatedAt: '2025-11-10T09:30:00Z',
        metadata: {
          certification: 'Hospital Medicine',
          cycle: '2022-2029',
        },
      },
      {
        category: 'privilege',
        issuer: 'Northwind Health System',
        verifier: 'Evergreen Care Network',
        status: 'VERIFIED',
        scope: 'Telehospitalist · Northwind Main',
        trustScore: 91,
        reference: 'NCI-PRIV-NW-1188',
        effectiveAt: '2024-02-15T00:00:00Z',
        updatedAt: '2025-11-09T21:50:00Z',
        metadata: {
          facility: 'Northwind Main',
          level: 'FULL',
          services: ['Tele-ICU', 'Inpatient Consult'],
        },
      },
      {
        category: 'enrollment',
        issuer: 'BlueSky Health Plan',
        verifier: 'BlueSky Health Plan',
        status: 'VERIFIED',
        scope: 'BlueSky Value POS · TX/WA',
        trustScore: 88,
        reference: 'NCI-ENR-BS-9021',
        effectiveAt: '2024-08-01T00:00:00Z',
        updatedAt: '2025-11-10T15:15:00Z',
        metadata: {
          payers: ['BlueSky'],
          plans: ['Value POS'],
          states: ['TX', 'WA'],
        },
      },
      {
        category: 'compact',
        issuer: 'IMLC Compact Registry',
        verifier: 'California Medical Board',
        status: 'VERIFIED',
        scope: 'IMLC Letter of Qualification · CA',
        trustScore: 90,
        reference: 'NCI-CMPT-IMLC-55211',
        effectiveAt: '2024-05-20T00:00:00Z',
        updatedAt: '2025-11-11T04:45:00Z',
        metadata: {
          states: ['CA', 'TX', 'WA', 'AZ'],
          status: 'ACTIVE',
        },
      },
    ],
    connections: {
      issuers: [
        'California Medical Board',
        'American Board of Internal Medicine',
        'IMLC Compact Registry',
      ],
      verifiers: [
        'Northwind Health Credentialing',
        'TriState Telehealth QC',
        'Evergreen Care Network',
        'BlueSky Health Plan',
      ],
      orgs: ['Northwind Health System', 'Sequoia Regional Care'],
      states: ['CA', 'WA', 'AZ', 'TX'],
    },
  },
  {
    did: 'did:web:nci.vitalcv/santos',
    npi: '1777666555',
    name: 'Dr. Miguel Santos',
    specialty: 'Cardiology',
    homeState: 'NY',
    trustScore: 88,
    lastSyncedAt: '2025-11-11T22:12:00Z',
    stats: {
      issuers: 4,
      verifiers: 4,
      orgs: 2,
      states: 5,
    },
    credentials: [
      {
        category: 'license',
        issuer: 'NY Office of Professions',
        verifier: 'TriState Telehealth QC',
        status: 'VERIFIED',
        scope: 'NY · MD-28991',
        trustScore: 93,
        reference: 'NCI-LIC-NY-28991',
        effectiveAt: '2022-09-01T00:00:00Z',
        updatedAt: '2025-11-10T11:00:00Z',
        metadata: {
          jurisdiction: 'NY',
          expiration: '2025-09-30',
          states: ['NY'],
        },
      },
      {
        category: 'board',
        issuer: 'American Board of Internal Medicine',
        verifier: 'TriState Telehealth QC',
        status: 'VERIFIED',
        scope: 'ABIM · Cardiology',
        trustScore: 92,
        reference: 'NCI-BOARD-77411',
        effectiveAt: '2021-01-01T00:00:00Z',
        updatedAt: '2025-11-08T16:20:00Z',
        metadata: {
          certification: 'Adult Cardiology',
          cycle: '2021-2028',
        },
      },
      {
        category: 'privilege',
        issuer: 'TriState Telehealth',
        verifier: 'TriState Telehealth QC',
        status: 'VERIFIED',
        scope: 'Cardiology · Virtual CVU',
        trustScore: 86,
        reference: 'NCI-PRIV-TS-4412',
        effectiveAt: '2024-04-12T00:00:00Z',
        updatedAt: '2025-11-09T10:05:00Z',
        metadata: {
          facility: 'TriState Virtual CVU',
          level: 'PROVISIONAL',
          services: ['eConsult', 'Follow-up'],
        },
      },
      {
        category: 'enrollment',
        issuer: 'BlueSky Health Plan',
        verifier: 'BlueSky Health Plan',
        status: 'VERIFIED',
        scope: 'BlueSky PPO · NY/NJ',
        trustScore: 82,
        reference: 'NCI-ENR-BS-44118',
        effectiveAt: '2023-02-01T00:00:00Z',
        updatedAt: '2025-11-10T15:15:00Z',
        metadata: {
          payers: ['BlueSky'],
          plans: ['Elite PPO'],
          states: ['NY', 'NJ'],
        },
      },
      {
        category: 'compact',
        issuer: 'IMLC Compact Registry',
        verifier: 'NY Office of Professions',
        status: 'VERIFIED',
        scope: 'IMLC Letter of Qualification · NY',
        trustScore: 86,
        reference: 'NCI-CMPT-IMLC-88101',
        effectiveAt: '2024-01-05T00:00:00Z',
        updatedAt: '2025-11-10T07:10:00Z',
        metadata: {
          states: ['NY', 'MA', 'FL'],
          status: 'ACTIVE',
        },
      },
    ],
    connections: {
      issuers: [
        'NY Office of Professions',
        'American Board of Internal Medicine',
        'IMLC Compact Registry',
      ],
      verifiers: ['TriState Telehealth QC', 'BlueSky Health Plan'],
      orgs: ['TriState Telehealth'],
      states: ['NY', 'MA', 'FL'],
    },
  },
  {
    did: 'did:web:nci.vitalcv/chen',
    npi: '1666555444',
    name: 'Dr. Riley Chen',
    specialty: 'Critical Care',
    homeState: 'WA',
    trustScore: 90,
    lastSyncedAt: '2025-11-12T01:44:00Z',
    stats: {
      issuers: 4,
      verifiers: 4,
      orgs: 2,
      states: 5,
    },
    credentials: [
      {
        category: 'license',
        issuer: 'California Medical Board',
        verifier: 'Northwind Health Credentialing',
        status: 'VERIFIED',
        scope: 'CA · MD-CA-66421',
        trustScore: 95,
        reference: 'NCI-LIC-CA-66421',
        effectiveAt: '2023-03-10T00:00:00Z',
        updatedAt: '2025-11-11T12:10:00Z',
        metadata: {
          jurisdiction: 'CA',
          expiration: '2026-03-10',
          states: ['CA', 'WA'],
        },
      },
      {
        category: 'board',
        issuer: 'American Board of Internal Medicine',
        verifier: 'Northwind Health Credentialing',
        status: 'VERIFIED',
        scope: 'ABIM · Critical Care',
        trustScore: 93,
        reference: 'NCI-BOARD-99821',
        effectiveAt: '2020-07-01T00:00:00Z',
        updatedAt: '2025-11-09T13:40:00Z',
        metadata: {
          certification: 'Critical Care',
          cycle: '2020-2027',
        },
      },
      {
        category: 'privilege',
        issuer: 'Northwind Health System',
        verifier: 'Evergreen Care Network',
        status: 'VERIFIED',
        scope: 'Critical Care · Evergreen MICU',
        trustScore: 90,
        reference: 'NCI-PRIV-NW-7721',
        effectiveAt: '2024-06-18T00:00:00Z',
        updatedAt: '2025-11-10T03:55:00Z',
        metadata: {
          facility: 'Evergreen Medical Center',
          level: 'FULL',
          services: ['ICU Rounds', 'Code Team'],
        },
      },
      {
        category: 'enrollment',
        issuer: 'BlueSky Health Plan',
        verifier: 'BlueSky Health Plan',
        status: 'VERIFIED',
        scope: 'BlueSky ACO · West',
        trustScore: 84,
        reference: 'NCI-ENR-BS-77111',
        effectiveAt: '2024-03-01T00:00:00Z',
        updatedAt: '2025-11-10T15:15:00Z',
        metadata: {
          payers: ['BlueSky'],
          plans: ['ACO West'],
          states: ['WA', 'OR', 'CO'],
        },
      },
      {
        category: 'compact',
        issuer: 'IMLC Compact Registry',
        verifier: 'California Medical Board',
        status: 'VERIFIED',
        scope: 'IMLC Letter of Qualification · CA',
        trustScore: 89,
        reference: 'NCI-CMPT-IMLC-77231',
        effectiveAt: '2023-12-12T00:00:00Z',
        updatedAt: '2025-11-11T02:30:00Z',
        metadata: {
          states: ['WA', 'OR', 'CO'],
          status: 'ACTIVE',
        },
      },
    ],
    connections: {
      issuers: [
        'California Medical Board',
        'American Board of Internal Medicine',
        'IMLC Compact Registry',
      ],
      verifiers: [
        'Northwind Health Credentialing',
        'Evergreen Care Network',
        'BlueSky Health Plan',
      ],
      orgs: ['Northwind Health System'],
      states: ['WA', 'OR', 'CO', 'CA'],
    },
  },
]

export const NCI_TRUST_ANCHORS: NciTrustAnchor[] = [
  {
    id: 'anchor-cmb',
    name: 'California Medical Board',
    did: 'did:web:nci.vitalcv/anchors/cmb',
    roles: ['issuer', 'verifier'],
    jurisdiction: 'CA',
    accreditation: 'FSMB Tier 1',
    attestationCount: 418,
    trustScore: 96,
    lastAudit: '2025-10-02T18:00:00Z',
    contact: 'compliance@mbc.ca.gov',
  },
  {
    id: 'anchor-nyprof',
    name: 'NY Office of Professions',
    did: 'did:web:nci.vitalcv/anchors/nyprof',
    roles: ['issuer'],
    jurisdiction: 'NY',
    accreditation: 'NYSED Credentialing',
    attestationCount: 365,
    trustScore: 93,
    lastAudit: '2025-09-28T14:30:00Z',
    contact: 'attestations@nysed.gov',
  },
  {
    id: 'anchor-abim',
    name: 'American Board of Internal Medicine',
    did: 'did:web:nci.vitalcv/anchors/abim',
    roles: ['issuer', 'verifier'],
    jurisdiction: 'US',
    accreditation: 'ABMS Member Board',
    attestationCount: 302,
    trustScore: 94,
    lastAudit: '2025-09-14T12:00:00Z',
    contact: 'trust@abim.org',
  },
  {
    id: 'anchor-imlc',
    name: 'IMLC Compact Registry',
    did: 'did:web:nci.vitalcv/anchors/imlc',
    roles: ['issuer'],
    jurisdiction: 'Multi-state',
    accreditation: 'FSMB Compact',
    attestationCount: 255,
    trustScore: 91,
    lastAudit: '2025-10-11T09:45:00Z',
    contact: 'support@imlcc.org',
  },
  {
    id: 'anchor-northwind',
    name: 'Northwind Health Credentialing',
    did: 'did:web:nci.vitalcv/anchors/northwind',
    roles: ['verifier'],
    jurisdiction: 'WA, OR, CA',
    accreditation: 'NCQA CVO',
    attestationCount: 188,
    trustScore: 90,
    lastAudit: '2025-10-20T21:15:00Z',
    contact: 'cvo@northwindhealth.org',
  },
  {
    id: 'anchor-tristate',
    name: 'TriState Telehealth QC',
    did: 'did:web:nci.vitalcv/anchors/tristate',
    roles: ['verifier'],
    jurisdiction: 'NY, NJ, PA',
    accreditation: 'URAC Credentialing',
    attestationCount: 174,
    trustScore: 87,
    lastAudit: '2025-10-05T17:40:00Z',
    contact: 'qc@tristate-telehealth.com',
  },
  {
    id: 'anchor-bluesky',
    name: 'BlueSky Health Plan',
    did: 'did:web:nci.vitalcv/anchors/bluesky',
    roles: ['issuer', 'verifier'],
    jurisdiction: 'TX, WA, FL',
    accreditation: 'NCQA Health Plan',
    attestationCount: 158,
    trustScore: 85,
    lastAudit: '2025-09-30T10:25:00Z',
    contact: 'providerops@blueskyhealth.com',
  },
  {
    id: 'anchor-evergreen',
    name: 'Evergreen Care Network',
    did: 'did:web:nci.vitalcv/anchors/evergreen',
    roles: ['verifier'],
    jurisdiction: 'WA, OR',
    accreditation: 'Joint Commission CVO',
    attestationCount: 165,
    trustScore: 89,
    lastAudit: '2025-10-12T08:10:00Z',
    contact: 'verifications@evergreen.org',
  },
]

const proofBundles: Record<string, NciProofBundle> = {}

for (const profile of NCI_CLINICIAN_DIRECTORY) {
  const proofsByCategory = profile.credentials.reduce(
    (acc, proof) => {
      acc[proof.category] = proof
      return acc
    },
    {} as Partial<Record<NciCredentialCategory, NciCredentialProof>>,
  )

  if (
    proofsByCategory.license &&
    proofsByCategory.board &&
    proofsByCategory.privilege &&
    proofsByCategory.enrollment &&
    proofsByCategory.compact
  ) {
    proofBundles[profile.did] = {
      clinicianDid: profile.did,
      clinicianNpi: profile.npi,
      lastRefreshedAt: profile.lastSyncedAt,
      proofs: proofsByCategory as Record<NciCredentialCategory, NciCredentialProof>,
    }
  }
}

export const NCI_PROOF_BUNDLES = proofBundles

export function getNciProofBundle(query: {
  did?: string
  npi?: string
}): NciProofBundle | undefined {
  if (!query.did && !query.npi) {
    return undefined
  }

  return Object.values(NCI_PROOF_BUNDLES).find((bundle) => {
    if (query.did && bundle.clinicianDid === query.did) {
      return true
    }
    if (query.npi && bundle.clinicianNpi === query.npi) {
      return true
    }
    return false
  })
}

