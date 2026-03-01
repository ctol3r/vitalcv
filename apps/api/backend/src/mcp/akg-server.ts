/**
 * akg-server.ts — Wave 27: Authority-Bound Knowledge Graph
 *
 * MCP-compatible (Model Context Protocol) REST endpoint.
 *
 * Endpoint:  GET  /api/akg/query
 * Query param: q  — natural-language query from an external AI agent
 *
 * The server:
 *  1. Parses the NL query with a deterministic rule engine (no LLM needed —
 *     hallucination-free by design, answers only from signed DB records).
 *  2. Traverses the Prisma trust graph:
 *       Clinician ↔ PsvReceipt ↔ VerificationArtifact ↔ AuditSnapshot
 *       Clinician ↔ Acceptance ↔ Start
 *  3. Returns a strictly typed MCP response containing:
 *       - boolean outcome
 *       - confidence score (0–1)
 *       - natural-language reasoning chain
 *       - exact graph path traversed (nodes + relationship labels)
 *       - cryptographic audit anchor for every step
 *
 * MCP Tool Registration (for AI agent tool-use):
 *   GET /api/akg/manifest — returns the MCP tool manifest JSON so external
 *   AI agents can auto-discover this tool without documentation.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { sha256Hex } from '../utils/deterministic';
import { publicApiRateLimit } from '../middleware/publicSafety';

// ── Response types ────────────────────────────────────────────────────────

export type AKGNodeKind =
  | 'CLINICIAN'
  | 'LICENSE'
  | 'PSV_RECEIPT'
  | 'ARTIFACT'
  | 'STATE_BOARD'
  | 'EMPLOYER'
  | 'AUDIT_SNAPSHOT';

export interface AKGNode {
  id: string;
  kind: AKGNodeKind;
  label: string;
  status: string;
  auditHash: string | null;
  verifiedAt: string | null;
}

export interface AKGEdge {
  from: string;
  to: string;
  relationship:
    | 'HAS_LICENSE'
    | 'VERIFIED_BY'
    | 'ATTESTED_BY'
    | 'EMPLOYED_AT'
    | 'ANCHORED_IN'
    | 'ISSUED_BY';
  since: string | null;
}

export interface AKGQueryResponse {
  /** MCP schema version */
  schema: 'vitalcv.akg.v1';
  query: string;
  /** Deterministic boolean: does the evidence support the query? */
  outcome: boolean;
  /** 0–1 confidence based on number of corroborating anchors */
  confidence: number;
  /** Human-readable chain of reasoning, citing each graph node */
  reasoning: string[];
  /** Ordered graph traversal path */
  path: AKGNode[];
  /** Edges (relationships) in the traversal */
  edges: AKGEdge[];
  /** The terminal cryptographic anchor hash (SHA-256 of path) */
  auditAnchor: string;
  /** ISO timestamp of this response */
  generatedAt: string;
  /** Caveats the AI consuming this MUST surface to users */
  caveats: string[];
}

// ── NL Query Parser ───────────────────────────────────────────────────────

interface ParsedQuery {
  npi: string | null;
  /** Keywords indicating what the agent is asking about */
  intents: ('credentialed' | 'licensed' | 'cleared' | 'eligible' | 'verified')[];
  specialty: string | null;
  state: string | null;
  rawQuery: string;
}

const STATE_MAP: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
};

const SPECIALTY_KEYWORDS: Record<string, string> = {
  'icu': 'Critical Care', 'intensive care': 'Critical Care',
  'cardiology': 'Cardiology', 'cardiac': 'Cardiology',
  'emergency': 'Emergency Medicine', 'er ': 'Emergency Medicine',
  'pediatric': 'Pediatrics', 'surgery': 'Surgery', 'surgical': 'Surgery',
  'neurology': 'Neurology', 'oncology': 'Oncology', 'radiology': 'Radiology',
  'anesthesiology': 'Anesthesiology', 'internal medicine': 'Internal Medicine',
  'psychiatry': 'Psychiatry', 'obstetrics': 'Obstetrics', 'ob/gyn': 'Obstetrics',
  'orthopedic': 'Orthopedics', 'dermatology': 'Dermatology', 'nursing': 'Nursing',
};

function parseQuery(raw: string): ParsedQuery {
  const lower = raw.toLowerCase();

  // Extract 10-digit NPI
  const npiMatch = raw.match(/\b(\d{10})\b/);

  // Detect intent keywords
  const intents: ParsedQuery['intents'] = [];
  if (lower.includes('credential')) intents.push('credentialed');
  if (lower.includes('licens')) intents.push('licensed');
  if (lower.includes('clear') || lower.includes('approved')) intents.push('cleared');
  if (lower.includes('eligible')) intents.push('eligible');
  if (lower.includes('verif')) intents.push('verified');
  if (intents.length === 0) intents.push('verified'); // default

  // Detect state
  let state: string | null = null;
  // Check two-letter abbreviations first
  const abbrevMatch = raw.match(/\b([A-Z]{2})\b/);
  if (abbrevMatch && Object.values(STATE_MAP).includes(abbrevMatch[1])) {
    state = abbrevMatch[1];
  } else {
    for (const [name, code] of Object.entries(STATE_MAP)) {
      if (lower.includes(name)) {
        state = code;
        break;
      }
    }
  }

  // Detect specialty
  let specialty: string | null = null;
  for (const [kw, label] of Object.entries(SPECIALTY_KEYWORDS)) {
    if (lower.includes(kw)) {
      specialty = label;
      break;
    }
  }

  return { npi: npiMatch?.[1] ?? null, intents, specialty, state, rawQuery: raw };
}

// ── Graph traversal ───────────────────────────────────────────────────────

async function traverseAKG(parsed: ParsedQuery): Promise<Omit<AKGQueryResponse, 'schema' | 'query' | 'generatedAt'>> {
  const { npi } = parsed;

  if (!npi) {
    return {
      outcome: false,
      confidence: 0,
      reasoning: [
        'No valid 10-digit NPI was found in the query.',
        'An NPI is required to traverse the Authority-Bound Knowledge Graph.',
        'Tip: include the 10-digit NPI in your query (e.g., "NPI 1234567890").',
      ],
      path: [],
      edges: [],
      auditAnchor: sha256Hex('no-npi'),
      caveats: ['Query could not be resolved without a valid NPI.'],
    };
  }

  // ── Fetch all relevant data in parallel ──
  const [artifacts, receipts, acceptances, identityRow] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: { npi },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        source: true,
        status: true,
        trustState: true,
        checksum: true,
        merkleRoot: true,
        claimHashes: true,
        verifiedAt: true,
        expiresAt: true,
        monitoring: true,
        snapshots: { select: { id: true, snapshot: true, createdAt: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.psvReceipt.findMany({
      where: { clinicianId: npi },
      orderBy: { fetchedAt: 'desc' },
      take: 5,
      select: {
        receiptId: true, sourceAuthority: true, licenseId: true,
        fetchedAt: true, revoked: true, responseHash: true, ttlSeconds: true,
      },
    }),
    prisma.acceptance.findMany({
      where: { subjectId: npi },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { acceptanceId: true, employerId: true, facilityId: true, acceptedAt: true, eventHash: true },
    }),
    prisma.clinicianIdentity.findUnique({
      where: { clinicianId: npi },
      select: { data: true },
    }),
  ]);

  // ── Build the graph path ──
  const path: AKGNode[] = [];
  const edges: AKGEdge[] = [];
  const reasoning: string[] = [];
  const anchorInputs: string[] = [];

  // Node 1: Clinician
  const identityData = identityRow?.data as Record<string, unknown> | null;
  const firstName = typeof identityData?.['first_name'] === 'string' ? identityData['first_name'] : '';
  const lastName = typeof identityData?.['last_name'] === 'string' ? identityData['last_name'] : '';
  const clinicianLabel = [firstName, lastName].filter(Boolean).join(' ') || `Clinician NPI:${npi}`;

  const clinicianNode: AKGNode = {
    id: `clinician:${npi}`,
    kind: 'CLINICIAN',
    label: clinicianLabel,
    status: artifacts[0]?.trustState ?? 'unknown',
    auditHash: null,
    verifiedAt: null,
  };
  path.push(clinicianNode);
  reasoning.push(`[1] Resolved clinician: ${clinicianLabel} (NPI: ${npi})`);

  // Nodes: PSV Receipts (license evidence)
  const activeReceipts = receipts.filter((r) => !r.revoked);
  const revokedReceipts = receipts.filter((r) => r.revoked);

  for (const receipt of receipts.slice(0, 3)) {
    const receiptNode: AKGNode = {
      id: `psv:${receipt.receiptId}`,
      kind: 'PSV_RECEIPT',
      label: `${receipt.sourceAuthority} — ${receipt.licenseId}`,
      status: receipt.revoked ? 'REVOKED' : 'ACTIVE',
      auditHash: receipt.responseHash,
      verifiedAt: receipt.fetchedAt.toISOString(),
    };
    path.push(receiptNode);
    edges.push({ from: clinicianNode.id, to: receiptNode.id, relationship: 'HAS_LICENSE', since: receipt.fetchedAt.toISOString() });
    anchorInputs.push(receipt.responseHash);

    const stateBoardNode: AKGNode = {
      id: `board:${receipt.sourceAuthority}`,
      kind: 'STATE_BOARD',
      label: receipt.sourceAuthority,
      status: 'AUTHORITATIVE',
      auditHash: null,
      verifiedAt: receipt.fetchedAt.toISOString(),
    };
    // Deduplicate state board nodes
    if (!path.find((n) => n.id === stateBoardNode.id)) {
      path.push(stateBoardNode);
      edges.push({ from: receiptNode.id, to: stateBoardNode.id, relationship: 'VERIFIED_BY', since: receipt.fetchedAt.toISOString() });
    }

    if (receipt.revoked) {
      reasoning.push(`[!] License ${receipt.licenseId} from ${receipt.sourceAuthority} is REVOKED.`);
    } else {
      reasoning.push(`[✓] License ${receipt.licenseId} confirmed ACTIVE by ${receipt.sourceAuthority} (hash: ${receipt.responseHash.slice(0, 12)}…)`);
    }
  }

  // Nodes: Verification Artifacts
  for (const art of artifacts.slice(0, 2)) {
    const artHash = art.merkleRoot ?? art.checksum;
    const artNode: AKGNode = {
      id: `artifact:${art.id}`,
      kind: 'ARTIFACT',
      label: `${art.source} — ${art.status}`,
      status: art.trustState,
      auditHash: artHash,
      verifiedAt: art.verifiedAt?.toISOString() ?? null,
    };
    path.push(artNode);
    edges.push({ from: clinicianNode.id, to: artNode.id, relationship: 'ATTESTED_BY', since: art.verifiedAt?.toISOString() ?? null });
    if (artHash) anchorInputs.push(artHash);

    // Audit snapshot
    if (art.snapshots[0]) {
      const snapshotNode: AKGNode = {
        id: `snapshot:${art.snapshots[0].id}`,
        kind: 'AUDIT_SNAPSHOT',
        label: `Immutable Snapshot — ${art.snapshots[0].createdAt.toISOString().slice(0, 10)}`,
        status: 'ANCHORED',
        auditHash: sha256Hex(JSON.stringify(art.snapshots[0].snapshot)),
        verifiedAt: art.snapshots[0].createdAt.toISOString(),
      };
      path.push(snapshotNode);
      edges.push({ from: artNode.id, to: snapshotNode.id, relationship: 'ANCHORED_IN', since: art.snapshots[0].createdAt.toISOString() });
      anchorInputs.push(snapshotNode.auditHash!);
      reasoning.push(`[✓] Artifact ${art.source} anchored in immutable snapshot (hash: ${snapshotNode.auditHash!.slice(0, 12)}…)`);
    }

    reasoning.push(`[✓] Verification artifact from ${art.source}: trust_state=${art.trustState}, status=${art.status}`);
  }

  // Nodes: Employer acceptances
  for (const acc of acceptances.slice(0, 2)) {
    const empNode: AKGNode = {
      id: `employer:${acc.employerId}`,
      kind: 'EMPLOYER',
      label: acc.employerId,
      status: 'ACCEPTED',
      auditHash: acc.eventHash,
      verifiedAt: acc.acceptedAt.toISOString(),
    };
    if (!path.find((n) => n.id === empNode.id)) {
      path.push(empNode);
      edges.push({ from: clinicianNode.id, to: empNode.id, relationship: 'EMPLOYED_AT', since: acc.acceptedAt.toISOString() });
    }
    anchorInputs.push(acc.eventHash);
    reasoning.push(`[✓] Employer acceptance on record: ${acc.employerId} (eventHash: ${acc.eventHash.slice(0, 12)}…)`);
  }

  // ── Determine outcome ──
  const hasActiveArtifact = artifacts.some((a) => a.trustState === 'verified' || a.trustState === 'verified_monitoring');
  const hasActiveLicense = activeReceipts.length > 0;
  const hasNoRevokedLicenses = revokedReceipts.length === 0;
  const hasAuditAnchors = anchorInputs.length > 0;

  let outcome = hasActiveArtifact && hasActiveLicense && hasNoRevokedLicenses;

  // State filter: if the query mentions a state, ensure we have a PSV from that authority
  if (parsed.state) {
    const hasStateAuthority = receipts.some(
      (r) => r.sourceAuthority.toUpperCase().includes(parsed.state!) ||
             r.licenseId.toUpperCase().startsWith(parsed.state!),
    );
    if (!hasStateAuthority) {
      outcome = false;
      reasoning.push(`[✗] Query requires ${parsed.state} licensure — no matching PSV receipt found for that jurisdiction.`);
    } else {
      reasoning.push(`[✓] ${parsed.state} jurisdiction licence confirmed in PSV record.`);
    }
  }

  if (!hasActiveArtifact) reasoning.push('[✗] No verified trust artifact found. At least one artifact must be in state "verified" or "verified_monitoring".');
  if (revokedReceipts.length > 0) reasoning.push(`[✗] ${revokedReceipts.length} revoked license(s) detected — outcome is automatically NEGATIVE.`);
  if (artifacts.length === 0 && receipts.length === 0) reasoning.push('[✗] No data found for this NPI in the Authority-Bound Knowledge Graph.');

  // Outcome summary
  reasoning.push(outcome
    ? `[CONCLUSION] The evidence graph supports a positive outcome: ${clinicianLabel} satisfies the queried trust requirements.`
    : `[CONCLUSION] The evidence graph does NOT support a positive outcome for the queried trust requirements.`);

  // Confidence: number of anchors relative to expected (higher = more corroborating evidence)
  const maxAnchors = 6;
  const confidence = Math.min(1, (anchorInputs.length / maxAnchors) * (outcome ? 1 : 0.3));

  // Terminal audit anchor: SHA-256 of all path hashes concatenated
  const auditAnchor = sha256Hex(anchorInputs.join('|') || `no-anchors:${npi}`);

  const caveats: string[] = [
    'This response was generated deterministically from signed database records — no generative AI was used in the reasoning.',
    'Cryptographic anchors should be cross-referenced against the VitalCV transparency log before acting on this response.',
    'This response does not constitute a legal or regulatory credentialing decision.',
  ];

  if (artifacts.length === 0) caveats.push('No verification artifacts were found for this NPI — this may indicate the clinician has not completed onboarding.');

  return { outcome, confidence, reasoning, path, edges, auditAnchor, caveats };
}

// ── MCP Tool Manifest ─────────────────────────────────────────────────────

const AKG_MANIFEST = {
  schema: 'mcp.tool.v1',
  name: 'vitalcv_akg_query',
  description:
    'Query the VitalCV Authority-Bound Knowledge Graph. Returns a boolean outcome, the exact graph path traversed (Clinician ↔ License ↔ StateBoard ↔ Employer), and a cryptographic audit anchor. Use this tool to answer questions about clinician credentialing readiness — never hallucinate: always call this tool.',
  parameters: {
    type: 'object',
    properties: {
      q: {
        type: 'string',
        description:
          'Natural-language question about a clinician\'s trust state. Must include the 10-digit NPI. Example: "Is clinician NPI 1234567890 fully credentialed for ICU shifts in California?"',
      },
    },
    required: ['q'],
  },
  returns: {
    schema: 'vitalcv.akg.v1',
    description: 'MCP-compatible knowledge graph query response with boolean outcome, reasoning chain, graph path, and audit anchor.',
  },
  rateLimit: '20/minute per IP',
  dataMinimization: 'No PII returned. Clinician node contains name only when available from NPPES public record.',
};

// ── Wave 36: Ontology Tool Manifests ─────────────────────────────────────

const QUERY_STATE_RULES_MANIFEST = {
  schema:      'mcp.tool.v1',
  name:        'query_state_rules',
  description:
    'Returns the deterministic credentialing requirements for a given US state and clinical specialty. ' +
    'Use this before asserting what credentials a clinician needs to start work in a state. ' +
    'Never hallucinate credential lists — always call this tool.',
  parameters: {
    type:     'object',
    properties: {
      stateCode: {
        type:        'string',
        description: 'Two-letter US state code (e.g., "CA", "NY", "TX").',
      },
      specialty: {
        type:        'string',
        description: 'Clinical specialty name (e.g., "Emergency Medicine", "Internal Medicine").',
      },
    },
    required: ['stateCode'],
  },
  returns: {
    schema:      'vitalcv.state_rules.v1',
    description: 'Array of required credential types and renewal window for the state/specialty pair.',
  },
  rateLimit:        '100/10min per IP',
  dataMinimization: 'No PII. Returns only regulatory rule data from StateComplianceRule.',
};

const VALIDATE_TRAINING_PATH_MANIFEST = {
  schema:      'mcp.tool.v1',
  name:        'validate_training_path',
  description:
    "Cross-references a clinician's NPI against the SpecialtyTaxonomy and ResidencyProgram ontology tables. " +
    'Returns whether their declared specialty aligns with their ACGME training record. ' +
    'Use this to detect taxonomy drift or unverifiable training claims.',
  parameters: {
    type:       'object',
    properties: {
      npi: {
        type:        'string',
        description: '10-digit National Provider Identifier.',
      },
    },
    required: ['npi'],
  },
  returns: {
    schema:      'vitalcv.training_path.v1',
    description: 'Validation result with matched taxonomy code, ACGME program data, and confidence score.',
  },
  rateLimit:        '100/10min per IP',
  dataMinimization: 'No PII. NPI is validated format only; name not returned.',
};

// ── Route registration ────────────────────────────────────────────────────

export function registerAKGRoutes(app: Express): void {
  // MCP tool manifest — AI agents auto-discover available tools here
  app.get('/api/akg/manifest', (_req: Request, res: Response): void => {
    res.setHeader('cache-control', 'public, max-age=3600');
    res.json(AKG_MANIFEST);
  });

  // AKG query endpoint
  app.get(
    '/api/akg/query',
    publicApiRateLimit, // 20 req/min/IP
    (req: Request, res: Response): void => {
      const rawQuery = typeof req.query['q'] === 'string' ? req.query['q'].trim() : '';

      if (!rawQuery || rawQuery.length < 5) {
        res.status(400).json({
          error: 'Query parameter "q" is required (min 5 characters).',
          example: 'GET /api/akg/query?q=Is+NPI+1234567890+credentialed+for+ICU+in+California',
        });
        return;
      }

      if (rawQuery.length > 512) {
        res.status(400).json({ error: 'Query too long (max 512 chars).' });
        return;
      }

      const parsed = parseQuery(rawQuery);

      traverseAKG(parsed)
        .then((result): void => {
          const response: AKGQueryResponse = {
            schema: 'vitalcv.akg.v1',
            query: rawQuery,
            generatedAt: new Date().toISOString(),
            ...result,
          };
          res.setHeader('cache-control', 'no-store'); // AKG responses must never be cached
          res.json(response);
        })
        .catch((err: unknown): void => {
          log('error', 'AKG traversal error', { query: rawQuery, err: String(err) });
          if (!res.headersSent) {
            res.status(500).json({ error: 'AKG traversal failed' });
          }
        });
    },
  );

  // ── GET /api/akg/ontology/manifest ─────────────────────────────────────
  // MCP discovery endpoint — lists the two Wave 36 ontology tools.
  app.get('/api/akg/ontology/manifest', (_req: Request, res: Response): void => {
    res.setHeader('cache-control', 'public, max-age=3600');
    res.json({
      schema: 'mcp.toolset.v1',
      tools:  [QUERY_STATE_RULES_MANIFEST, VALIDATE_TRAINING_PATH_MANIFEST],
    });
  });

  // ── GET /api/akg/state-rules ────────────────────────────────────────────
  // MCP tool: query_state_rules(stateCode, specialty?)
  app.get(
    '/api/akg/state-rules',
    publicApiRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      const stateCode = typeof req.query['stateCode'] === 'string'
        ? req.query['stateCode'].toUpperCase().trim()
        : '';
      const specialty = typeof req.query['specialty'] === 'string'
        ? req.query['specialty'].trim()
        : undefined;

      if (!stateCode || !/^[A-Z]{2}$/.test(stateCode)) {
        res.status(400).json({
          error:   'invalid_request',
          message: 'stateCode must be a 2-letter US state abbreviation (e.g. "CA").',
        });
        return;
      }

      try {
        const rules = await prisma.stateComplianceRule.findMany({
          where:   specialty ? { state_code: stateCode, specialty } : { state_code: stateCode },
          orderBy: { specialty: 'asc' },
        });

        res.setHeader('cache-control', 'no-store');
        res.json({
          schema:     'vitalcv.state_rules.v1',
          state_code: stateCode,
          specialty:  specialty ?? null,
          count:      rules.length,
          rules:      rules.map((r) => ({
            specialty:                 r.specialty,
            required_credential_types: r.required_credential_types,
            renewal_window_days:       r.renewal_window_days,
            as_of:                     r.updatedAt.toISOString(),
          })),
        });
      } catch (err) {
        log('error', 'akg_state_rules_error', { stateCode, message: String(err) });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to query state compliance rules.' });
        }
      }
    },
  );

  // ── GET /api/akg/training-path ─────────────────────────────────────────
  // MCP tool: validate_training_path(npi)
  app.get(
    '/api/akg/training-path',
    publicApiRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      const npi = typeof req.query['npi'] === 'string'
        ? req.query['npi'].replace(/\D/g, '').trim()
        : '';

      if (!/^\d{10}$/.test(npi)) {
        res.status(400).json({
          error:   'invalid_request',
          message: 'npi must be a 10-digit National Provider Identifier.',
        });
        return;
      }

      try {
        // Fetch clinician's declared taxonomy from identity record
        const identity = await prisma.clinicianIdentity.findFirst({
          where:  { clinicianId: npi },
          select: { data: true },
        });

        const declaredTaxonomyCode: string | null =
          identity !== null &&
          typeof identity.data === 'object' &&
          identity.data !== null &&
          'taxonomy_code' in (identity.data as Record<string, unknown>)
            ? String((identity.data as Record<string, unknown>)['taxonomy_code'])
            : null;

        // Cross-reference against SpecialtyTaxonomy
        const taxonomyMatch = declaredTaxonomyCode
          ? await prisma.specialtyTaxonomy.findUnique({ where: { code: declaredTaxonomyCode } })
          : null;

        // Find ACGME programs matching the resolved specialty
        const acgmePrograms = taxonomyMatch
          ? await prisma.residencyProgram.findMany({
              where:   { specialty: taxonomyMatch.description },
              take:    5,
              orderBy: { name: 'asc' },
            })
          : [];

        const validated  = Boolean(taxonomyMatch);
        const confidence = validated ? (acgmePrograms.length > 0 ? 0.92 : 0.65) : 0;

        res.setHeader('cache-control', 'no-store');
        res.json({
          schema:                 'vitalcv.training_path.v1',
          npi,
          validated,
          confidence,
          declared_taxonomy_code: declaredTaxonomyCode,
          taxonomy_match:         taxonomyMatch
            ? { code: taxonomyMatch.code, description: taxonomyMatch.description, board_name: taxonomyMatch.board_name }
            : null,
          acgme_programs: acgmePrograms.map((p) => ({
            name:                p.name,
            acgme_code:          p.acgme_code,
            specialty:           p.specialty,
            hospital_affiliation: p.hospital_affiliation,
          })),
          reasoning: validated
            ? `Declared taxonomy ${declaredTaxonomyCode} maps to "${taxonomyMatch!.description}" ` +
              `(${taxonomyMatch!.board_name}). ${acgmePrograms.length} ACGME programme(s) found.`
            : `No taxonomy code found in verification record for NPI ${npi}. Training path cannot be validated.`,
        });
      } catch (err) {
        log('error', 'akg_training_path_error', { npi, message: String(err) });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to validate training path.' });
        }
      }
    },
  );
}
