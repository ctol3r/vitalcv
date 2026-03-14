/**
 * protocol.ts — VitalCV Trust Protocol Public API
 *
 * GET  /.well-known/vitalcv-trust           — discovery (like OpenID .well-known)
 * GET  /api/protocol/spec                   — machine-readable full spec
 * GET  /api/protocol/versions               — version history
 * GET  /api/protocol/conformance            — conformance test catalogue
 * POST /api/protocol/conformance/run        — run conformance suite against a URL
 * GET  /api/protocol/implementations        — registered third-party implementations
 * POST /api/protocol/register               — register as a protocol implementer
 * GET  /api/protocol/implementations/:id    — single implementation record
 * GET  /api/protocol/badge/:id              — conformance badge redirect
 */

import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import {
  buildProtocolSpec,
  CONFORMANCE_TESTS,
  PROTOCOL_VERSION,
  registerImplementation,
  listImplementations,
  getImplementation,
} from '../services/protocol/protocolSpec';
import { runConformanceTests } from '../services/protocol/conformanceRunner';
import { log } from '../obs/logger';

// Throttle conformance runs per IP: max 3 per 5 min
const runThrottle = new Map<string, { count: number; resetAt: number }>();
function checkThrottle(ip: string): boolean {
  const now  = Date.now();
  const slot = runThrottle.get(ip);
  if (!slot || slot.resetAt < now) {
    runThrottle.set(ip, { count: 1, resetAt: now + 5 * 60_000 });
    return true;
  }
  if (slot.count >= 3) return false;
  slot.count++;
  return true;
}

export function registerProtocolRoutes(app: Express): void {

  /**
   * GET /.well-known/vitalcv-trust
   *
   * Protocol discovery document. Any system integrating VitalCV first
   * fetches this to discover endpoints, version, and capabilities.
   * Modelled on OpenID Connect's .well-known/openid-configuration.
   */
  app.get('/.well-known/vitalcv-trust', (req: Request, res: Response) => {
    const base = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      schema:                    'https://vitalcv.com/protocol/discovery/v1',
      protocol_version:          PROTOCOL_VERSION,
      issuer:                    'VitalCV',
      issuer_uri:                'https://vitalcv.com',

      // Core endpoints all conforming implementations must expose
      trust_state_endpoint:      `${base}/api/trust-state/{npi}`,
      verify_endpoint:           `${base}/api/verify-professional/{npi}`,
      passport_endpoint:         `${base}/api/passport/{npi}`,
      psv_endpoint:              `${base}/api/psv/verify`,
      timeline_endpoint:         `${base}/api/decisions/npi/{npi}/timeline`,
      capsule_replay_endpoint:   `${base}/api/decisions/{id}/replay`,

      // Discovery
      spec_uri:                  `${base}/api/protocol/spec`,
      conformance_uri:           `${base}/api/protocol/conformance`,
      implementations_uri:       `${base}/api/protocol/implementations`,

      // Crypto
      public_keys_uri:           `${base}/api/crypto/keys`,
      supported_suites:          ['sha256', 'ed25519', 'ml-dsa-65', 'slh-dsa-128s'],
      pqc_suites:                ['ml-dsa-65', 'slh-dsa-128s'],

      // Trust bands
      trust_bands:               ['L0', 'L1', 'L2', 'L3'],
      verdict_enum:              ['AUTHORIZED', 'CONDITIONAL', 'BLOCKED'],

      capabilities: [
        'trust_state', 'psv_verification', 'ai_verify', 'clinician_passport',
        'decision_capsules', 'audit_replay', 'pqc_signatures', 'selective_disclosure',
        'authority_graph', 'workforce_intelligence',
      ],
    });
  });

  /**
   * GET /api/protocol/spec
   * Full machine-readable protocol specification.
   * Third-party implementers use this to build conforming systems.
   */
  app.get('/api/protocol/spec', (req: Request, res: Response) => {
    const base = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(buildProtocolSpec(base));
  });

  /**
   * GET /api/protocol/versions
   * Version history and migration notes.
   */
  app.get('/api/protocol/versions', (_req: Request, res: Response) => {
    res.json({
      current: PROTOCOL_VERSION,
      versions: [
        {
          version:     '1.0.0',
          status:      'ACTIVE',
          publishedAt: '2026-03-14',
          changes:     [
            'Initial stable release',
            'Trust bands L0–L3 finalized (methodology 243.1)',
            'DecisionCapsule schema v262 stable',
            'PQC suites: ML-DSA-65 (FIPS 204), SLH-DSA-128s (FIPS 205)',
            'Conformance test suite v1 (15 tests, 11 REQUIRED)',
            'Clinician Passport three-mode access (public/wallet/selective)',
            'AI Professional Verification API (AUTHORIZED/CONDITIONAL/BLOCKED)',
          ],
          breakingChanges: [],
          migrationGuide:  null,
        },
      ],
    });
  });

  /**
   * GET /api/protocol/conformance
   * Conformance test catalogue — what a conforming implementation must pass.
   */
  app.get('/api/protocol/conformance', (_req: Request, res: Response) => {
    const required    = CONFORMANCE_TESTS.filter(t => t.level === 'REQUIRED');
    const recommended = CONFORMANCE_TESTS.filter(t => t.level === 'RECOMMENDED');
    const optional    = CONFORMANCE_TESTS.filter(t => t.level === 'OPTIONAL');

    res.json({
      schema:      'https://vitalcv.com/protocol/conformance/v1',
      version:     PROTOCOL_VERSION,
      total:       CONFORMANCE_TESTS.length,
      required:    required.length,
      recommended: recommended.length,
      optional:    optional.length,
      passingThreshold: '100% of REQUIRED tests',
      runEndpoint: '/api/protocol/conformance/run',
      tests:       CONFORMANCE_TESTS,
    });
  });

  /**
   * POST /api/protocol/conformance/run
   *
   * Run the conformance suite against any URL.
   * Body: {
   *   targetUrl:      string   required — base URL of the implementation
   *   implementerId?: string   optional — update their registry record
   *   groups?:        string[] optional — filter by group
   *   parallel?:      boolean  optional — run tests in parallel (faster, more load)
   * }
   */
  app.post('/api/protocol/conformance/run', async (req: Request, res: Response) => {
    const ip   = req.ip ?? 'unknown';
    if (!checkThrottle(ip)) {
      res.status(429).json({ error: 'Too many conformance runs — max 3 per 5 minutes' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : '';
    if (!targetUrl || !targetUrl.startsWith('http')) {
      res.status(400).json({ error: 'targetUrl must be a valid HTTP/HTTPS URL' });
      return;
    }

    const implementerId = typeof body.implementerId === 'string' ? body.implementerId : undefined;
    const parallel      = body.parallel === true;
    const groups        = Array.isArray(body.groups) ? body.groups as string[] : undefined;

    try {
      log('info', 'protocol: conformance run started', { targetUrl, implementerId });
      const report = await runConformanceTests(targetUrl, { implementerId, groups, parallel });
      res.json(report);
    } catch (err) {
      log('error', 'protocol: conformance run failed', { targetUrl, error: String(err) });
      res.status(500).json({ error: 'Conformance run failed', detail: String(err) });
    }
  });

  /**
   * GET /api/protocol/implementations
   * Registered third-party implementations.
   */
  app.get('/api/protocol/implementations', (_req: Request, res: Response) => {
    const impls = listImplementations();
    res.json({
      total: impls.length,
      conformant: impls.filter(i => i.status === 'CONFORMANT').length,
      implementations: impls.map(i => ({
        implementerId:     i.implementerId,
        organizationName:  i.organizationName,
        baseUrl:           i.baseUrl,
        status:            i.status,
        conformanceScore:  i.conformanceScore,
        lastConformanceAt: i.lastConformanceAt,
        registeredAt:      i.registeredAt,
        badge:             i.badge,
      })),
    });
  });

  /**
   * POST /api/protocol/register
   *
   * Register as a VitalCV Trust Protocol implementer.
   * Body: {
   *   implementerId:    string   required — unique identifier (org slug)
   *   organizationName: string   required
   *   baseUrl:          string   required — implementation base URL
   *   contactEmail:     string   required
   * }
   */
  app.post('/api/protocol/register', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const implementerId    = typeof body.implementerId === 'string' ? body.implementerId.trim() : randomUUID().slice(0, 8);
    const organizationName = typeof body.organizationName === 'string' ? body.organizationName.trim() : '';
    const baseUrl          = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const contactEmail     = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';

    if (!organizationName) { res.status(400).json({ error: 'organizationName required' }); return; }
    if (!baseUrl || !baseUrl.startsWith('http')) { res.status(400).json({ error: 'baseUrl must be a valid URL' }); return; }

    const record = registerImplementation({ implementerId, organizationName, baseUrl, contactEmail });

    log('info', 'protocol: implementer registered', { implementerId, organizationName });

    res.status(201).json({
      ...record,
      nextSteps: [
        `Run conformance tests: POST /api/protocol/conformance/run { targetUrl: "${baseUrl}", implementerId: "${implementerId}" }`,
        'Read the spec: GET /api/protocol/spec',
        'Download SDK: https://www.npmjs.com/package/@vitalcv/verifier-sdk',
      ],
    });
  });

  /**
   * GET /api/protocol/implementations/:id
   * Single implementation record.
   */
  app.get('/api/protocol/implementations/:id', (req: Request, res: Response) => {
    const impl = getImplementation(req.params.id!);
    if (!impl) { res.status(404).json({ error: 'Implementation not found' }); return; }
    res.json(impl);
  });

  /**
   * GET /api/protocol/badge/:id
   * Conformance badge redirect — embed in README, website, etc.
   */
  app.get('/api/protocol/badge/:id', (req: Request, res: Response) => {
    const impl = getImplementation(req.params.id!);
    if (!impl) {
      res.redirect('https://vitalcv.com/badges/protocol-implementer.svg');
      return;
    }
    res.redirect(impl.badge);
  });
}
