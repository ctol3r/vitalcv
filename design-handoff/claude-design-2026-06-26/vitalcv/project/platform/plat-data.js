/* ══════════════════════════════════════════════════════════════════════════
   plat-data.js — VitalCV Platform · developer-facing data model (W330)
   The extensibility surface: APIs, SDKs, webhooks, keys, ecosystem, embeds.
   Everything is a READ over what the core product already owns. The platform
   extends VitalCV without modifying it.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const meta = {
    base: 'https://api.vitalcv.com',
    version: '2026-06-25',
    org: 'Cedar Health System',
    orgId: 'org_cedar_8f31',
    build: 'vc.2026.06.25 · w330',
  };

  // ── platform health (overview) ──────────────────────────────────────────
  const platform = {
    uptime: '99.98%',
    p50: '74ms',
    p99: '210ms',
    callsToday: '1.24M',
    regions: ['us-west', 'us-east', 'eu-central'],
    status: 'healthy',
  };

  // ── API surface — resources & endpoints (D1 API Explorer) ────────────────
  const api = [
    {
      group: 'Evidence', icon: 'wallet', desc: "Read a subject's owned, verifiable evidence ledger.",
      endpoints: [
        { m: 'GET', path: '/v1/subjects/{id}/evidence', name: 'List evidence', scope: 'evidence:read',
          desc: 'Returns every evidence item on a subject ledger with its trust tier and freshness.',
          params: [['id', 'path', 'string', 'Subject identifier (NPI or vc_ id)'], ['tier', 'query', 'string', 'Filter by trust tier — T1–T4'], ['state', 'query', 'string', 'verified · pending · contradicted']],
          resp: { object: 'list', subject: 'vc_sub_1346053246', count: 14, data: [
            { object: 'evidence', id: 'ev_nccpa_9a2', label: 'Board certification', source: 'NCCPA', tier: 'T4', state: 'verified', fresh_days: 90, sealed: true },
            { object: 'evidence', id: 'ev_oig_4c1', label: 'Sanctions screen', source: 'OIG / LEIE', tier: 'T4', state: 'verified', fresh_days: 6, sealed: true }
          ], has_more: true } },
        { m: 'GET', path: '/v1/evidence/{id}', name: 'Retrieve evidence', scope: 'evidence:read',
          desc: 'Fetch a single evidence item, including its source authority and verification receipt.',
          params: [['id', 'path', 'string', 'Evidence identifier']],
          resp: { object: 'evidence', id: 'ev_nccpa_9a2', label: 'Board certification', source: 'NCCPA', authority: 'NCCPA', tier: 'T4', state: 'verified', fresh_days: 90, sealed: true, receipt: 'rcpt_7f3a91' } },
      ],
    },
    {
      group: 'Trust', icon: 'shield', desc: 'Read trust state and the published authority ladder.',
      endpoints: [
        { m: 'GET', path: '/v1/subjects/{id}/trust', name: 'Get trust state', scope: 'trust:read',
          desc: 'Returns the composite trust standing and per-lane tiers for a subject.',
          params: [['id', 'path', 'string', 'Subject identifier']],
          resp: { object: 'trust_state', subject: 'vc_sub_1346053246', score: 81, label: 'Authoritative', lanes: { identity: 'T4', sanctions: 'T4', licensure: 'T3', references: 'T2' }, projected: true } },
        { m: 'POST', path: '/v1/trust/verify', name: 'Verify a claim', scope: 'trust:verify',
          desc: 'Verify a single claim against the registry of record. Never stores; returns a receipt.',
          params: [['subject', 'body', 'string', 'Subject identifier'], ['claim', 'body', 'string', 'Claim type, e.g. licensure.ca']],
          resp: { object: 'verification', id: 'vrf_3d8c', claim: 'licensure.ca', result: 'verified', tier: 'T3', receipt: 'rcpt_aa19c2', expires: '2026-09-23' } },
      ],
    },
    {
      group: 'Recognition', icon: 'badge', desc: 'Issue and read portable recognition.',
      endpoints: [
        { m: 'POST', path: '/v1/recognition', name: 'Issue recognition', scope: 'recognition:write',
          desc: 'Issue a portable, signed recognition to a subject from your organization.',
          params: [['subject', 'body', 'string', 'Recipient subject id'], ['kind', 'body', 'string', 'e.g. clinical_excellence'], ['note', 'body', 'string', 'Citation shown on the badge']],
          resp: { object: 'recognition', id: 'rec_5b2e', issuer: 'org_cedar_8f31', kind: 'clinical_excellence', issued: '2026-06-25', signed: true, badge_url: 'https://embed.vitalcv.com/badge/rec_5b2e' } },
      ],
    },
    {
      group: 'Readiness', icon: 'gauge', desc: 'Project mobility & readiness from owned evidence.',
      endpoints: [
        { m: 'GET', path: '/v1/subjects/{id}/readiness', name: 'Get readiness', scope: 'readiness:read',
          desc: 'Returns the projected Career Health score, unlocks, and reachable requisitions.',
          params: [['id', 'path', 'string', 'Subject identifier'], ['role', 'query', 'string', 'Optional target role to score against']],
          resp: { object: 'readiness', subject: 'vc_sub_1346053246', score: 68, label: 'Conditional Ready', unlocks: 2, reachable_reqs: 41, projected: true } },
      ],
    },
    {
      group: 'Organizations', icon: 'org', desc: 'Read the verified organization graph.',
      endpoints: [
        { m: 'GET', path: '/v1/organizations/{id}', name: 'Retrieve organization', scope: 'org:read',
          desc: 'Fetch a verified organization node and its standing in the trust graph.',
          params: [['id', 'path', 'string', 'Organization identifier']],
          resp: { object: 'organization', id: 'org_cedar_8f31', name: 'Cedar Health System', verified: true, kind: 'employer', members: 312, connected_since: '2025-02-01' } },
      ],
    },
  ];

  // ── SDKs (D1) ─────────────────────────────────────────────────────────────
  const sdks = [
    { id: 'ts', lang: 'TypeScript / Node', pkg: '@vitalcv/sdk', install: 'npm install @vitalcv/sdk', version: '3.2.0', state: 'ga', icon: 'code', downloads: '48.2k/wk' },
    { id: 'py', lang: 'Python', pkg: 'vitalcv', install: 'pip install vitalcv', version: '3.1.4', state: 'ga', icon: 'terminal', downloads: '31.7k/wk' },
    { id: 'go', lang: 'Go', pkg: 'vitalcv-go', install: 'go get github.com/vitalcv/vitalcv-go', version: '2.4.0', state: 'ga', icon: 'box', downloads: '9.1k/wk' },
    { id: 'rb', lang: 'Ruby', pkg: 'vitalcv', install: 'gem install vitalcv', version: '2.0.1', state: 'beta', icon: 'cube', downloads: '2.3k/wk' },
    { id: 'php', lang: 'PHP', pkg: 'vitalcv/vitalcv-php', install: 'composer require vitalcv/vitalcv-php', version: '1.6.0', state: 'beta', icon: 'code', downloads: '1.4k/wk' },
    { id: 'cli', lang: 'CLI', pkg: 'vitalcv-cli', install: 'brew install vitalcv', version: '1.2.0', state: 'ga', icon: 'terminal', downloads: '5.8k/wk' },
  ];

  // ── auth scopes (D1) ──────────────────────────────────────────────────────
  const scopes = [
    { scope: 'evidence:read', desc: 'Read evidence ledgers and verification receipts', sensitivity: 'standard' },
    { scope: 'trust:read', desc: 'Read trust state and authority tiers', sensitivity: 'standard' },
    { scope: 'trust:verify', desc: 'Run a live verification against a registry of record', sensitivity: 'elevated' },
    { scope: 'recognition:write', desc: 'Issue portable recognition from your organization', sensitivity: 'elevated' },
    { scope: 'readiness:read', desc: 'Read projected readiness and mobility', sensitivity: 'standard' },
    { scope: 'org:read', desc: 'Read the verified organization graph', sensitivity: 'standard' },
    { scope: 'webhooks:manage', desc: 'Create and manage webhook endpoints', sensitivity: 'elevated' },
  ];

  // ── example integrations (D1) ─────────────────────────────────────────────
  const recipes = [
    { id: 'r1', title: 'Verify a clinician at onboarding', tag: 'Credentialing', icon: 'check',
      desc: 'Resolve an NPI, pull the owned evidence ledger, and gate activation on T3+ trust — no document collection.', langs: ['TS', 'Python'], time: '~15 min' },
    { id: 'r2', title: 'Sync evidence into your ATS', tag: 'Recruiting', icon: 'refresh',
      desc: 'Subscribe to evidence.updated and keep candidate records fresh against primary sources automatically.', langs: ['TS', 'Go'], time: '~30 min' },
    { id: 'r3', title: 'Embed a recognition badge', tag: 'Embeds', icon: 'badge',
      desc: 'Issue signed recognition and drop a portable, verifiable badge into your intranet or careers page.', langs: ['HTML'], time: '~5 min' },
    { id: 'r4', title: 'Readiness-gated job board', tag: 'Mobility', icon: 'gauge',
      desc: 'Score applicants against a target role and surface only the unlocks that stand between them and the req.', langs: ['TS', 'Python'], time: '~45 min' },
  ];

  // ── ecosystem (D2) ──────────────────────────────────────────────────────
  const orgs = [
    { id: 'cedar', name: 'Cedar Health System', kind: 'Employer', members: 312, status: 'active', since: 'Feb 2025', scopes: 'evidence · trust · readiness' },
    { id: 'irm', name: 'Irvine Regional Medical Group', kind: 'Employer', members: 88, status: 'active', since: 'Jan 2025', scopes: 'evidence · trust' },
    { id: 'ucla', name: 'UCLA Medical Center', kind: 'Training', members: 540, status: 'active', since: 'Mar 2025', scopes: 'evidence · org' },
    { id: 'oc', name: 'OC Medical Center', kind: 'Employer', members: 145, status: 'pending', since: '—', scopes: 'requested: evidence' },
  ];

  const partners = [
    { id: 'nccpa', name: 'NCCPA', cat: 'Certifying authority', verified: true, blurb: 'Primary-sealed PA-C certification source.', integrations: 1 },
    { id: 'cms', name: 'CMS · NPPES / PECOS', cat: 'Federal registry', verified: true, blurb: 'Identity & Medicare enrollment of record.', integrations: 2 },
    { id: 'oig', name: 'HHS-OIG', cat: 'Sanctions authority', verified: true, blurb: 'LEIE exclusion screening, monthly dataset.', integrations: 1 },
    { id: 'workday', name: 'Workday', cat: 'HR platform', verified: true, blurb: 'Bi-directional evidence sync for HRIS.', integrations: 3 },
    { id: 'epic', name: 'Epic', cat: 'EHR', verified: true, blurb: 'Provider directory enrichment.', integrations: 2 },
  ];

  const integrations = [
    { id: 'i1', name: 'Workday Credentialing Sync', vendor: 'Workday', status: 'installed', scopes: 'evidence:read · org:read', installed: 'Apr 2026', events: '4 webhooks' },
    { id: 'i2', name: 'Epic Provider Directory', vendor: 'Epic', status: 'installed', scopes: 'evidence:read · trust:read', installed: 'Mar 2026', events: '2 webhooks' },
    { id: 'i3', name: 'Greenhouse ATS Connector', vendor: 'Greenhouse', status: 'review', scopes: 'evidence:read · readiness:read', installed: '—', events: 'pending review' },
  ];

  const apps = [
    { id: 'app1', name: 'Cedar Onboarding Bot', owner: 'Internal · Platform team', env: 'live', keys: 2, calls: '412k/mo', created: 'Feb 2026' },
    { id: 'app2', name: 'Readiness Dashboard', owner: 'Internal · People Analytics', env: 'live', keys: 1, calls: '88k/mo', created: 'Mar 2026' },
    { id: 'app3', name: 'Badge Embed Service', owner: 'Internal · Comms', env: 'live', keys: 1, calls: '1.2M/mo', created: 'Jan 2026' },
    { id: 'app4', name: 'Recruiter Sandbox', owner: 'Maya Lin', env: 'sandbox', keys: 1, calls: '—', created: 'Jun 2026' },
  ];

  // ── webhook events (D3) ───────────────────────────────────────────────────
  const events = [
    { type: 'evidence.updated', icon: 'wallet', desc: 'An evidence item changed state, refreshed, or was contradicted.', subscribed: true,
      sample: { id: 'evt_9a2c', type: 'evidence.updated', created: '2026-06-25T14:02:11Z', data: { object: 'evidence', id: 'ev_oig_4c1', subject: 'vc_sub_1346053246', state: 'verified', tier: 'T4', fresh_days: 0 } } },
    { type: 'recognition.issued', icon: 'badge', desc: 'A portable recognition was issued to a subject.', subscribed: true,
      sample: { id: 'evt_5b2e', type: 'recognition.issued', created: '2026-06-25T13:40:00Z', data: { object: 'recognition', id: 'rec_5b2e', issuer: 'org_cedar_8f31', kind: 'clinical_excellence', signed: true } } },
    { type: 'trust.changed', icon: 'shield', desc: 'A subject trust lane moved between tiers.', subscribed: true,
      sample: { id: 'evt_7d11', type: 'trust.changed', created: '2026-06-25T11:18:42Z', data: { object: 'trust_state', subject: 'vc_sub_1346053246', lane: 'licensure', from: 'T2', to: 'T3' } } },
    { type: 'organization.joined', icon: 'org', desc: 'A subject connected to or left a verified organization.', subscribed: false,
      sample: { id: 'evt_2f8a', type: 'organization.joined', created: '2026-06-24T09:05:00Z', data: { object: 'edge', subject: 'vc_sub_1346053246', organization: 'org_cedar_8f31', relation: 'employer' } } },
    { type: 'career.milestone', icon: 'flag', desc: 'A readiness threshold or career milestone was reached.', subscribed: false,
      sample: { id: 'evt_c4d0', type: 'career.milestone', created: '2026-06-23T16:22:10Z', data: { object: 'readiness', subject: 'vc_sub_1346053246', milestone: 'conditional_ready', score: 68 } } },
  ];

  const endpoints = [
    { id: 'wh1', url: 'https://hooks.cedarhealth.org/vitalcv', status: 'live', events: 3, lastDelivery: '2m ago', successRate: '99.7%' },
    { id: 'wh2', url: 'https://ats.cedar-recruiting.com/api/vc-events', status: 'live', events: 2, lastDelivery: '11m ago', successRate: '98.1%' },
    { id: 'wh3', url: 'https://staging.cedarhealth.org/vc-hook', status: 'degraded', events: 5, lastDelivery: '1h ago', successRate: '84.0%' },
  ];

  const deliveries = [
    { id: 'd1', event: 'evidence.updated', endpoint: 'hooks.cedarhealth.org', code: 200, status: 'delivered', when: '2m ago', ms: '142ms' },
    { id: 'd2', event: 'recognition.issued', endpoint: 'hooks.cedarhealth.org', code: 200, status: 'delivered', when: '14m ago', ms: '88ms' },
    { id: 'd3', event: 'trust.changed', endpoint: 'ats.cedar-recruiting.com', code: 200, status: 'delivered', when: '31m ago', ms: '203ms' },
    { id: 'd4', event: 'evidence.updated', endpoint: 'staging.cedarhealth.org', code: 503, status: 'retrying', when: '1h ago', ms: 'timeout' },
    { id: 'd5', event: 'evidence.updated', endpoint: 'staging.cedarhealth.org', code: 500, status: 'failed', when: '1h ago', ms: 'timeout' },
    { id: 'd6', event: 'trust.changed', endpoint: 'hooks.cedarhealth.org', code: 200, status: 'delivered', when: '2h ago', ms: '120ms' },
  ];

  // ── API keys (D4) ───────────────────────────────────────────────────────
  const keys = [
    { id: 'k1', name: 'Production · Onboarding Bot', prefix: 'vck_live_8f31a2', env: 'live', scopes: ['evidence:read', 'trust:verify'], created: 'Feb 12, 2026', lastUsed: '2 minutes ago', status: 'active' },
    { id: 'k2', name: 'Production · Badge Service', prefix: 'vck_live_3d77c9', env: 'live', scopes: ['recognition:write'], created: 'Jan 04, 2026', lastUsed: '8 minutes ago', status: 'active' },
    { id: 'k3', name: 'Readiness Dashboard', prefix: 'vck_live_b1e4f0', env: 'live', scopes: ['readiness:read', 'evidence:read'], created: 'Mar 21, 2026', lastUsed: '1 hour ago', status: 'active' },
    { id: 'k4', name: 'Recruiter Sandbox', prefix: 'vck_test_aa19c2', env: 'sandbox', scopes: ['evidence:read'], created: 'Jun 02, 2026', lastUsed: 'Yesterday', status: 'test' },
    { id: 'k5', name: 'Legacy import (deprecated)', prefix: 'vck_live_0042bd', env: 'live', scopes: ['evidence:read'], created: 'Nov 08, 2025', lastUsed: '40 days ago', status: 'revoked' },
  ];

  const audit = [
    { id: 'au1', action: 'key.used', key: 'vck_live_8f31a2', actor: 'Onboarding Bot', when: '2 min ago', detail: 'evidence:read · 200', tone: 'verified' },
    { id: 'au2', action: 'key.created', key: 'vck_test_aa19c2', actor: 'Maya Lin', when: 'Jun 02', detail: 'sandbox · evidence:read', tone: 'verified' },
    { id: 'au3', action: 'key.rotated', key: 'vck_live_3d77c9', actor: 'Platform team', when: 'May 18', detail: 'rotated · 24h grace window', tone: 'pending' },
    { id: 'au4', action: 'key.revoked', key: 'vck_live_0042bd', actor: 'Sarah Okonkwo', when: 'May 14', detail: 'manual revoke · legacy import', tone: 'failed' },
    { id: 'au5', action: 'scope.granted', key: 'vck_live_8f31a2', actor: 'Sarah Okonkwo', when: 'Apr 30', detail: '+ trust:verify (elevated)', tone: 'pending' },
  ];

  // ── embeds / widgets (D5) ─────────────────────────────────────────────────
  const widgets = [
    { id: 'career-card', name: 'Career Card', icon: 'wallet', desc: 'A subject snapshot — verified credentials, trust standing, freshness.', sizes: ['md', 'lg'], defaultSize: 'lg' },
    { id: 'recognition-badge', name: 'Recognition Badge', icon: 'badge', desc: 'A signed, portable recognition that links back to its receipt.', sizes: ['sm', 'md'], defaultSize: 'md' },
    { id: 'readiness-widget', name: 'Readiness Widget', icon: 'gauge', desc: 'The projected Career Health score and reachable opportunities.', sizes: ['sm', 'md', 'lg'], defaultSize: 'md' },
    { id: 'org-verify', name: 'Organization Verification', icon: 'shield', desc: 'A trust mark proving an organization is verified on VitalCV.', sizes: ['sm', 'md'], defaultSize: 'md' },
  ];

  window.PLAT = { meta, platform, api, sdks, scopes, recipes, orgs, partners, integrations, apps, events, endpoints, deliveries, keys, audit, widgets };
})();
