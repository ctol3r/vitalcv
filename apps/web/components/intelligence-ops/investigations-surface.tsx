'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OperationsShell } from './shell';
import { EntityLink, OpsBadge, OpsCard, SurfaceBanner, severityTone } from './primitives';
import { CopilotSearchBar } from '@/components/copilot/CopilotSearchBar';
import { EvidenceViewerPanel } from './evidence-viewer-panel';
import { NODE_COLORS, getNodeColor } from '@/components/graph-system/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkbenchEvidenceItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
}

interface WorkbenchFindingContext {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  explanation: string;
  confidence: number;
  priorityScore: number;
  evidence: WorkbenchEvidenceItem[];
  actions: Array<{ id: string; label: string; type: string }>;
  relatedFindingIds: string[];
  storylineId: string | null;
  storylineTitle: string | null;
  npis: string[];
  createdAt: string;
}

interface WorkbenchStorylineContext {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  narrative: string;
  whyItMatters: string;
  findingCount: number;
  entityCount: number;
  confidence: number;
  progressionScore: number;
  recommendedActions: string[];
  lastActivityAt: string;
  evidence: WorkbenchEvidenceItem[];
}

interface WorkbenchProviderContext {
  npi: string;
  label: string | null;
  specialty: string | null;
  state: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence: number;
  activeFindings: number;
}

interface WorkbenchRelatedFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  summary: string;
  priorityScore: number;
  href: string;
}

interface WorkbenchNavigation {
  graphHref: string;
  copilotHref: string;
  investigationHref: string;
}

interface WorkbenchContext {
  anchor: { npi?: string; findingId?: string; storylineId?: string };
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  relatedFindings: WorkbenchRelatedFinding[];
  navigation: WorkbenchNavigation | null;
  generatedAt: string;
  error?: string;
}

// ── Investigation State (lightweight, no external deps) ───────────────────────

interface InvState {
  npi: string | null;
  findingId: string | null;
  storylineId: string | null;
  evidenceIdx: number;
  copilotCollapsed: boolean;
  evidenceCollapsed: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceBar(confidence: number) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-slate-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
    </div>
  );
}

function trustBandTone(band: string): 'success' | 'warning' | 'critical' | 'neutral' {
  switch (band?.toUpperCase()) {
    case 'HIGH': case 'L3': return 'success';
    case 'MEDIUM': case 'L2': return 'neutral';
    case 'LOW': case 'L1': return 'warning';
    case 'CRITICAL': case 'L0': return 'critical';
    default: return 'neutral';
  }
}

// ── Left Panel: Findings Inbox ────────────────────────────────────────────────

function FindingsInbox({
  findings,
  selectedId,
  onSelect,
}: {
  findings: WorkbenchRelatedFinding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <p className="shrink-0 px-3 py-2 text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">
        Findings ({findings.length})
      </p>
      <div className="flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {findings.length === 0 ? (
          <p className="px-2 py-4 text-xs text-[var(--vt-text-3)]">No findings for this provider.</p>
        ) : null}
        {findings.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`w-full rounded-xl border p-2.5 text-left transition ${
              selectedId === f.id
                ? 'border-cyan-400/50 bg-cyan-400/5'
                : 'border-[var(--vt-border)] hover:border-[var(--vt-text-3)]/30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <OpsBadge label={f.severity} tone={severityTone(f.severity)} />
              <span className="text-[10px] text-[var(--vt-text-3)]">{f.findingType.replace(/_/g, ' ')}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-medium text-[var(--vt-text-1)]">{f.title}</p>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--vt-text-3)]">{f.summary}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Center Top: Provider Investigation Panel ──────────────────────────────────

function ProviderInvestigationPanel({
  provider,
  finding,
  storyline,
  navigation,
}: {
  provider: WorkbenchProviderContext | null;
  finding: WorkbenchFindingContext | null;
  storyline: WorkbenchStorylineContext | null;
  navigation: WorkbenchNavigation | null;
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* Provider header */}
      {provider ? (
        <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">
                {provider.label ?? `Provider ${provider.npi}`}
              </h3>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--vt-text-3)]">
                {provider.specialty ? <span>{provider.specialty}</span> : null}
                {provider.state ? <span>{provider.state}</span> : null}
                <span>NPI {provider.npi}</span>
                <span>{provider.activeFindings} active finding{provider.activeFindings === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <OpsBadge label={provider.trustBand} tone={trustBandTone(provider.trustBand)} />
              <span className="text-xs tabular-nums text-[var(--vt-text-3)]">score {provider.trustScore}</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <EntityLink href={`/providers/${provider.npi}`} label="Profile" />
            {navigation?.graphHref ? <EntityLink href={navigation.graphHref} label="Graph" /> : null}
          </div>
        </div>
      ) : null}

      {/* Active finding */}
      {finding ? (
        <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]">Finding</span>
            <OpsBadge label={finding.severity} tone={severityTone(finding.severity)} />
            <OpsBadge label={finding.findingType.replace(/_/g, ' ')} />
          </div>
          <h4 className="text-sm font-semibold text-[var(--vt-text-1)]">{finding.title}</h4>
          <p className="text-xs leading-5 text-[var(--vt-text-2)]">{finding.summary}</p>
          <p className="text-xs leading-5 text-[var(--vt-text-3)]">{finding.explanation}</p>
          <div className="flex flex-wrap gap-2">
            <EntityLink href={`/findings/${finding.id}`} label="Full Finding" />
            {finding.storylineId ? (
              <EntityLink href={`/storylines/${finding.storylineId}`} label={finding.storylineTitle ?? 'Storyline'} />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Storyline */}
      {storyline ? (
        <div className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-3)]">Storyline</span>
            <OpsBadge label={storyline.severity} tone={severityTone(storyline.severity)} />
            <OpsBadge label={storyline.status} />
          </div>
          <h4 className="text-sm font-semibold text-[var(--vt-text-1)]">{storyline.title}</h4>
          <p className="text-xs leading-5 text-[var(--vt-text-2)]">{storyline.whyItMatters}</p>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--vt-text-3)]">
            <span>{storyline.findingCount} findings</span>
            <span>{Math.round(storyline.confidence * 100)}% confidence</span>
          </div>
          {storyline.recommendedActions.length > 0 ? (
            <ul className="space-y-0.5">
              {storyline.recommendedActions.slice(0, 3).map((a, i) => (
                <li key={i} className="text-xs text-[var(--vt-text-2)]">→ {a}</li>
              ))}
            </ul>
          ) : null}
          <EntityLink href={`/storylines/${storyline.id}`} label="Full Storyline" />
        </div>
      ) : null}

      {!provider && !finding && !storyline ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--vt-text-3)]">Enter an NPI above to begin investigation.</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Right Top: Network Graph Mini ─────────────────────────────────────────────

const NODE_TYPE_COLORS: Record<string, string> = NODE_COLORS as Record<string, string>;

interface MiniGraphNode {
  id: string;
  label: string;
  type: string;
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  isFocus: boolean;
}

interface MiniGraphEdge {
  source: string;
  target: string;
  type: string;
}

function simpleForceLayout(
  nodes: MiniGraphNode[],
  edges: MiniGraphEdge[],
  width: number,
  height: number,
  iterations: number,
): void {
  const cx = width / 2;
  const cy = height / 2;

  const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (n.isFocus) { n.x = cx; n.y = cy; }
    else {
      const r = Math.min(width, height) * 0.35;
      n.x = cx + r * Math.cos(i * angleStep);
      n.y = cy + r * Math.sin(i * angleStep);
    }
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (80 * alpha) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        if (!a.isFocus) { a.vx -= dx; a.vy -= dy; }
        if (!b.isFocus) { b.vx += dx; b.vy += dy; }
      }
    }
    for (const e of edges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 60) * 0.02 * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.isFocus) { a.vx += fx; a.vy += fy; }
      if (!b.isFocus) { b.vx -= fx; b.vy -= fy; }
    }
    for (const n of nodes) {
      if (n.isFocus) continue;
      n.vx += (cx - n.x) * 0.01 * alpha;
      n.vy += (cy - n.y) * 0.01 * alpha;
      n.x += n.vx * 0.6;
      n.y += n.vy * 0.6;
      n.vx *= 0.5;
      n.vy *= 0.5;
      n.x = Math.max(n.size + 4, Math.min(width - n.size - 4, n.x));
      n.y = Math.max(n.size + 4, Math.min(height - n.size - 4, n.y));
    }
  }
}

function NetworkGraphPanel({ npi }: { npi: string }) {
  const [nodes, setNodes] = useState<MiniGraphNode[]>([]);
  const [edges, setEdges] = useState<MiniGraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ label: string; type: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 380;
  const H = 260;

  useEffect(() => {
    if (!npi || !/^\d{10}$/.test(npi)) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/intelligence/graph?npi=${npi}&limit=40`);
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json() as {
          nodes?: Array<{ id: string; label?: string; type?: string; degree?: number }>;
          edges?: Array<{ source: string; target: string; type?: string }>;
          focusNodeId?: string | null;
        };
        if (cancelled) return;

        const rawN = (data.nodes ?? []).slice(0, 40);
        const rawE = (data.edges ?? []).slice(0, 80);
        const focusId = data.focusNodeId ?? null;
        const nodeIds = new Set(rawN.map(n => n.id));

        const mn: MiniGraphNode[] = rawN.map(n => ({
          id: n.id,
          label: (n.label ?? n.id).slice(0, 24),
          type: n.type ?? 'clinician',
          x: 0, y: 0, vx: 0, vy: 0,
          size: n.id === focusId ? 10 : Math.min(4 + (n.degree ?? 1), 8),
          color: NODE_TYPE_COLORS[n.type ?? 'clinician'] ?? getNodeColor('clinician'),
          isFocus: n.id === focusId,
        }));

        const me: MiniGraphEdge[] = rawE
          .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
          .map(e => ({ source: e.source, target: e.target, type: e.type ?? 'related_to' }));

        simpleForceLayout(mn, me, W, H, 80);
        setNodes(mn);
        setEdges(me);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [npi]);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Network</p>
        <Link href={`/graph?npi=${npi}`} className="text-xs text-cyan-400 transition hover:text-cyan-300">
          Full Graph →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--vt-text-3)]">Loading…</div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-[var(--vt-text-3)]">No network data.</div>
      ) : (
        <div className="relative flex-1">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
            {edges.map((e, i) => {
              const s = nodeMap.get(e.source);
              const t = nodeMap.get(e.target);
              if (!s || !t) return null;
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--vt-border)" strokeWidth={0.8} strokeOpacity={0.5} />;
            })}
            {nodes.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x} cy={n.y} r={n.size}
                  fill={n.color}
                  fillOpacity={n.isFocus ? 1 : 0.75}
                  stroke={n.isFocus ? 'var(--vt-accent, cyan)' : 'none'}
                  strokeWidth={n.isFocus ? 2 : 0}
                  className="cursor-pointer"
                  onMouseEnter={(ev) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) setTooltip({ label: n.label, type: n.type, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    const m = n.id.match(/npi:(\d{10})/);
                    if (m) window.location.href = `/providers/${m[1]}`;
                  }}
                />
                {n.isFocus ? (
                  <text x={n.x} y={n.y + n.size + 11} textAnchor="middle" className="fill-[var(--vt-text-2)] text-[8px] font-medium">
                    {n.label.slice(0, 16)}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
          {tooltip ? (
            <div className="pointer-events-none absolute z-10 rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface)] px-2 py-1 text-xs shadow-lg"
              style={{ left: tooltip.x + 10, top: tooltip.y - 6 }}>
              <p className="font-medium text-[var(--vt-text-1)]">{tooltip.label}</p>
              <p className="text-[var(--vt-text-3)]">{tooltip.type}</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-0.5 px-3 pb-2 pt-1">
        {[...new Set(nodes.map(n => n.type))].slice(0, 4).map(t => (
          <div key={t} className="flex items-center gap-1 text-[9px] text-[var(--vt-text-3)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: NODE_TYPE_COLORS[t] ?? getNodeColor('clinician') }} />
            {t}
          </div>
        ))}
        <span className="text-[9px] text-[var(--vt-text-3)]">{nodes.length}n · {edges.length}e</span>
      </div>
    </div>
  );
}

// ── Right Bottom: Copilot Panel ───────────────────────────────────────────────

function CopilotPanel({
  npi,
  findingId,
  storylineId,
  collapsed,
  onToggle,
}: {
  npi: string;
  findingId: string | null;
  storylineId: string | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const contextParts: string[] = [`NPI ${npi}`];
  if (findingId) contextParts.push(`finding`);
  if (storylineId) contextParts.push(`storyline`);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-1.5 px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Copilot</p>
          <button onClick={onToggle} className="text-xs text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        {/* Context chips */}
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/5 px-2 py-0.5 text-[10px] text-cyan-400">NPI {npi}</span>
          {findingId ? <span className="rounded-full border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 text-[10px] text-amber-400">Finding</span> : null}
          {storylineId ? <span className="rounded-full border border-violet-400/30 bg-violet-400/5 px-2 py-0.5 text-[10px] text-violet-400">Storyline</span> : null}
        </div>
      </div>
      {!collapsed ? (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <CopilotSearchBar
            compact
            sessionId={`inv_${npi}`}
            placeholder={`Ask about ${contextParts.join(', ')}…`}
            onNavigateToNpi={(targetNpi) => {
              window.location.href = `/investigations?npi=${targetNpi}`;
            }}
            autoFocus={false}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-[var(--vt-text-3)]">Copilot ready · {contextParts.join(' · ')}</p>
        </div>
      )}
    </div>
  );
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────

function useWorkbenchShortcuts(handlers: {
  onEscalate?: () => void;
  onDismiss?: () => void;
  onInvestigating?: () => void;
  onLinkStoryline?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toUpperCase()) {
        case 'E':
          e.preventDefault();
          handlers.onEscalate?.();
          break;
        case 'D':
          e.preventDefault();
          handlers.onDismiss?.();
          break;
        case 'I':
          e.preventDefault();
          handlers.onInvestigating?.();
          break;
        case 'S':
          e.preventDefault();
          handlers.onLinkStoryline?.();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handlers]);
}

// ── Main Surface ──────────────────────────────────────────────────────────────

export function InvestigationsSurface() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const seededNpi = searchParams.get('npi') ?? '';
  const seededFindingId = searchParams.get('findingId') ?? '';
  const seededStorylineId = searchParams.get('storylineId') ?? '';

  const [npiInput, setNpiInput] = useState(seededNpi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<WorkbenchContext | null>(null);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(seededFindingId || null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchWorkbench = useCallback(async (params: {
    npi?: string;
    findingId?: string;
    storylineId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.npi) qs.set('npi', params.npi);
    if (params.findingId) qs.set('findingId', params.findingId);
    if (params.storylineId) qs.set('storylineId', params.storylineId);
    if (!qs.toString()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/investigation/workbench?${qs.toString()}`);
      const payload = await res.json().catch(() => ({})) as WorkbenchContext;
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? `Request failed ${res.status}`);
      setContext(payload);
      if (params.npi) setNpiInput(params.npi);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Investigation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (seededNpi || seededFindingId || seededStorylineId) {
      void fetchWorkbench({
        npi: seededNpi || undefined,
        findingId: seededFindingId || undefined,
        storylineId: seededStorylineId || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seededNpi, seededFindingId, seededStorylineId]);

  // Finding selection from inbox
  const handleSelectFinding = useCallback((id: string) => {
    setSelectedFindingId(id);
    if (context?.provider?.npi) {
      void fetchWorkbench({ npi: context.provider.npi, findingId: id });
    }
  }, [context?.provider?.npi, fetchWorkbench]);

  // Keyboard shortcut actions
  const showAction = useCallback((msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 2000);
  }, []);

  useWorkbenchShortcuts({
    onEscalate: () => {
      if (context?.finding) {
        void fetch(`/api/intelligence/findings/${context.finding.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'investigating' }),
        });
        showAction(`Escalated: ${context.finding.title}`);
      }
    },
    onDismiss: () => {
      if (context?.finding) {
        void fetch(`/api/intelligence/findings/${context.finding.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'dismissed' }),
        });
        showAction(`Dismissed: ${context.finding.title}`);
      }
    },
    onInvestigating: () => {
      if (context?.finding) showAction(`Investigating: ${context.finding.title}`);
    },
    onLinkStoryline: () => {
      if (context?.finding && context.storyline) {
        showAction(`Linked to storyline: ${context.storyline.title}`);
      }
    },
  });

  const providerNpi = context?.provider?.npi ?? null;

  return (
    <OperationsShell
      activeHref="/investigations"
      title="Investigation Workbench"
      description="Four-panel investigation surface. Select findings, inspect evidence, explore the provider network, and query the Copilot — all in one view."
      breadcrumbs={[{ label: 'Investigations' }]}
      banner={actionMsg ? (
        <SurfaceBanner tone="info">
          <span className="animate-pulse">{actionMsg}</span>
        </SurfaceBanner>
      ) : error ? (
        <SurfaceBanner tone="warning">{error}</SurfaceBanner>
      ) : context?.generatedAt ? (() => {
        const ageSec = Math.round((Date.now() - new Date(context.generatedAt).getTime()) / 1000);
        return ageSec > 60 ? (
          <SurfaceBanner tone="neutral">
            Data last refreshed {ageSec}s ago · <button onClick={() => { if (context.anchor.npi) void fetchWorkbench(context.anchor as { npi?: string; findingId?: string; storylineId?: string }); }} className="underline">Refresh</button>
          </SurfaceBanner>
        ) : null;
      })() : null}
    >
      {/* NPI input */}
      <OpsCard className="space-y-2">
        <form
          className="flex flex-col gap-2 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{10}$/.test(npiInput.trim())) void fetchWorkbench({ npi: npiInput.trim() });
          }}
        >
          <input
            value={npiInput}
            onChange={(e) => setNpiInput(e.target.value)}
            placeholder="Provider NPI (10 digits)"
            className="min-w-0 flex-1 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-2.5 text-sm text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)] focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          />
          <button
            type="submit"
            disabled={loading || !/^\d{10}$/.test(npiInput.trim())}
            className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Investigate'}
          </button>
        </form>
        {/* Shortcut hints */}
        {context?.finding ? (
          <div className="flex flex-wrap gap-3 text-[10px] text-[var(--vt-text-3)]">
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">E</kbd> Escalate</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">D</kbd> Dismiss</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">I</kbd> Investigating</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">S</kbd> Link Storyline</span>
            <span><kbd className="rounded border border-[var(--vt-border)] px-1">⌘K</kbd> Copilot</span>
          </div>
        ) : null}
      </OpsCard>

      {/* Four-panel grid */}
      {context ? (
        <div
          className="grid gap-px overflow-hidden rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-border)]"
          style={{
            gridTemplateColumns: '320px 1fr 380px',
            gridTemplateRows: '1fr 280px',
            height: 'calc(100vh - 340px)',
            minHeight: '520px',
          }}
        >
          {/* Left: Findings Inbox (spans both rows) */}
          <div className="row-span-2 bg-[var(--vt-surface)]">
            <FindingsInbox
              findings={context.relatedFindings}
              selectedId={selectedFindingId}
              onSelect={handleSelectFinding}
            />
          </div>

          {/* Center top: Provider Investigation */}
          <div className="bg-[var(--vt-surface)]">
            <ProviderInvestigationPanel
              provider={context.provider}
              finding={context.finding}
              storyline={context.storyline}
              navigation={context.navigation}
            />
          </div>

          {/* Right top: Network Graph */}
          <div className="bg-[var(--vt-surface)]">
            {providerNpi ? (
              <NetworkGraphPanel npi={providerNpi} />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vt-text-3)]">No provider selected</div>
            )}
          </div>

          {/* Center bottom: Evidence Viewer */}
          <div className="bg-[var(--vt-surface)] overflow-hidden">
            {context.finding && context.finding.evidence.length > 0 ? (
              <div className="h-full overflow-y-auto p-3">
                <EvidenceViewerPanel
                  evidence={context.finding.evidence}
                  findingId={context.finding.id}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vt-text-3)]">
                Select a finding to view evidence.
              </div>
            )}
          </div>

          {/* Right bottom: Copilot */}
          <div className="bg-[var(--vt-surface)]">
            {providerNpi ? (
              <CopilotPanel
                npi={providerNpi}
                findingId={context.finding?.id ?? null}
                storylineId={context.storyline?.id ?? null}
                collapsed={copilotCollapsed}
                onToggle={() => setCopilotCollapsed(c => !c)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--vt-text-3)]">Copilot ready</div>
            )}
          </div>
        </div>
      ) : null}
    </OperationsShell>
  );
}
