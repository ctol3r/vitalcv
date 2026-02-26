#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Config
# -----------------------------
DEFAULT_BASE="feature/marketing-gateway"
FALLBACK_BASE="main"

log() { printf "\n\033[1;36m%s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m%s\033[0m\n" "$*"; }
die() { printf "\n\033[1;31m%s\033[0m\n" "$*"; exit 1; }

ensure_repo_root() {
  git rev-parse --show-toplevel >/dev/null 2>&1 || die "Not a git repo. Run from repo root."
}

pick_base_branch() {
  local base="${BASE_BRANCH:-$DEFAULT_BASE}"

  git fetch origin --quiet || true

  if git show-ref --verify --quiet "refs/remotes/origin/${base}"; then
    echo "$base"
    return
  fi

  warn "Base branch '${base}' not found on origin; falling back to '${FALLBACK_BASE}'."
  if git show-ref --verify --quiet "refs/remotes/origin/${FALLBACK_BASE}"; then
    echo "$FALLBACK_BASE"
    return
  fi

  die "Could not find '${base}' or '${FALLBACK_BASE}' on origin."
}

checkout_base() {
  local base="$1"
  log "Checking out base branch: ${base}"
  git checkout -q "$base" 2>/dev/null || git checkout -q -b "$base" "origin/$base"
  git pull -q origin "$base" || true
}

create_branch() {
  local branch="$1"
  log "Switching to branch: ${branch}"
  if git show-ref --verify --quiet "refs/heads/${branch}"; then
    git checkout -q "${branch}"
  else
    git checkout -q -b "${branch}"
  fi
}

commit_and_push() {
  local msg="$1"
  if git diff --cached --quiet; then
    warn "No staged changes — nothing to commit."
    return 0
  fi
  git commit -m "$msg"
  git push -u origin HEAD
}

run_optional_checks() {
  if command -v pnpm >/dev/null 2>&1; then
    log "Running optional web checks (won't abort on pre-existing failures)..."
    pnpm turbo lint --filter=@vitalcv/web || warn "Lint failed (may be pre-existing)."
    pnpm turbo build --filter=@vitalcv/web || warn "Build failed (may be pre-existing)."
  else
    warn "pnpm not found — skipping build/lint."
  fi
}

# -----------------------------
# Wave A — Acceptance Network section on homepage
# -----------------------------
wave_a() {
  local base
  base="$(pick_base_branch)"
  checkout_base "$base"
  create_branch "wave-a-acceptance-network"

  log "Creating component: apps/web/components/marketing/AcceptanceNetwork.tsx"
  mkdir -p apps/web/components/marketing

  cat > apps/web/components/marketing/AcceptanceNetwork.tsx << 'TSX'
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Mode = 'clinician' | 'employer' | 'issuer';

const MODES: { key: Mode; label: string; blurb: string }[] = [
  { key: 'clinician', label: 'Clinician', blurb: 'Carry your verified artifacts anywhere.' },
  { key: 'employer', label: 'Employer / Verifier', blurb: 'Validate faster without repeating PSV.' },
  { key: 'issuer', label: 'Issuer', blurb: 'Issue trusted records that travel cleanly.' },
];

export default function AcceptanceNetwork() {
  const [mode, setMode] = useState<Mode>('clinician');

  const content = useMemo(() => {
    switch (mode) {
      case 'clinician':
        return {
          title: 'The Acceptance Network',
          subtitle:
            'VitalCV is a credential wallet that gets stronger every time an employer accepts an artifact.',
          steps: [
            { h: 'Upload once', p: 'Keep your credential record current in one place.' },
            { h: 'Generate artifacts', p: 'Audit-ready bundles with timestamps and provenance.' },
            { h: 'Share anywhere', p: 'Employers accept or independently cross-check.' },
          ],
          proof: [
            'Portable credential artifacts',
            'Share links with controlled visibility',
            'Acceptance receipts build trust over time',
          ],
        };
      case 'employer':
        return {
          title: 'The Acceptance Network',
          subtitle:
            'Stop restarting verification. Validate artifacts, request gaps, and accelerate time-to-start.',
          steps: [
            { h: 'Receive artifact', p: 'Candidate shares a verifier-ready bundle.' },
            { h: 'Validate instantly', p: 'Check authenticity, timestamps, and provenance.' },
            { h: 'Accept or request', p: 'Accept, conditionally accept, or request missing items.' },
          ],
          proof: [
            'Less redundant PSV',
            'Cleaner audit narrative per credential',
            'Faster onboarding decisions',
          ],
        };
      case 'issuer':
        return {
          title: 'The Acceptance Network',
          subtitle:
            'Issuers create records that can be validated and reused—without rework across every employer.',
          steps: [
            { h: 'Issue record', p: 'Structured credential records with clear provenance.' },
            { h: 'Attach to artifacts', p: 'Issued records appear inside portable bundles.' },
            { h: 'Verifier acceptance', p: 'Employers validate without manual back-and-forth.' },
          ],
          proof: [
            'Cleaner issuance workflows',
            'Reduced downstream confusion',
            'Higher trust with less friction',
          ],
        };
      default:
        return null;
    }
  }, [mode]);

  if (!content) return null;

  return (
    <section className="px-6 py-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {content.title}
            </h2>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground">
              {content.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={[
                  'px-4 py-2 rounded-full border text-sm transition',
                  mode === m.key ? 'bg-foreground text-background' : 'hover:bg-muted',
                ].join(' ')}
                aria-pressed={mode === m.key}
                title={m.blurb}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {content.steps.map((s) => (
            <div key={s.h} className="p-8 rounded-3xl border hover:shadow-xl transition">
              <div className="text-2xl font-semibold">{s.h}</div>
              <div className="mt-3 text-muted-foreground text-lg">{s.p}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="p-8 rounded-3xl border bg-muted/50">
            <div className="text-xl font-semibold">Why this becomes a moat</div>
            <ul className="mt-4 space-y-2 text-lg text-muted-foreground">
              {content.proof.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </div>

          <div className="p-8 rounded-3xl border">
            <div className="text-xl font-semibold">Do something now</div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <a
                href="#pilot"
                className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-lg font-medium hover:opacity-90 transition text-center"
              >
                Request Pilot
              </a>
              <Link
                href="/verifier"
                className="px-6 py-3 rounded-2xl border text-lg font-medium hover:bg-muted transition text-center"
              >
                Open Verifier Portal
              </Link>
            </div>
            <p className="mt-4 text-muted-foreground">
              The network grows when verifiers accept artifacts instead of restarting verification.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
TSX

  local page="apps/web/app/page.tsx"
  [[ -f "$page" ]] || die "Missing ${page}. Expected Next.js app router homepage."

  log "Patching homepage to import + render <AcceptanceNetwork /> and ensure #pilot anchor..."
  python3 - << 'PY'
import re
from pathlib import Path

page = Path("apps/web/app/page.tsx")
text = page.read_text(encoding="utf-8")

if "AcceptanceNetwork" not in text:
    # Pick import style based on whether @/ alias appears in existing imports
    use_alias = bool(re.search(r'from\s+[\'"]@\/', text))
    import_line = (
        'import AcceptanceNetwork from "@/components/marketing/AcceptanceNetwork";\n'
        if use_alias
        else 'import AcceptanceNetwork from "../components/marketing/AcceptanceNetwork";\n'
    )

    # Insert import after last import
    imports = list(re.finditer(r'^\s*import\s+.*?;\s*$', text, flags=re.M))
    if imports:
        idx = imports[-1].end()
        text = text[:idx] + "\n" + import_line + text[idx:]
    else:
        text = import_line + text

    # Insert render before "Portal Access" section markers, otherwise before </main>
    inserted = False
    markers = [
        r"\{\s*/\*\s*PORTAL ACCESS\s*\*/\s*\}",
        r"Access Your Portal",
        r"Portal Access",
        r"PORTAL\s+ACCESS",
    ]
    for pat in markers:
        m = re.search(pat, text)
        if m:
            line_start = text.rfind("\n", 0, m.start()) + 1
            text = text[:line_start] + "      <AcceptanceNetwork />\n\n" + text[line_start:]
            inserted = True
            break
    if not inserted:
        m = re.search(r"</main>", text)
        if m:
            line_start = text.rfind("\n", 0, m.start()) + 1
            text = text[:line_start] + "      <AcceptanceNetwork />\n\n" + text[line_start:]

# Ensure pilot anchor exists near RequestPilotForm if present
if "RequestPilotForm" in text and 'id="pilot"' not in text:
    m = re.search(r"(<RequestPilotForm\b)", text)
    if m:
        line_start = text.rfind("\n", 0, m.start()) + 1
        text = text[:line_start] + '      <div id="pilot" />\n' + text[line_start:]

page.write_text(text, encoding="utf-8")
PY

  git add apps/web/components/marketing/AcceptanceNetwork.tsx apps/web/app/page.tsx
  commit_and_push "feat(marketing): add Acceptance Network section (wallet + verifier marketplace)"
  run_optional_checks

  log "✅ Wave A complete."
  echo ""
  echo "Next commands:"
  echo "  bash ./.vitalcv_waves.sh b   # Wave B (Apply-with-VitalCV widget demo)"
  echo "  bash ./.vitalcv_waves.sh c   # Wave C (Verifier inbox marketplace UX)"
  echo "  bash ./.vitalcv_waves.sh d   # Wave D (Dynamic role-based checklist)"
  echo ""
}

# -----------------------------
# Wave B — Apply-with-VitalCV widget demo (new routes, low risk)
# -----------------------------
wave_b() {
  local base
  base="$(pick_base_branch)"
  checkout_base "$base"
  create_branch "wave-b-apply-widget"

  log "Creating widget route: /widget/apply"
  mkdir -p apps/web/app/widget/apply
  cat > apps/web/app/widget/apply/page.tsx << 'TSX'
'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ApplyWidgetPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const params = useMemo(() => {
    return {
      org: sp.get('org') || 'demo',
      job_id: sp.get('job_id') || 'job:demo:001',
      role: sp.get('role') || 'Clinician',
      return_url: sp.get('return_url') || '',
      parent_origin: sp.get('parent_origin') || '',
    };
  }, [sp]);

  const continueUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com';
    const u = new URL('/demo', base);
    u.searchParams.set('intent', 'apply');
    u.searchParams.set('org', params.org);
    u.searchParams.set('job_id', params.job_id);
    u.searchParams.set('role', params.role);
    if (params.return_url) u.searchParams.set('return_url', params.return_url);
    return u.pathname + u.search;
  }, [params]);

  function handleContinue() {
    try {
      const inIframe = window.self !== window.top;
      if (inIframe) {
        const target = params.parent_origin || '*';
        window.parent.postMessage(
          { type: 'vitalcv:apply', payload: { ...params, url: continueUrl } },
          target
        );
      }
    } catch {
      // ignore
    }
    router.push(continueUrl);
  }

  return (
    <main className="min-h-[240px] bg-background text-foreground p-4">
      <div className="max-w-md mx-auto border rounded-3xl p-6 shadow-sm">
        <div className="text-sm text-muted-foreground">Apply with VitalCV</div>
        <h1 className="text-2xl font-semibold mt-1">Fast-track credential sharing</h1>
        <p className="mt-3 text-muted-foreground">
          Create a portable, verifier-ready artifact bundle you can reuse across employers.
        </p>

        <div className="mt-5 text-sm text-muted-foreground space-y-1">
          <div><span className="font-medium text-foreground">Org:</span> {params.org}</div>
          <div><span className="font-medium text-foreground">Job:</span> {params.job_id}</div>
        </div>

        <button
          onClick={handleContinue}
          className="mt-6 w-full px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
        >
          Continue
        </button>

        <p className="mt-3 text-xs text-muted-foreground">
          Employers can validate your artifacts without restarting the verification loop.
        </p>
      </div>
    </main>
  );
}
TSX

  log "Creating playground route: /integrations/apply-with-vitalcv"
  mkdir -p apps/web/app/integrations/apply-with-vitalcv
  cat > apps/web/app/integrations/apply-with-vitalcv/page.tsx << 'TSX'
'use client';

import { useMemo, useState } from 'react';

export default function ApplyWithVitalCVPlayground() {
  const [org, setOrg] = useState('demo-pilot-org-alpha');
  const [jobId, setJobId] = useState('job:demo:001');
  const [returnUrl, setReturnUrl] = useState('https://example.com/thanks');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com';

  const src = useMemo(() => {
    const u = new URL('/widget/apply', origin);
    u.searchParams.set('org', org);
    u.searchParams.set('job_id', jobId);
    u.searchParams.set('return_url', returnUrl);
    return u.toString();
  }, [origin, org, jobId, returnUrl]);

  const snippet = useMemo(() => {
    const esc = (s: string) => s.replace(/"/g, '&quot;');
    return `<iframe
  src="${esc(src)}"
  style="width:100%;max-width:420px;height:280px;border:0;border-radius:24px;overflow:hidden"
  loading="lazy"
  title="Apply with VitalCV"
></iframe>`;
  }, [src]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      alert('Embed snippet copied ✅');
    } catch {
      alert('Copy failed — select and copy manually.');
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-semibold">Apply with VitalCV</h1>
        <p className="mt-3 text-muted-foreground text-lg">
          A lightweight embed employers can place on job pages to route candidates into VitalCV with intent preserved.
        </p>

        <div className="mt-10 grid lg:grid-cols-2 gap-8">
          <div className="p-8 border rounded-3xl">
            <div className="text-xl font-semibold">Configure</div>

            <label className="block mt-5 text-sm text-muted-foreground">Org</label>
            <input
              className="mt-2 w-full px-4 py-3 border rounded-2xl bg-background"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />

            <label className="block mt-5 text-sm text-muted-foreground">Job ID</label>
            <input
              className="mt-2 w-full px-4 py-3 border rounded-2xl bg-background"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />

            <label className="block mt-5 text-sm text-muted-foreground">Return URL</label>
            <input
              className="mt-2 w-full px-4 py-3 border rounded-2xl bg-background"
              value={returnUrl}
              onChange={(e) => setReturnUrl(e.target.value)}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={copy}
                className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
              >
                Copy Embed Snippet
              </button>
            </div>

            <pre className="mt-6 p-4 rounded-2xl bg-muted overflow-auto text-xs">
{snippet}
            </pre>
          </div>

          <div className="p-8 border rounded-3xl">
            <div className="text-xl font-semibold">Preview</div>
            <div className="mt-5">
              <iframe
                src={src}
                style={{ width: '100%', maxWidth: 420, height: 280, border: 0, borderRadius: 24, overflow: 'hidden' }}
                title="Apply with VitalCV Preview"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
TSX

  git add apps/web/app/widget apps/web/app/integrations
  commit_and_push "feat(widget): add Apply-with-VitalCV embed demo + playground"
  run_optional_checks
  log "✅ Wave B complete."
}

# -----------------------------
# Wave C — Verifier inbox marketplace UX (new route; low risk)
# -----------------------------
wave_c() {
  local base
  base="$(pick_base_branch)"
  checkout_base "$base"
  create_branch "wave-c-verifier-inbox"

  log "Creating verifier inbox route: /verifier/inbox"
  mkdir -p apps/web/app/verifier/inbox

  cat > apps/web/app/verifier/inbox/page.tsx << 'TSX'
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Band = 'GREEN' | 'YELLOW' | 'RED';
type Item = {
  id: string;
  clinician: string;
  role: string;
  band: Band;
  updatedAt: string;
  summary: string;
};

const SEED: Item[] = [
  { id: 'art:001', clinician: 'NPI 1003000126', role: 'Physician', band: 'GREEN', updatedAt: 'Just now', summary: 'License + board current. Sanctions clear.' },
  { id: 'art:002', clinician: 'NPI 1999999999', role: 'NP', band: 'YELLOW', updatedAt: '2h ago', summary: 'License current. DEA missing.' },
  { id: 'art:003', clinician: 'NPI 1888888888', role: 'PA', band: 'RED', updatedAt: '1d ago', summary: 'License expired. Requires remediation.' },
];

function bandPill(b: Band) {
  const base = 'inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium';
  if (b === 'GREEN') return <span className={base}>GREEN</span>;
  if (b === 'YELLOW') return <span className={base}>YELLOW</span>;
  return <span className={base}>RED</span>;
}

export default function VerifierInbox() {
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState(SEED[0].id);
  const [decision, setDecision] = useState<Record<string, 'Accepted' | 'Conditional' | 'Requested' | 'None'>>({});

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return SEED.filter((i) => !qq || (i.clinician + ' ' + i.role + ' ' + i.summary).toLowerCase().includes(qq));
  }, [q]);

  const active = useMemo(() => list.find((i) => i.id === activeId) || list[0], [list, activeId]);

  function act(kind: 'Accepted' | 'Conditional' | 'Requested') {
    if (!active) return;
    setDecision((d) => ({ ...d, [active.id]: kind }));
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold">Verifier Inbox</h1>
            <p className="mt-2 text-muted-foreground text-lg">
              Validate artifacts, accept faster, and stop restarting verification loops.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/verifier" className="px-5 py-3 rounded-2xl border hover:bg-muted transition">
              Back to Verifier
            </Link>
            <Link href="/demo" className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 transition">
              Try Demo Flow
            </Link>
          </div>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1 p-6 border rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-semibold">Incoming</div>
              <div className="text-sm text-muted-foreground">{list.length} items</div>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by NPI, role, status…"
              className="mt-4 w-full px-4 py-3 border rounded-2xl bg-background"
            />
            <div className="mt-5 space-y-3">
              {list.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setActiveId(i.id)}
                  className={[
                    'w-full text-left p-4 rounded-2xl border hover:bg-muted transition',
                    active?.id === i.id ? 'bg-muted' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{i.clinician}</div>
                    {bandPill(i.band)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{i.role} • {i.updatedAt}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{i.summary}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 p-8 border rounded-3xl">
            {!active ? (
              <div className="text-muted-foreground">Select an artifact to review.</div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Artifact</div>
                    <div className="text-3xl font-semibold mt-1">{active.id}</div>
                    <div className="mt-2 text-muted-foreground text-lg">
                      {active.clinician} • {active.role}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {bandPill(active.band)}
                    <span className="text-sm text-muted-foreground">
                      Decision: {decision[active.id] || 'None'}
                    </span>
                  </div>
                </div>

                <div className="mt-10 grid md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl border bg-muted/30">
                    <div className="text-xl font-semibold">What you're validating</div>
                    <ul className="mt-4 space-y-2 text-muted-foreground">
                      <li>• Timestamped artifact bundle</li>
                      <li>• Provenance + source links</li>
                      <li>• Clear audit narrative</li>
                      <li>• Verifier actions + receipt</li>
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl border">
                    <div className="text-xl font-semibold">Actions</div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => act('Accepted')}
                        className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => act('Conditional')}
                        className="px-5 py-3 rounded-2xl border hover:bg-muted transition"
                      >
                        Conditional Accept
                      </button>
                      <button
                        onClick={() => act('Requested')}
                        className="px-5 py-3 rounded-2xl border hover:bg-muted transition"
                      >
                        Request Missing Items
                      </button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Next wave can wire these actions into real trust-state updates + audit logs.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
TSX

  git add apps/web/app/verifier/inbox/page.tsx
  commit_and_push "feat(verifier): add marketplace-style inbox route (UI demo)"
  run_optional_checks
  log "✅ Wave C complete."
}

# -----------------------------
# Wave D — Dynamic role-based checklist (new route; low risk)
# -----------------------------
wave_d() {
  local base
  base="$(pick_base_branch)"
  checkout_base "$base"
  create_branch "wave-d-holder-checklist"

  log "Creating simple credential catalog + checklist route: /holder/checklist"
  mkdir -p apps/web/lib/catalog apps/web/components/holder apps/web/app/holder/checklist

  cat > apps/web/lib/catalog/credentialCatalog.ts << 'TS'
export type RoleKey = 'physician' | 'nurse_practitioner' | 'physician_assistant';

export type CredentialKey =
  | 'npi'
  | 'state_license'
  | 'board_cert'
  | 'dea'
  | 'malpractice'
  | 'cv'
  | 'sanctions';

export type CredentialTemplate = {
  key: CredentialKey;
  label: string;
  required: boolean;
  description: string;
};

export const ROLE_TEMPLATES: Record<RoleKey, { label: string; items: CredentialTemplate[] }> = {
  physician: {
    label: 'Physician (MD/DO)',
    items: [
      { key: 'npi', label: 'NPI', required: true, description: 'Identity anchor for registry lookups.' },
      { key: 'state_license', label: 'State Medical License', required: true, description: 'Active + in-good-standing.' },
      { key: 'board_cert', label: 'Board Certification', required: true, description: 'Board status + expiration.' },
      { key: 'dea', label: 'DEA', required: false, description: 'If prescribing controlled substances.' },
      { key: 'malpractice', label: 'Malpractice / Claims', required: true, description: 'Coverage + claims history where applicable.' },
      { key: 'cv', label: 'Curriculum Vitae', required: true, description: 'Employment + training history.' },
      { key: 'sanctions', label: 'Sanctions Check', required: true, description: 'OIG / NPDB / exclusions screening.' },
    ],
  },
  nurse_practitioner: {
    label: 'Nurse Practitioner (NP)',
    items: [
      { key: 'npi', label: 'NPI', required: true, description: 'Identity anchor for registry lookups.' },
      { key: 'state_license', label: 'State License', required: true, description: 'Active nursing license.' },
      { key: 'board_cert', label: 'National Certification', required: true, description: 'AANP/ANCC status.' },
      { key: 'dea', label: 'DEA', required: false, description: 'If prescribing controlled substances.' },
      { key: 'malpractice', label: 'Malpractice / Claims', required: true, description: 'Coverage + claims history where applicable.' },
      { key: 'cv', label: 'Curriculum Vitae', required: true, description: 'Employment + training history.' },
      { key: 'sanctions', label: 'Sanctions Check', required: true, description: 'OIG / exclusions screening.' },
    ],
  },
  physician_assistant: {
    label: 'Physician Assistant (PA)',
    items: [
      { key: 'npi', label: 'NPI', required: true, description: 'Identity anchor for registry lookups.' },
      { key: 'state_license', label: 'State License', required: true, description: 'Active PA license.' },
      { key: 'board_cert', label: 'NCCPA Certification', required: true, description: 'Certification status + expiration.' },
      { key: 'dea', label: 'DEA', required: false, description: 'If prescribing controlled substances.' },
      { key: 'malpractice', label: 'Malpractice / Claims', required: true, description: 'Coverage + claims history where applicable.' },
      { key: 'cv', label: 'Curriculum Vitae', required: true, description: 'Employment + training history.' },
      { key: 'sanctions', label: 'Sanctions Check', required: true, description: 'OIG / exclusions screening.' },
    ],
  },
};
TS

  cat > apps/web/components/holder/RoleChecklist.tsx << 'TSX'
'use client';

import { useMemo, useState } from 'react';
import { ROLE_TEMPLATES, RoleKey } from '@/lib/catalog/credentialCatalog';

type ItemState = 'missing' | 'added' | 'verified';

export default function RoleChecklist() {
  const [role, setRole] = useState<RoleKey>('physician');
  const [state, setState] = useState<Record<string, ItemState>>({});

  const tmpl = ROLE_TEMPLATES[role];

  const stats = useMemo(() => {
    const total = tmpl.items.length;
    const verified = tmpl.items.filter((i) => state[i.key] === 'verified').length;
    const added = tmpl.items.filter((i) => state[i.key] === 'added').length;
    const done = verified + added;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, verified, added, pct };
  }, [tmpl.items, state]);

  function cycle(key: string) {
    setState((s) => {
      const cur = s[key] || 'missing';
      const next: ItemState = cur === 'missing' ? 'added' : cur === 'added' ? 'verified' : 'missing';
      return { ...s, [key]: next };
    });
  }

  return (
    <section className="px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold">Credential Checklist</h1>
            <p className="mt-2 text-muted-foreground text-lg">
              Contextual "pre-loaded" requirements for your wallet — without CIM-style centralization.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleKey)}
              className="px-4 py-3 rounded-2xl border bg-background"
              aria-label="Select role"
            >
              {Object.entries(ROLE_TEMPLATES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 p-6 border rounded-3xl">
          <div className="flex items-center justify-between gap-6">
            <div className="text-xl font-semibold">Completion</div>
            <div className="text-muted-foreground">
              {stats.pct}% • {stats.verified} verified • {stats.added} added • {stats.total - (stats.verified + stats.added)} missing
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {tmpl.items.map((i) => {
            const s = state[i.key] || 'missing';
            return (
              <button
                key={i.key}
                onClick={() => cycle(i.key)}
                className="text-left p-8 border rounded-3xl hover:shadow-xl transition"
                title="Click to cycle: missing → added → verified"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold">{i.label}</div>
                    <div className="mt-2 text-muted-foreground text-lg">{i.description}</div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      {i.required ? 'Required' : 'Optional'} • Status: <span className="font-medium text-foreground">{s.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full border text-sm">
                    {s.toUpperCase()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Next wave can wire this checklist into real trust-state + artifact generation.
        </p>
      </div>
    </section>
  );
}
TSX

  cat > apps/web/app/holder/checklist/page.tsx << 'TSX'
import RoleChecklist from '@/components/holder/RoleChecklist';

export default function HolderChecklistPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <RoleChecklist />
    </main>
  );
}
TSX

  git add apps/web/lib/catalog/credentialCatalog.ts apps/web/components/holder/RoleChecklist.tsx apps/web/app/holder/checklist/page.tsx
  commit_and_push "feat(holder): add dynamic role-based checklist route (UI scaffold)"
  run_optional_checks
  log "✅ Wave D complete."
}

usage() {
  echo "Usage: bash ./.vitalcv_waves.sh [a|b|c|d|all]"
  echo "Optional: BASE_BRANCH=feature/marketing-gateway bash ./.vitalcv_waves.sh a"
}

main() {
  ensure_repo_root
  local wave="${1:-a}"

  case "$wave" in
    a) wave_a ;;
    b) wave_b ;;
    c) wave_c ;;
    d) wave_d ;;
    all)
      wave_a
      wave_b
      wave_c
      wave_d
      ;;
    *) usage; exit 1 ;;
  esac

  echo ""
  echo "PR tip (if gh installed):"
  echo "  gh pr create --fill"
}

main "$@"
