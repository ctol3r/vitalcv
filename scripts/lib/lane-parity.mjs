/**
 * lane-parity.mjs — do the two public source-of-truth surfaces agree? (W0.5)
 *
 * `/status` (rendered HTML) and `/api/status` (JSON) both derive from
 * `apps/web/lib/trust/sourceLanes.ts`, so they agree today. They have not
 * always: `lib/trust/register.ts` still carries the comment describing when
 * /status was a hand-written table that marked OIG `partial` and omitted PECOS
 * entirely, under-reporting two lanes /api/status already published as live.
 * Deriving both from one registry fixed it; nothing stopped it recurring.
 *
 * This is that stop. It runs against the DEPLOYED site, so it catches the
 * failure a unit test cannot: a half-deployed release where one surface ships
 * the new registry and the other is still serving cached or older output.
 *
 * The invariant is deliberately coarse — availability, not exact wording:
 *
 *   No lane may be presented as AVAILABLE on one surface and UNAVAILABLE on
 *   the other.
 *
 * Exact labels are free to change (copy gets rewritten; "Access required" may
 * become something warmer). What may never change is a buyer reading "OIG:
 * Available" on one page and "not connected" on the other. Asserting the
 * outcome rather than the wording keeps this green through honest copy edits
 * and red through real drift.
 */

/** /api/status lane statuses that mean "this lane returns real data". */
const API_AVAILABLE = new Set(['operational']);

/** Rendered /status lifecycles that mean "this lane returns real data". */
const PAGE_AVAILABLE = new Set(['active', 'partial']);

/** Every lifecycle the register may render. Anything else is a contract break. */
const KNOWN_PAGE_LIFECYCLES = new Set([
  'active',
  'partial',
  'planned',
  'unintegrated',
]);

/** Every status /api/status may publish. Anything else is a contract break. */
const KNOWN_API_STATUSES = new Set([
  'operational',
  'pending_integration',
  'non_production',
  'not_implemented',
]);

/**
 * Pull `{ laneKey: lifecycle }` out of rendered /status HTML.
 *
 * Reads the `data-lane-key` / `data-lane-lifecycle` attribute pair emitted by
 * the source-lane rows. Attribute order is not assumed — Next may emit either
 * order — so each is matched independently within one element's open tag.
 */
export function parseRenderedLanes(html) {
  const lanes = {};
  // Match any open tag carrying data-lane-key; then read both attrs from it.
  const tagPattern = /<[a-zA-Z][^>]*\sdata-lane-key=("|')(.*?)\1[^>]*>/g;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];
    const key = match[2];
    const lifecycle = tag.match(/\sdata-lane-lifecycle=("|')(.*?)\1/);
    if (key && lifecycle) lanes[key] = lifecycle[2];
  }
  return lanes;
}

/** Pull `{ laneKey: status }` out of an /api/status payload. */
export function parseApiLanes(payload) {
  const raw = payload && typeof payload === 'object' ? payload.source_lanes : null;
  if (!raw || typeof raw !== 'object') return {};
  const lanes = {};
  for (const [key, value] of Object.entries(raw)) {
    const status = value && typeof value === 'object' ? value.status : value;
    if (typeof status === 'string') lanes[key] = status;
  }
  return lanes;
}

/**
 * Compare the two surfaces.
 *
 * @returns {{ok: boolean, checked: number, problems: string[]}}
 */
export function compareLaneParity(renderedLanes, apiLanes) {
  const problems = [];
  const apiKeys = Object.keys(apiLanes);
  const renderedKeys = Object.keys(renderedLanes);

  if (apiKeys.length === 0) {
    problems.push('/api/status published no source_lanes');
  }
  if (renderedKeys.length === 0) {
    problems.push(
      '/status rendered no data-lane-key rows (page did not deploy, or the parity contract was removed)',
    );
  }

  // A lane present on one surface and absent from the other is drift too —
  // that is precisely how PECOS went missing from /status historically.
  for (const key of apiKeys) {
    if (!(key in renderedLanes)) {
      problems.push(`${key}: in /api/status but not rendered on /status`);
    }
  }
  for (const key of renderedKeys) {
    if (!(key in apiLanes)) {
      problems.push(`${key}: rendered on /status but absent from /api/status`);
    }
  }

  let checked = 0;
  for (const key of apiKeys) {
    const apiStatus = apiLanes[key];
    const pageLifecycle = renderedLanes[key];
    if (pageLifecycle === undefined) continue;

    if (!KNOWN_API_STATUSES.has(apiStatus)) {
      problems.push(`${key}: unknown /api/status status "${apiStatus}"`);
      continue;
    }
    if (!KNOWN_PAGE_LIFECYCLES.has(pageLifecycle)) {
      problems.push(`${key}: unknown /status lifecycle "${pageLifecycle}"`);
      continue;
    }

    checked += 1;
    const apiAvailable = API_AVAILABLE.has(apiStatus);
    const pageAvailable = PAGE_AVAILABLE.has(pageLifecycle);
    if (apiAvailable !== pageAvailable) {
      problems.push(
        `${key}: /api/status "${apiStatus}" (${apiAvailable ? 'available' : 'unavailable'}) ` +
          `disagrees with /status "${pageLifecycle}" (${pageAvailable ? 'available' : 'unavailable'})`,
      );
    }
  }

  return { ok: problems.length === 0, checked, problems };
}
