'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Filter, LayoutPanelLeft, Search } from 'lucide-react';
import { useFindings } from '@/hooks/useFindings';
import { useGraph } from '@/hooks/useGraph';
import { useProviders } from '@/hooks/useProviders';
import { useStorylines } from '@/hooks/useStorylines';
import { GraphWorkbenchPanel } from '@/components/intelligence-ops/graph-workbench-panel';
import { CommandPalette } from '@/components/command/command-palette';
import { useInvestigationContext } from '@/lib/intelligence/investigation-context';
import {
  buildSpatialWorkspaceHref,
  buildWorkspacePageKey,
  parseSpatialWorkspaceRouteState,
  type SpatialEntityType,
  type SpatialWorkspaceRouteState,
  type SpatialWorkspaceView,
  type WorkspaceViewport,
} from '@/lib/intelligence/spatial-workspace';
import { useSpatialWorkspaceStore } from '@/stores/spatialWorkspaceStore';
import { PageNode } from './PageNode';

interface SpatialIntelligenceWorkspaceProps {
  initialSearchParams: Record<string, string | string[] | undefined>;
}

interface DiscoverySection {
  key: SpatialEntityType;
  title: string;
  count: number;
  items: Array<{
    key: string;
    title: string;
    subtitle: string;
    summary: string;
    onOpen: () => void;
    active: boolean;
  }>;
}

const PAGE_WIDTH = 368;
const PAGE_GAP = 24;
const CANVAS_PADDING = 48;
const CONTENT_HEIGHT = 620;
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 1.8;

function toSearchParams(record: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.length > 0) {
          params.append(key, item);
        }
      }
      continue;
    }

    if (value.length > 0) {
      params.set(key, value);
    }
  }

  return params;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-spatial-interactive="true"]'));
}

function resolveSectionOrder(view: SpatialWorkspaceView): SpatialEntityType[] {
  switch (view) {
    case 'providers':
      return ['provider', 'finding', 'storyline'];
    case 'storylines':
      return ['storyline', 'finding', 'provider'];
    case 'findings':
    case 'investigations':
      return ['finding', 'storyline', 'provider'];
    default:
      return ['finding', 'provider', 'storyline'];
  }
}

function clampViewport(
  viewport: WorkspaceViewport,
  container: HTMLDivElement | null,
  pageCount: number,
): WorkspaceViewport {
  const zoom = clamp(viewport.zoom, MIN_ZOOM, MAX_ZOOM);
  if (!container) {
    return { ...viewport, zoom };
  }

  const rect = container.getBoundingClientRect();
  const contentWidth = Math.max(rect.width - CANVAS_PADDING * 2, (pageCount * PAGE_WIDTH) + (Math.max(0, pageCount - 1) * PAGE_GAP) + CANVAS_PADDING * 2);
  const contentHeight = Math.max(rect.height - CANVAS_PADDING * 2, CONTENT_HEIGHT);
  const minX = Math.min(CANVAS_PADDING, rect.width - (contentWidth * zoom));
  const minY = Math.min(CANVAS_PADDING, rect.height - (contentHeight * zoom));

  return {
    x: clamp(viewport.x, minX, CANVAS_PADDING),
    y: clamp(viewport.y, minY, CANVAS_PADDING),
    zoom,
  };
}

function ViewChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-spatial-interactive="true"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
        active
          ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)]'
      }`}
    >
      {label}
    </button>
  );
}

function DiscoverySectionCard({
  section,
}: {
  section: DiscoverySection;
}) {
  return (
    <section className="space-y-2 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{section.title}</p>
        </div>
        <span className="text-xs font-semibold text-[var(--vt-text-1)]">{section.count}</span>
      </div>
      <div className="space-y-2">
        {section.items.length > 0 ? section.items.slice(0, 6).map((item) => (
          <button
            key={item.key}
            type="button"
            data-spatial-interactive="true"
            onClick={item.onOpen}
            className={`w-full rounded-xl border px-3 py-3 text-left transition ${
              item.active
                ? 'border-cyan-400/40 bg-cyan-400/10'
                : 'border-[var(--vt-border)] bg-[var(--vt-surface-dim)] hover:border-cyan-400/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--vt-text-1)]">{item.title}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{item.subtitle}</p>
              </div>
              {item.active ? (
                <span className="rounded-full border border-cyan-400/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-200">
                  Open
                </span>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--vt-text-2)]">{item.summary}</p>
          </button>
        )) : (
          <p className="rounded-xl border border-dashed border-[var(--vt-border)] px-3 py-4 text-sm text-[var(--vt-text-3)]">
            No results for this section yet.
          </p>
        )}
      </div>
    </section>
  );
}

export function SpatialIntelligenceWorkspace({
  initialSearchParams,
}: SpatialIntelligenceWorkspaceProps) {
  const hydrateFromRoute = useSpatialWorkspaceStore((state) => state.hydrateFromRoute);
  const view = useSpatialWorkspaceStore((state) => state.view);
  const filters = useSpatialWorkspaceStore((state) => state.filters);
  const selectedNode = useSpatialWorkspaceStore((state) => state.selectedNode);
  const hoveredNode = useSpatialWorkspaceStore((state) => state.hoveredNode);
  const graphFocus = useSpatialWorkspaceStore((state) => state.graphFocus);
  const focusRevision = useSpatialWorkspaceStore((state) => state.focusRevision);
  const openPages = useSpatialWorkspaceStore((state) => state.openPages);
  const viewport = useSpatialWorkspaceStore((state) => state.viewport);
  const setView = useSpatialWorkspaceStore((state) => state.setView);
  const setFilters = useSpatialWorkspaceStore((state) => state.setFilters);
  const setViewport = useSpatialWorkspaceStore((state) => state.setViewport);
  const setHoveredNode = useSpatialWorkspaceStore((state) => state.setHoveredNode);
  const focusPage = useSpatialWorkspaceStore((state) => state.focusPage);
  const closePage = useSpatialWorkspaceStore((state) => state.closePage);
  const openEntity = useSpatialWorkspaceStore((state) => state.openEntity);

  const initialRouteState = useMemo(() => (
    parseSpatialWorkspaceRouteState(toSearchParams(initialSearchParams))
  ), [initialSearchParams]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef(viewport);
  const pageCountRef = useRef(openPages.length);
  const hydratedRef = useRef(false);
  const lastUrlRef = useRef<string>('');
  const inertiaFrameRef = useRef<number | null>(null);
  const autoCenterRevisionRef = useRef<number>(-1);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    mode: 'pan' | 'pinch' | null;
    startViewport: WorkspaceViewport;
    startPointer: { x: number; y: number };
    lastPointer: { x: number; y: number; time: number };
    velocity: { x: number; y: number };
    anchorWorld: { x: number; y: number } | null;
    startDistance: number;
  }>({
    mode: null,
    startViewport: viewport,
    startPointer: { x: 0, y: 0 },
    lastPointer: { x: 0, y: 0, time: 0 },
    velocity: { x: 0, y: 0 },
    anchorWorld: null,
    startDistance: 0,
  });

  const [graphCollapsed, setGraphCollapsed] = useState(false);

  // Derive focused NPI from graphFocus page key (format: "provider:NPI" or "finding:ID")
  const focusedNpi = useMemo(() => {
    if (!graphFocus) return undefined;
    if (graphFocus.startsWith('provider:')) return graphFocus.slice('provider:'.length);
    // For finding/storyline pages, find the provider from the open pages chain
    const sourcePage = openPages.find((p) => p.key === graphFocus);
    if (sourcePage?.sourcePageKey?.startsWith('provider:')) {
      return sourcePage.sourcePageKey.slice('provider:'.length);
    }
    return undefined;
  }, [graphFocus, openPages]);

  const graph = useGraph({ npi: focusedNpi, layer: 'blended', limit: focusedNpi ? 80 : 120, pollIntervalMs: 45_000 });

  const providers = useProviders({
    query: filters.q,
    minTrustScore: filters.minTrustScore ? Number.parseInt(filters.minTrustScore, 10) : undefined,
    limit: 16,
  });
  const findings = useFindings({
    provider: filters.provider || null,
    severity: filters.severity,
    status: filters.status,
    type: filters.type,
    investigatorId: filters.investigatorId || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    minConfidence: filters.minConfidence || null,
    limit: 16,
  });
  const storylines = useStorylines({
    provider: filters.provider || null,
    severity: filters.severity[0] ?? null,
    status: filters.status[0] ?? null,
    storylineType: filters.storylineType || null,
    perspective: filters.perspective || null,
    limit: 16,
  });

  useEffect(() => {
    hydrateFromRoute(initialRouteState);
    hydratedRef.current = true;
  }, [hydrateFromRoute, initialRouteState]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    pageCountRef.current = openPages.length;
  }, [openPages.length]);

  useEffect(() => {
    if (!canvasRef.current || !selectedNode) {
      return;
    }

    if (autoCenterRevisionRef.current === focusRevision) {
      return;
    }

    const selectedIndex = openPages.findIndex((page) => page.key === selectedNode);
    if (selectedIndex === -1) {
      return;
    }

    autoCenterRevisionRef.current = focusRevision;

    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = CANVAS_PADDING + (selectedIndex * (PAGE_WIDTH + PAGE_GAP)) + (PAGE_WIDTH / 2);
    const centerY = CANVAS_PADDING + (CONTENT_HEIGHT / 2);
    const currentZoom = viewportRef.current.zoom;

    applyViewport({
      x: (rect.width / 2) - (centerX * currentZoom),
      y: (rect.height / 2) - (centerY * currentZoom),
      zoom: currentZoom,
    });
  }, [focusRevision, openPages, selectedNode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      hydrateFromRoute(parseSpatialWorkspaceRouteState(new URLSearchParams(window.location.search)));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hydrateFromRoute]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === 'undefined') {
      return undefined;
    }

    const routeState: SpatialWorkspaceRouteState = {
      view,
      filters,
      selectedNode,
      graphFocus,
      openPages,
      viewport,
    };

    const timeout = window.setTimeout(() => {
      const href = buildSpatialWorkspaceHref(routeState);
      const nextUrl = new URL(href, window.location.origin);
      const nextRelative = `${nextUrl.pathname}${nextUrl.search}`;
      const currentRelative = `${window.location.pathname}${window.location.search}`;

      if (nextRelative !== currentRelative && nextRelative !== lastUrlRef.current) {
        window.history.replaceState({}, '', nextRelative);
        lastUrlRef.current = nextRelative;
      }
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [filters, graphFocus, openPages, selectedNode, viewport, view]);

  function cancelInertia() {
    if (inertiaFrameRef.current !== null) {
      cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  }

  function applyViewport(nextViewport: WorkspaceViewport) {
    const clampedViewport = clampViewport(nextViewport, canvasRef.current, pageCountRef.current);
    viewportRef.current = clampedViewport;
    setViewport(clampedViewport);
  }

  function beginPinch() {
    const pointerValues = [...pointersRef.current.values()];
    if (pointerValues.length < 2) {
      return;
    }

    const [first, second] = pointerValues;
    const center = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    const startViewport = viewportRef.current;
    gestureRef.current = {
      mode: 'pinch',
      startViewport,
      startPointer: center,
      lastPointer: {
        x: center.x,
        y: center.y,
        time: performance.now(),
      },
      velocity: { x: 0, y: 0 },
      anchorWorld: {
        x: (center.x - startViewport.x) / startViewport.zoom,
        y: (center.y - startViewport.y) / startViewport.zoom,
      },
      startDistance: Math.hypot(second.x - first.x, second.y - first.y),
    };
  }

  function startInertia(initialVelocity: { x: number; y: number }) {
    cancelInertia();

    let velocity = { ...initialVelocity };
    let lastFrameAt = performance.now();

    const step = (now: number) => {
      const deltaMs = now - lastFrameAt;
      lastFrameAt = now;

      velocity = {
        x: velocity.x * Math.pow(0.92, deltaMs / 16),
        y: velocity.y * Math.pow(0.92, deltaMs / 16),
      };

      if (Math.abs(velocity.x) < 0.01 && Math.abs(velocity.y) < 0.01) {
        inertiaFrameRef.current = null;
        return;
      }

      applyViewport({
        ...viewportRef.current,
        x: viewportRef.current.x + (velocity.x * deltaMs),
        y: viewportRef.current.y + (velocity.y * deltaMs),
      });

      inertiaFrameRef.current = requestAnimationFrame(step);
    };

    inertiaFrameRef.current = requestAnimationFrame(step);
  }

  const sectionOrder = useMemo(() => resolveSectionOrder(view), [view]);

  // ── Phase 3: Event bus — single interaction updates entire workspace ──────
  const {
    onSelectFinding: openFindingBus,
    onSelectProvider: openProviderBus,
    onSelectStoryline: openStorylineBus,
  } = useInvestigationContext();

  function openProvider(npi: string, label?: string) {
    openProviderBus(npi, { label: label ?? null });
  }

  function openFinding(findingId: string, options: { providerNpi?: string | null; storylineId?: string | null; label?: string | null } = {}) {
    openFindingBus(findingId, { npi: options.providerNpi, storylineId: options.storylineId, label: options.label });
  }

  function openStoryline(storylineId: string, options: { providerNpi?: string | null; label?: string | null } = {}) {
    openStorylineBus(storylineId, { npi: options.providerNpi, label: options.label });
  }

  const providerKeys = new Set(openPages.filter((page) => page.type === 'provider').map((page) => page.key));
  const findingKeys = new Set(openPages.filter((page) => page.type === 'finding').map((page) => page.key));
  const storylineKeys = new Set(openPages.filter((page) => page.type === 'storyline').map((page) => page.key));

  const discoverySections = useMemo<DiscoverySection[]>(() => {
    const providerSection: DiscoverySection = {
      key: 'provider',
      title: 'Providers',
      count: providers.data?.total ?? 0,
      items: (providers.data?.providers ?? []).map((provider) => ({
        key: provider.npi,
        title: provider.name,
        subtitle: `NPI ${provider.npi}`,
        summary: provider.summary,
        active: providerKeys.has(buildWorkspacePageKey('provider', provider.npi)),
        onOpen: () => openProvider(provider.npi, provider.name),
      })),
    };
    const findingSection: DiscoverySection = {
      key: 'finding',
      title: 'Findings',
      count: findings.data?.total ?? 0,
      items: (findings.data?.findings ?? []).map((finding) => ({
        key: finding.id,
        title: finding.title,
        subtitle: `${finding.severity.toUpperCase()} · ${finding.providerNpi ?? 'Global'}`,
        summary: finding.summary,
        active: findingKeys.has(buildWorkspacePageKey('finding', finding.id)),
        onOpen: () => openFinding(finding.id, {
          providerNpi: finding.providerNpi,
          storylineId: finding.storylineId,
          label: finding.title,
        }),
      })),
    };
    const storylineSection: DiscoverySection = {
      key: 'storyline',
      title: 'Storylines',
      count: storylines.data?.total ?? 0,
      items: (storylines.data?.storylines ?? []).map((storyline) => ({
        key: storyline.id,
        title: storyline.title,
        subtitle: `${storyline.severity.toUpperCase()} · ${storyline.status}`,
        summary: storyline.whyItMatters,
        active: storylineKeys.has(buildWorkspacePageKey('storyline', storyline.id)),
        onOpen: () => openStoryline(storyline.id, {
          providerNpi: storyline.providerNpi,
          label: storyline.title,
        }),
      })),
    };

    const sectionByKey: Record<SpatialEntityType, DiscoverySection> = {
      provider: providerSection,
      finding: findingSection,
      storyline: storylineSection,
    };

    return sectionOrder.map((key) => sectionByKey[key]);
  }, [
    findingKeys,
    findings.data?.findings,
    findings.data?.total,
    providerKeys,
    providers.data?.providers,
    providers.data?.total,
    sectionOrder,
    storylineKeys,
    storylines.data?.storylines,
    storylines.data?.total,
  ]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    cancelInertia();
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointerCount = pointersRef.current.size;
    if (pointerCount >= 2) {
      beginPinch();
    } else {
      gestureRef.current = {
        mode: 'pan',
        startViewport: viewportRef.current,
        startPointer: {
          x: event.clientX,
          y: event.clientY,
        },
        lastPointer: {
          x: event.clientX,
          y: event.clientY,
          time: performance.now(),
        },
        velocity: { x: 0, y: 0 },
        anchorWorld: null,
        startDistance: 0,
      };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointerValues = [...pointersRef.current.values()];
    if (pointerValues.length >= 2) {
      if (gestureRef.current.mode !== 'pinch') {
        beginPinch();
      }

      const [first, second] = pointerValues;
      const center = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      const currentDistance = Math.hypot(second.x - first.x, second.y - first.y);
      const anchorWorld = gestureRef.current.anchorWorld;

      if (!anchorWorld || gestureRef.current.startDistance <= 0) {
        return;
      }

      const nextZoom = clamp(
        gestureRef.current.startViewport.zoom * (currentDistance / gestureRef.current.startDistance),
        MIN_ZOOM,
        MAX_ZOOM,
      );

      applyViewport({
        x: center.x - (anchorWorld.x * nextZoom),
        y: center.y - (anchorWorld.y * nextZoom),
        zoom: nextZoom,
      });
      return;
    }

    if (gestureRef.current.mode !== 'pan') {
      return;
    }

    const deltaX = event.clientX - gestureRef.current.startPointer.x;
    const deltaY = event.clientY - gestureRef.current.startPointer.y;
    const now = performance.now();
    const deltaTime = Math.max(1, now - gestureRef.current.lastPointer.time);

    gestureRef.current.velocity = {
      x: (event.clientX - gestureRef.current.lastPointer.x) / deltaTime,
      y: (event.clientY - gestureRef.current.lastPointer.y) / deltaTime,
    };
    gestureRef.current.lastPointer = {
      x: event.clientX,
      y: event.clientY,
      time: now,
    };

    applyViewport({
      x: gestureRef.current.startViewport.x + deltaX,
      y: gestureRef.current.startViewport.y + deltaY,
      zoom: gestureRef.current.startViewport.zoom,
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    if (pointersRef.current.size === 1) {
      const [remainingPointer] = pointersRef.current.values();
      gestureRef.current = {
        mode: 'pan',
        startViewport: viewportRef.current,
        startPointer: remainingPointer,
        lastPointer: {
          x: remainingPointer.x,
          y: remainingPointer.y,
          time: performance.now(),
        },
        velocity: { x: 0, y: 0 },
        anchorWorld: null,
        startDistance: 0,
      };
      return;
    }

    if (gestureRef.current.mode === 'pan') {
      const { velocity } = gestureRef.current;
      if (Math.abs(velocity.x) > 0.02 || Math.abs(velocity.y) > 0.02) {
        startInertia(velocity);
      }
    }

    gestureRef.current.mode = null;
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const currentViewport = viewportRef.current;
    const nextZoom = clamp(currentViewport.zoom * (event.deltaY > 0 ? 0.94 : 1.06), MIN_ZOOM, MAX_ZOOM);
    const anchorWorld = {
      x: (point.x - currentViewport.x) / currentViewport.zoom,
      y: (point.y - currentViewport.y) / currentViewport.zoom,
    };

    applyViewport({
      x: point.x - (anchorWorld.x * nextZoom),
      y: point.y - (anchorWorld.y * nextZoom),
      zoom: nextZoom,
    });
  }

  return (
    <>
    <CommandPalette />
    <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden bg-[var(--vt-bg)] text-[var(--vt-text-1)]">
      {/* ── OS Mode header ─────────────────────────────────────────────────── */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-4">
        <div className="flex h-full items-stretch gap-0.5">
          <span className="mr-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--vt-text-1)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            VitalCV OS
          </span>
          {(['monitor', 'investigate', 'decide'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode === 'monitor' ? 'dashboard' : mode === 'investigate' ? 'findings' : 'investigations')}
              className={`flex items-center border-b-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                (mode === 'monitor' && (view === 'dashboard' || view === 'providers'))
                || (mode === 'investigate' && (view === 'findings' || view === 'storylines'))
                || (mode === 'decide' && view === 'investigations')
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {graphFocus && (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-mono text-cyan-300">
              {graphFocus}
            </span>
          )}
          <button
            type="button"
            onClick={() => setGraphCollapsed((c) => !c)}
            className="text-[10px] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
            title={graphCollapsed ? 'Show graph' : 'Collapse graph'}
          >
            {graphCollapsed ? '⊞ Graph' : '⊟ Graph'}
          </button>
          <button
            type="button"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
            className="rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-1 text-[10px] text-[var(--vt-text-2)] transition hover:text-[var(--vt-text-1)]"
          >
            ⌘K
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-[22rem] shrink-0 flex-col border-r border-[var(--vt-border)] bg-[var(--vt-surface-dim)]">
        <div className="border-b border-[var(--vt-border)] px-5 py-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
            <Compass className="h-4 w-4" />
            Discovery Rail
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
            <label className="flex items-center gap-2 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--vt-text-3)]" />
              <input
                data-spatial-interactive="true"
                value={filters.q}
                onChange={(event) => setFilters({ q: event.target.value })}
                placeholder="Search intelligence"
                className="w-full bg-transparent text-sm text-[var(--vt-text-1)] outline-none placeholder:text-[var(--vt-text-3)]"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <ViewChip active={view === 'dashboard'} label="All" onClick={() => setView('dashboard')} />
              <ViewChip active={view === 'findings'} label="Findings" onClick={() => setView('findings')} />
              <ViewChip active={view === 'providers'} label="Providers" onClick={() => setView('providers')} />
              <ViewChip active={view === 'storylines'} label="Storylines" onClick={() => setView('storylines')} />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Provider scope</span>
              <input
                data-spatial-interactive="true"
                value={filters.provider}
                onChange={(event) => setFilters({ provider: event.target.value })}
                placeholder="NPI"
                className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Severity</span>
                <input
                  data-spatial-interactive="true"
                  value={filters.severity.join(',')}
                  onChange={(event) => setFilters({
                    severity: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                  })}
                  placeholder="critical,high"
                  className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Status</span>
                <input
                  data-spatial-interactive="true"
                  value={filters.status.join(',')}
                  onChange={(event) => setFilters({
                    status: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                  })}
                  placeholder="open,pending"
                  className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Type</span>
                <input
                  data-spatial-interactive="true"
                  value={filters.type.join(',')}
                  onChange={(event) => setFilters({
                    type: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                  })}
                  placeholder="license_gap"
                  className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Min trust</span>
                <input
                  data-spatial-interactive="true"
                  value={filters.minTrustScore}
                  onChange={(event) => setFilters({ minTrustScore: event.target.value })}
                  placeholder="80"
                  className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Storyline type</span>
                <input
                  data-spatial-interactive="true"
                  value={filters.storylineType}
                  onChange={(event) => setFilters({ storylineType: event.target.value })}
                  placeholder="credential_drift"
                  className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Perspective</span>
                <input
                  data-spatial-interactive="true"
                  value={filters.perspective}
                  onChange={(event) => setFilters({ perspective: event.target.value })}
                  placeholder="provider"
                  className="w-full rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm text-[var(--vt-text-1)] outline-none"
                />
              </label>
            </div>
          </div>

          {discoverySections.map((section) => (
            <DiscoverySectionCard key={section.key} section={section} />
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-5 py-2">
          <p className="text-[10px] text-[var(--vt-text-3)]">
            {openPages.length > 0
              ? `${openPages.length} open · ${selectedNode ?? 'none selected'}`
              : 'Select a finding, provider, or storyline to open a caseboard.'}
          </p>
          <div className="flex items-center gap-2">
            <Link data-spatial-interactive="true" href="/intelligence?view=actions" className="text-[10px] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">Actions</Link>
            <Link data-spatial-interactive="true" href="/intelligence?view=calibration" className="text-[10px] text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">Calibration</Link>
          </div>
        </header>

        <div
          ref={canvasRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.04))]"
          style={{ touchAction: 'none' }}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onWheel={handleWheel}
        >
          <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
            <LayoutPanelLeft className="h-4 w-4" />
            Pinch · drag · zoom
          </div>

          {openPages.length > 0 ? (
            <div
              className="absolute left-0 top-0"
              style={{
                transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <div className="flex items-start gap-6" style={{ padding: CANVAS_PADDING }}>
                {openPages.map((page) => (
                  <PageNode
                    key={page.key}
                    page={page}
                    active={page.key === selectedNode}
                    onClose={closePage}
                    onFocus={focusPage}
                    onHover={setHoveredNode}
                    onOpenBacklink={(type, entityId, sourcePageKey, label) => {
                      openEntity(type, entityId, {
                        sourcePageKey,
                        label,
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* No open pages — show skeleton rows as loading state, never blank */
            <div
              className="absolute left-0 top-0"
              style={{ transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`, transformOrigin: '0 0' }}
            >
              <div className="flex items-start gap-6" style={{ padding: CANVAS_PADDING }}>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-[23rem] shrink-0 animate-pulse rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 space-y-4"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-3.5 rounded bg-[var(--vt-surface-dim)]" />
                      <div className="h-3 w-20 rounded bg-[var(--vt-surface-dim)]" />
                    </div>
                    <div className="h-5 w-3/4 rounded bg-[var(--vt-surface-dim)]" />
                    <div className="h-4 w-full rounded bg-[var(--vt-surface-dim)]" />
                    <div className="h-4 w-5/6 rounded bg-[var(--vt-surface-dim)]" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-14 rounded-xl bg-[var(--vt-surface-dim)]" />
                      <div className="h-14 rounded-xl bg-[var(--vt-surface-dim)]" />
                    </div>
                    <div className="h-10 rounded-xl bg-[var(--vt-surface-dim)]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Persistent graph rail (Phase 6: syncs with graphFocus) ───────── */}
      {!graphCollapsed && (
        <aside className="flex w-[320px] shrink-0 flex-col border-l border-[var(--vt-border)] overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
                Trust Graph
              </span>
            </div>
            {graph.data && (
              <span className="text-[9px] font-mono text-cyan-400/70">
                {graph.data.nodes.length}N · {graph.data.edges.length}E
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden bg-[var(--vt-bg)]">
            <GraphWorkbenchPanel
              graph={graph.data ?? null}
              providers={providers.data?.providers ?? []}
              selectedProvider={
                focusedNpi
                  ? (providers.data?.providers ?? []).find((p) => p.npi === focusedNpi) ?? null
                  : null
              }
              selectedFindingId={graphFocus?.startsWith('finding:') ? graphFocus.slice('finding:'.length) : null}
              selectedStorylineId={graphFocus?.startsWith('storyline:') ? graphFocus.slice('storyline:'.length) : null}
              focusNodeId={focusedNpi ?? null}
              highlightNodeId={focusedNpi ?? null}
              openFullGraphHref={focusedNpi ? `/graph?npi=${focusedNpi}` : '/graph'}
              loading={graph.loading && !graph.data}
              error={graph.error}
              onRetry={graph.refresh}
              onSelectProvider={(p) => openProvider(p.npi, p.name)}
              onSelectGraphNode={(nodeId) => {
                if (!nodeId) return;
                openProvider(nodeId);
              }}
            />
          </div>
        </aside>
      )}
      </div>
    </div>
    </>
  );
}
