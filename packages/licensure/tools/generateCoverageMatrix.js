/**
 * Generates docs/licensure/national-coverage-matrix.md from the registry and
 * runtime state.
 *
 * The matrix is generated rather than hand-maintained on purpose: a hand-edited
 * coverage table drifts from the code, and a coverage table that overstates the
 * code is the specific failure this program exists to prevent. Re-run after any
 * registry or runtime-state change:
 *
 *   node packages/licensure/tools/generateCoverageMatrix.js
 */

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'dist');
const { listAuthorities, UNINVENTORIED_TARGET_JURISDICTIONS } = require(path.join(dist, 'authorityRegistry.js'));
const { listRuntimeStates, countLiveRoutes } = require(path.join(dist, 'runtimeState.js'));
const { resolveDeclaredChain } = require(path.join(dist, 'sourceRouter.js'));

const COLUMNS = [
  'JURISDICTION', 'BOARD NAME', 'BOARD TYPE', 'PROFESSIONS', 'OFFICIAL URL',
  'PUBLIC SEARCH URL', 'NATIONAL ROUTE', 'DIRECT ROUTE', 'LOOKUP IDENTIFIERS',
  'DISCIPLINE AVAILABLE', 'MONITORING AVAILABLE', 'ACCESS REQUIREMENT',
  'TERMS REVIEW', 'RUNTIME STATE', 'LAST SUCCESS', 'FRESHNESS WINDOW',
  'DECISION GRADE', 'LIMITATION', 'OWNER',
];

function cell(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/\|/g, '\\|');
}

function rowsFor(authority) {
  const rows = [];

  for (const profession of authority.professions) {
    const declared = resolveDeclaredChain(authority.jurisdiction, profession)
      .filter((route) => route.authorityId === authority.authorityId);

    const national = declared.find((r) => r.routeKind === 'NATIONAL');
    const direct = declared.find((r) => r.routeKind === 'DIRECT_BOARD');
    const primary = national ?? direct ?? declared[0];
    if (!primary) continue;

    const state = listRuntimeStates().find(
      (s) => s.authorityId === authority.authorityId &&
             s.profession === profession &&
             s.routeKind === primary.routeKind,
    );

    rows.push([
      authority.jurisdiction,
      authority.boardName,
      authority.boardType,
      profession,
      authority.officialUrl,
      authority.publicSearchUrl,
      national ? `declared (${national.accessRequirement})` : 'none',
      direct ? `declared (${direct.accessRequirement})` : 'none',
      primary.lookupIdentifiers.length ? primary.lookupIdentifiers.join(' / ') : 'not established',
      primary.disciplineAvailable,
      primary.monitoringAvailable ? 'yes' : 'no',
      primary.accessRequirement,
      primary.termsReview,
      state ? state.phase : 'NO STATE',
      state && state.lastProductionSuccessAt ? state.lastProductionSuccessAt : 'never',
      `${primary.freshnessWindowHours}h`,
      'false',
      state && state.blockedReason ? state.blockedReason : authority.limitation,
      primary.owner,
    ]);
  }

  return rows;
}

const authorities = listAuthorities();
const allRows = authorities.flatMap(rowsFor);
const live = countLiveRoutes();
const jurisdictions = new Set(authorities.filter((a) => a.boardType !== 'NURSING').map((a) => a.jurisdiction));

const lines = [];
lines.push('# National U.S. Licensure Coverage Matrix');
lines.push('');
lines.push('> **GENERATED FILE — do not edit by hand.**');
lines.push('> Regenerate with `node packages/licensure/tools/generateCoverageMatrix.js`.');
lines.push('> Source of truth: `packages/licensure/src/authorityRegistry.ts` (catalog) and');
lines.push('> `packages/licensure/src/runtimeState.ts` (what can actually run).');
lines.push('');
lines.push('## Coverage summary');
lines.push('');
lines.push(`- **Authorities catalogued:** ${authorities.length}`);
lines.push(`- **Jurisdictions with an inventoried medical board:** ${jurisdictions.size}`);
lines.push(`- **Routes LIVE (permitted + credentialed + fresh production run):** ${live}`);
lines.push('');
lines.push(
  live === 0
    ? '**No licensure route is live.** Every row below is a catalog entry. VitalCV cannot currently read a licence record from any U.S. board, by any route. Cataloguing a board is not coverage of it.'
    : `${live} route(s) are live. All other rows are catalog entries only.`,
);
lines.push('');
lines.push('### Known inventory gaps');
lines.push('');
for (const gap of UNINVENTORIED_TARGET_JURISDICTIONS) {
  lines.push(`- **${gap.code}** — ${gap.reason}`);
}
lines.push('- **Physician assistants** — PA licensure authority per jurisdiction is not inventoried. The FSMB member-board directory does not publish PA scope per board.');
lines.push('- **Boards of nursing** — the individual state BONs are not inventoried; nursing is represented by the single national Nursys route.');
lines.push('- **Public search URLs** — not recorded for any board. Identifying a lawful, machine-accessible search surface is per-board diligence (wave L5).');
lines.push('');
lines.push('## Matrix');
lines.push('');
lines.push(`| ${COLUMNS.join(' | ')} |`);
lines.push(`| ${COLUMNS.map(() => '---').join(' | ')} |`);
for (const row of allRows) {
  lines.push(`| ${row.map(cell).join(' | ')} |`);
}
lines.push('');
lines.push('## Column meanings');
lines.push('');
lines.push('- **NATIONAL ROUTE / DIRECT ROUTE** — `declared` means a route is defined in the router. It does **not** mean the route can execute. Execution requires RUNTIME STATE = `LIVE`.');
lines.push('- **RUNTIME STATE** — `NOT_IMPLEMENTED` (no adapter), `BLOCKED_ON_ACCESS` (adapter exists, access unresolved), `READY_UNPROVEN` (permitted but never run in production), `LIVE`.');
lines.push('- **LAST SUCCESS** — timestamp of a successful **production** run. Fixtures and sandbox runs never write this field.');
lines.push('- **DECISION GRADE** — `false` everywhere. Promotion to decision-grade is a separate gated wave.');
lines.push('- **DISCIPLINE AVAILABLE** — `UNKNOWN` means not established. It must never render as "no discipline found".');
lines.push('');

const outPath = path.join(__dirname, '..', '..', '..', 'docs', 'licensure', 'national-coverage-matrix.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(`Wrote ${outPath}`);
console.log(`  authorities: ${authorities.length}, rows: ${allRows.length}, live routes: ${live}`);
