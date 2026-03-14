/**
 * domains.ts — Universal Professional Authority API
 *
 * GET  /api/domains                              — list all domains
 * GET  /api/domains/:id                          — domain definition
 * GET  /api/domains/:id/spec                     — credential types + sources + scoring
 * POST /api/domains/:id/verify                   — verify a professional in a domain
 * GET  /api/domains/:id/trust-state/:subjectId   — cached trust state for domain professional
 * POST /api/domains/multi                        — cross-domain status for one subjectId
 * GET  /api/domains/:id/badge/:subjectId         — SVG trust badge for any domain
 */

import type { Express, Request, Response } from 'express';
import { getDomain, listDomains } from '../services/domains/domainRegistry';
import {
  verifyDomainProfessional,
  getMultiDomainStatus,
} from '../services/domains/domainVerificationEngine';
import { log } from '../obs/logger';

// Per-subjectId in-flight guard
const inFlight = new Set<string>();

// Simple 5-min result cache: `${domain}:${subjectId}` → DomainTrustState
const stateCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL  = 5 * 60_000;

function fromCache(key: string): unknown | null {
  const entry = stateCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  stateCache.delete(key);
  return null;
}
function toCache(key: string, data: unknown): void {
  stateCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// Trust band → SVG color
const BAND_COLORS: Record<string, string> = {
  L3: '#10b981', L2: '#3b82f6', L1: '#f59e0b', L0: '#ef4444',
};
const BAND_LABELS: Record<string, string> = {
  L3: 'Fully Verified', L2: 'Verified', L1: 'Provisional', L0: 'Unverified',
};

function buildBadgeSvg(domain: string, subjectId: string, band: string, score: number): string {
  const color = BAND_COLORS[band] ?? '#6b7280';
  const label = BAND_LABELS[band] ?? band;
  const domainShort = domain.slice(0, 12).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="24" role="img" aria-label="VitalCV ${domain} authority badge">
  <title>VitalCV ${domain} ${label} (${band})</title>
  <linearGradient id="bg" x2="0" y2="100%"><stop offset="0" stop-color="#555"/><stop offset="1" stop-color="#333"/></linearGradient>
  <linearGradient id="fg" x2="0" y2="100%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}cc"/></linearGradient>
  <rect rx="3" width="220" height="24" fill="url(#bg)"/>
  <rect rx="3" x="130" width="90" height="24" fill="url(#fg)"/>
  <rect x="130" width="4" height="24" fill="url(#fg)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="10">
    <text x="65" y="15.5" fill="#ccc">VitalCV / ${domainShort}</text>
    <text x="175" y="15.5">${label} ${band} · ${score}</text>
  </g>
</svg>`;
}

export function registerDomainRoutes(app: Express): void {

  /**
   * GET /api/domains
   * List all registered domains with status + capabilities.
   */
  app.get('/api/domains', (_req: Request, res: Response) => {
    const domains = listDomains();
    res.json({
      schema:   'https://vitalcv.com/domains/v1',
      total:    domains.length,
      active:   domains.filter(d => d.status === 'ACTIVE').length,
      pilot:    domains.filter(d => d.status === 'PILOT').length,
      domains:  domains.map(d => ({
        id:              d.id,
        name:            d.name,
        description:     d.description,
        status:          d.status,
        version:         d.version,
        subjectIdLabel:  d.subjectIdLabel,
        subjectIdExample: d.subjectIdExample,
        credentialCount: d.credentialTypes.length,
        sourceCount:     d.sources.length,
        verifyEndpoint:  `/api/domains/${d.id}/verify`,
        specEndpoint:    `/api/domains/${d.id}/spec`,
      })),
    });
  });

  /**
   * GET /api/domains/:id
   * Full domain definition.
   */
  app.get('/api/domains/:id', (req: Request, res: Response) => {
    const domain = getDomain(req.params.id!);
    if (!domain) { res.status(404).json({ error: `Domain not found: ${req.params.id}` }); return; }

    // Strip regexp (not JSON-serializable), return pattern as string
    res.json({
      ...domain,
      subjectIdPattern: domain.subjectIdPattern.toString(),
    });
  });

  /**
   * GET /api/domains/:id/spec
   * Credential types, verification sources, scoring weights — everything a
   * third party needs to understand the domain's trust computation.
   */
  app.get('/api/domains/:id/spec', (req: Request, res: Response) => {
    const domain = getDomain(req.params.id!);
    if (!domain) { res.status(404).json({ error: `Domain not found: ${req.params.id}` }); return; }

    const totalPossibleScore = domain.credentialTypes.reduce((s, c) => s + c.scoreContribution, 0);
    res.json({
      domain:          domain.id,
      name:            domain.name,
      version:         domain.version,
      status:          domain.status,
      authorityBody:   domain.authorityBody,
      regulatoryRef:   domain.regulatoryRef,
      subjectIdLabel:  domain.subjectIdLabel,
      subjectIdExample: domain.subjectIdExample,

      trustBandLabels: domain.trustBandLabels,
      scoringWeights:  domain.scoringWeights,
      trustBandThresholds: { L3: 75, L2: 50, L1: 25, L0: 0 },
      totalPossibleScore,

      credentialTypes:     domain.credentialTypes,
      requiredForDeployment: domain.requiredForDeployment,
      hardBlockers:        domain.hardBlockers,

      verificationSources: domain.sources.map(s => ({
        id:               s.id,
        label:            s.label,
        url:              s.url,
        credentialTypes:  s.credentialTypes,
        liveCallAvailable: s.liveCallAvailable,
        activationEnvFlag: s.envFlag,
        currentlyLive:    process.env[s.envFlag] === 'true',
      })),
    });
  });

  /**
   * POST /api/domains/:id/verify
   *
   * Verify a professional's authority in a domain.
   * Runs all verification sources, computes trust band, returns state.
   *
   * Body: { subjectId: string }  (NPI, PE license, bar number, cert ID, etc.)
   */
  app.post('/api/domains/:id/verify', async (req: Request, res: Response) => {
    const domainId  = req.params.id!;
    const domain    = getDomain(domainId);
    if (!domain) { res.status(404).json({ error: `Domain not found: ${domainId}` }); return; }

    const body      = req.body as Record<string, unknown>;
    const subjectId = typeof body.subjectId === 'string' ? body.subjectId.trim() : '';
    if (!subjectId) { res.status(400).json({ error: 'subjectId required' }); return; }

    if (!domain.subjectIdPattern.test(subjectId)) {
      res.status(400).json({
        error: `Invalid ${domain.subjectIdLabel} format for domain ${domainId}`,
        example: domain.subjectIdExample,
        pattern: domain.subjectIdPattern.toString(),
      });
      return;
    }

    const cacheKey = `${domainId}:${subjectId}`;
    const cached   = fromCache(cacheKey);
    if (cached) { res.json({ ...cached as object, cached: true }); return; }

    if (inFlight.has(cacheKey)) {
      res.status(202).json({ message: 'Verification already in progress', domainId, subjectId });
      return;
    }

    inFlight.add(cacheKey);
    try {
      const state = await verifyDomainProfessional(domainId, subjectId);
      toCache(cacheKey, state);
      res.json({ ...state, cached: false });
    } catch (err) {
      const msg = String(err);
      log('error', 'domains: verify failed', { domainId, subjectId, error: msg });
      res.status(500).json({ error: 'Verification failed', detail: msg });
    } finally {
      inFlight.delete(cacheKey);
    }
  });

  /**
   * GET /api/domains/:id/trust-state/:subjectId
   * Cached trust state for a domain professional.
   */
  app.get('/api/domains/:id/trust-state/:subjectId', async (req: Request, res: Response) => {
    const domainId  = req.params.id!;
    const subjectId = req.params.subjectId!;
    const domain    = getDomain(domainId);
    if (!domain) { res.status(404).json({ error: `Domain not found: ${domainId}` }); return; }

    const cacheKey = `${domainId}:${subjectId}`;
    const cached   = fromCache(cacheKey);
    if (cached) { res.json({ ...cached as object, cached: true }); return; }

    try {
      const state = await verifyDomainProfessional(domainId, subjectId);
      toCache(cacheKey, state);
      res.json({ ...state, cached: false });
    } catch (err) {
      log('error', 'domains: trust-state failed', { domainId, subjectId, error: String(err) });
      res.status(500).json({ error: 'Trust state computation failed' });
    }
  });

  /**
   * POST /api/domains/multi
   *
   * Cross-domain status for a single subjectId.
   * Useful for professionals credentialed across multiple domains
   * (e.g., a physician who is also a licensed engineer).
   *
   * Body: { subjectId: string, domains: string[] }
   */
  app.post('/api/domains/multi', async (req: Request, res: Response) => {
    const body      = req.body as Record<string, unknown>;
    const subjectId = typeof body.subjectId === 'string' ? body.subjectId.trim() : '';
    const domains   = Array.isArray(body.domains) ? (body.domains as unknown[]).filter((d): d is string => typeof d === 'string') : [];

    if (!subjectId) { res.status(400).json({ error: 'subjectId required' }); return; }
    if (domains.length === 0) { res.status(400).json({ error: 'domains[] must be non-empty' }); return; }
    if (domains.length > 5) { res.status(400).json({ error: 'Max 5 domains per request' }); return; }

    // Validate all domain IDs
    const unknown = domains.filter(d => !getDomain(d));
    if (unknown.length > 0) { res.status(400).json({ error: `Unknown domains: ${unknown.join(', ')}` }); return; }

    try {
      const result = await getMultiDomainStatus(subjectId, domains);
      res.json(result);
    } catch (err) {
      log('error', 'domains: multi failed', { subjectId, domains, error: String(err) });
      res.status(500).json({ error: 'Multi-domain status failed' });
    }
  });

  /**
   * GET /api/domains/:id/badge/:subjectId
   * SVG trust badge — embed in profiles, websites, applications.
   * Works for any domain, same visual language as healthcare badges.
   */
  app.get('/api/domains/:id/badge/:subjectId', async (req: Request, res: Response) => {
    const domainId  = req.params.id!;
    const subjectId = req.params.subjectId!;

    const cacheKey = `${domainId}:${subjectId}`;
    const cached   = fromCache(cacheKey) as { trustBand?: string; trustScore?: number } | null;

    let band = 'L0', score = 0;
    if (cached?.trustBand) {
      band  = cached.trustBand;
      score = cached.trustScore ?? 0;
    } else {
      try {
        const state = await verifyDomainProfessional(domainId, subjectId);
        toCache(cacheKey, state);
        band  = state.trustBand;
        score = state.trustScore;
      } catch { /* use defaults */ }
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buildBadgeSvg(domainId, subjectId, band, score));
  });
}
