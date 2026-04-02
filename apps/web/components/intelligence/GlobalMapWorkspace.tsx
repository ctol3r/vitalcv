'use client';

/**
 * GlobalMapWorkspace — MAP2 + MAP3 + MAP4
 *
 * SVG-based geographic intelligence surface embedded in the intelligence console.
 * Uses react-simple-maps (no Mapbox token, no WebGL).
 *
 * Layers (toggleable):
 *   • Shortages  — state choropleth: HRSA HPSA shortage level
 *   • Institutions — circle markers: health systems by readiness
 *   • Network    — government sources / registries / federation nodes
 *
 * MAP4 interactivity: clicking an institution marker fires onSelectProvider(npi)
 * which propagates to RightContextPanel via the existing intelligence console wiring.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { AlertTriangle, Building2, Globe2, Layers, Network, RefreshCw, X } from 'lucide-react';
import type { MapInstitution } from '@/app/api/map/institutions/route';
import type { MapStateShortage, ShortageLevel } from '@/app/api/map/shortages/route';
import type { MapNetworkNode } from '@/app/api/map/network/route';

// ── US topojson from public CDN (no install needed) ───────────────────────────
const US_TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// ── Layer toggles ──────────────────────────────────────────────────────────────
type MapLayer = 'shortages' | 'institutions' | 'network';

// ── Color helpers ─────────────────────────────────────────────────────────────
const SHORTAGE_COLORS: Record<ShortageLevel, string> = {
  critical:  '#7f1d1d',  // red-900
  high:      '#991b1b',  // red-800
  moderate:  '#78350f',  // amber-900
  low:       '#1e3a5f',  // dark blue
  none:      '#0f172a',  // slate-900
  unknown:   '#1e293b',  // slate-800
};

const SHORTAGE_OPACITY: Record<ShortageLevel, number> = {
  critical: 0.85,
  high:     0.70,
  moderate: 0.55,
  low:      0.35,
  none:     0.20,
  unknown:  0.15,
};

function readinessColor(avgScore: number | null): string {
  if (!avgScore) return '#64748b';
  if (avgScore >= 85) return '#22c55e';
  if (avgScore >= 70) return '#f59e0b';
  return '#ef4444';
}

function networkNodeColor(type: MapNetworkNode['nodeType'], isSpine: boolean): string {
  if (isSpine) return '#6366f1';
  switch (type) {
    case 'government_source':    return '#818cf8';
    case 'verification_registry': return '#a78bfa';
    case 'institution':          return '#38bdf8';
    case 'staffing_network':     return '#fb923c';
    case 'federation_issuer':    return '#34d399';
    default:                     return '#64748b';
  }
}

// ── Data hooks ────────────────────────────────────────────────────────────────
function useMapLayer<T>(url: string, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url, enabled]);

  const refresh = useCallback(() => {
    setData(null);
    setLoading(true);
    setError(null);
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [url]);

  return { data, loading, error, refresh };
}

// ── Main component ────────────────────────────────────────────────────────────

interface GlobalMapWorkspaceProps {
  /** When a marker with an NPI is clicked — wires to RightContextPanel */
  onSelectProvider: (npi: string) => void;
  /** Search query from LeftSidebar — filters institution markers by name/state */
  searchQuery?: string;
}

export function GlobalMapWorkspace({ onSelectProvider, searchQuery = '' }: GlobalMapWorkspaceProps) {
  const [activeLayers, setActiveLayers] = useState<Set<MapLayer>>(
    new Set(['shortages', 'institutions']),
  );
  const [hoveredInstitution, setHoveredInstitution] = useState<MapInstitution | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MapNetworkNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([-96, 38]);
  const mapRef = useRef<HTMLDivElement>(null);

  const shortagesEnabled = activeLayers.has('shortages');
  const institutionsEnabled = activeLayers.has('institutions');
  const networkEnabled = activeLayers.has('network');

  // Build institution API URL with optional state filter from search query
  const stateFilter = searchQuery.length === 2 && /^[A-Za-z]{2}$/.test(searchQuery)
    ? `?state=${searchQuery.toUpperCase()}`
    : '';

  const shortages = useMapLayer<{ states: MapStateShortage[] }>('/api/map/shortages', shortagesEnabled);
  const institutions = useMapLayer<{ institutions: MapInstitution[] }>(`/api/map/institutions${stateFilter}`, institutionsEnabled);
  const network = useMapLayer<{ nodes: MapNetworkNode[] }>('/api/map/network', networkEnabled);

  // Client-side name filter (supplements API-level state filter)
  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredInstitutions = useMemo(() => {
    const all = institutions.data?.institutions ?? [];
    if (!normalizedQuery || normalizedQuery.length < 2) return all;
    return all.filter(
      i =>
        i.name.toLowerCase().includes(normalizedQuery) ||
        i.city.toLowerCase().includes(normalizedQuery) ||
        i.state.toLowerCase() === normalizedQuery,
    );
  }, [institutions.data, normalizedQuery]);

  // Build a lookup for shortage data by state code
  const shortageByState = useMemo(() => {
    const map = new Map<string, MapStateShortage>();
    for (const s of shortages.data?.states ?? []) {
      map.set(s.state, s);
    }
    return map;
  }, [shortages.data]);

  const toggleLayer = useCallback((layer: MapLayer) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const isLoading = shortages.loading || institutions.loading || network.loading;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--vt-surface-1, #0a0f1e)' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0">
        <Globe2 className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-semibold text-foreground/80">Global Intelligence Map</span>
        <span className="text-xs text-muted-foreground/60 ml-1">— enrichment context, not decision-grade</span>
        {normalizedQuery.length >= 2 && (
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: '#6366f122', color: '#a5b4fc', border: '1px solid #6366f133' }}>
            Filtered: "{searchQuery}" — {filteredInstitutions.length} institution{filteredInstitutions.length !== 1 ? 's' : ''}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Loading
            </span>
          )}

          {/* Layer toggles */}
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
            {([
              { id: 'shortages' as MapLayer, label: 'Shortages', color: '#991b1b' },
              { id: 'institutions' as MapLayer, label: 'Institutions', color: '#22c55e' },
              { id: 'network' as MapLayer, label: 'Network', color: '#6366f1' },
            ] as const).map(layer => (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all border
                  ${activeLayers.has(layer.id)
                    ? 'text-foreground border-transparent'
                    : 'text-muted-foreground border-border bg-transparent'
                  }
                `}
                style={activeLayers.has(layer.id) ? { background: layer.color + '33', borderColor: layer.color + '66' } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: activeLayers.has(layer.id) ? layer.color : '#334155' }}
                />
                {layer.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="relative flex-1 min-h-0 overflow-hidden" ref={mapRef}>
        <ComposableMap
          projection="geoAlbersUsa"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        >
          <ZoomableGroup
            zoom={zoom}
            center={center}
            onMoveEnd={({ zoom: z, coordinates }: { zoom: number; coordinates: [number, number] }) => {
              setZoom(z);
              setCenter(coordinates);
            }}
          >
            {/* Base geography + shortage choropleth */}
            <Geographies geography={US_TOPO_URL}>
              {({ geographies }: { geographies: import('react-simple-maps').GeographyEntity[] }) =>
                geographies.map((geo: import('react-simple-maps').GeographyEntity) => {
                  // react-simple-maps state geographies have properties.name for state name
                  // We need to match state code — use a name→code lookup
                  const stateName = geo.properties.name as string;
                  const stateCode = STATE_NAME_TO_CODE[stateName];
                  const shortage = stateCode ? shortageByState.get(stateCode) : undefined;
                  const level = shortage?.shortageLevel ?? 'unknown';

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={shortagesEnabled && shortage
                        ? SHORTAGE_COLORS[level]
                        : '#0f172a'
                      }
                      fillOpacity={shortagesEnabled && shortage
                        ? SHORTAGE_OPACITY[level]
                        : 0.6
                      }
                      stroke="#1e293b"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fillOpacity: 0.9 },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {/* Network edge rendering — SVG lines between connected nodes */}
            {networkEnabled && (() => {
              const nodes = network.data?.nodes ?? [];
              const edges = (network.data as { edges?: Array<{ sourceId: string; targetId: string; strength: number }> })?.edges ?? [];
              // Approximate AlbersUSA pixel coordinates for each known node id
              // AlbersUSA outputs to roughly a 960×610 internal space
              const nodePixels: Record<string, [number, number]> = {};
              for (const node of nodes) {
                const [px, py] = albersUsaApprox(node.lng, node.lat);
                if (px !== null && py !== null) nodePixels[node.id] = [px, py];
              }
              return edges.map((edge, i) => {
                const src = nodePixels[edge.sourceId];
                const tgt = nodePixels[edge.targetId];
                if (!src || !tgt) return null;
                return (
                  <line
                    key={`edge-${i}`}
                    x1={src[0]} y1={src[1]}
                    x2={tgt[0]} y2={tgt[1]}
                    stroke="#6366f1"
                    strokeWidth={edge.strength > 0.8 ? 1.2 : 0.6}
                    strokeOpacity={edge.strength * 0.4}
                    strokeDasharray={edge.strength > 0.8 ? 'none' : '3 4'}
                    style={{ pointerEvents: 'none' }}
                  />
                );
              });
            })()}

            {/* Network nodes layer */}
            {networkEnabled && (network.data?.nodes ?? []).map(node => (
              <Marker
                key={node.id}
                coordinates={[node.lng, node.lat]}
                onMouseEnter={(evt) => {
                  setHoveredNode(node);
                  setHoveredInstitution(null);
                  setTooltipPos({ x: evt.clientX, y: evt.clientY });
                }}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setTooltipPos(null);
                }}
              >
                <circle
                  r={node.isLaunchSpine ? 8 : 5}
                  fill={networkNodeColor(node.nodeType, node.isLaunchSpine)}
                  fillOpacity={0.85}
                  stroke={node.isLaunchSpine ? '#a5b4fc' : '#1e293b'}
                  strokeWidth={node.isLaunchSpine ? 2 : 1}
                  style={{ cursor: 'pointer' }}
                />
                {node.isLaunchSpine && (
                  <circle
                    r={12}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={1}
                    strokeOpacity={0.35}
                  />
                )}
              </Marker>
            ))}

            {/* Institution markers layer */}
            {institutionsEnabled && filteredInstitutions.map(inst => (
              <Marker
                key={inst.id}
                coordinates={[inst.lng, inst.lat]}
                onMouseEnter={(evt) => {
                  setHoveredInstitution(inst);
                  setHoveredNode(null);
                  setTooltipPos({ x: evt.clientX, y: evt.clientY });
                }}
                onMouseLeave={() => {
                  setHoveredInstitution(null);
                  setTooltipPos(null);
                }}
                onClick={() => {
                  // MAP4: wire click to right panel
                  if (inst.npi) onSelectProvider(inst.npi);
                }}
              >
                <circle
                  r={Math.max(4, Math.min(10, (inst.providerCount / 300)))}
                  fill={readinessColor(inst.avgTrustScore)}
                  fillOpacity={0.8}
                  stroke="#0f172a"
                  strokeWidth={1}
                  style={{ cursor: inst.npi ? 'pointer' : 'default' }}
                />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover tooltip */}
        {tooltipPos && (hoveredInstitution || hoveredNode) && (
          <div
            className="fixed z-50 pointer-events-none max-w-xs rounded-lg border border-border px-3 py-2.5 shadow-xl"
            style={{
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 10,
              background: '#0f172a',
              transform: 'translateY(-50%)',
            }}
          >
            {hoveredInstitution && (
              <>
                <p className="text-xs font-semibold text-foreground mb-1">{hoveredInstitution.name}</p>
                <p className="text-[10px] text-foreground/70">{hoveredInstitution.city}, {hoveredInstitution.state}</p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-foreground">
                    {hoveredInstitution.providerCount.toLocaleString()} providers
                  </span>
                  {hoveredInstitution.avgTrustScore !== null && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: readinessColor(hoveredInstitution.avgTrustScore) + '22',
                        color: readinessColor(hoveredInstitution.avgTrustScore),
                      }}
                    >
                      Avg trust {hoveredInstitution.avgTrustScore}/100
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex gap-2 text-[10px]">
                  <span className="text-emerald-400">✓ {hoveredInstitution.readyCount} ready</span>
                  <span className="text-amber-400">◐ {hoveredInstitution.partialCount} partial</span>
                  <span className="text-red-400">✕ {hoveredInstitution.blockedCount} blocked</span>
                </div>
                {hoveredInstitution.npi && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="text-[10px] text-indigo-400">Click marker to pivot right panel</p>
                    <a
                      href={`/intelligence?view=provider-profile&npi=${hoveredInstitution.npi}`}
                      className="text-[10px] text-sky-400 underline underline-offset-2 pointer-events-auto"
                      onClick={e => e.stopPropagation()}
                    >
                      Full profile →
                    </a>
                  </div>
                )}
              </>
            )}
            {hoveredNode && (
              <>
                <p className="text-xs font-semibold text-foreground mb-1">{hoveredNode.label}</p>
                <p className="text-[10px] text-foreground/70 capitalize">{hoveredNode.nodeType.replace(/_/g, ' ')}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-foreground">
                    {hoveredNode.providerCount.toLocaleString()} providers
                  </span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: '#6366f133', color: '#a5b4fc' }}
                  >
                    Coverage {hoveredNode.coverageScore}%
                  </span>
                </div>
                {hoveredNode.isLaunchSpine && (
                  <p className="mt-1.5 text-[10px] text-indigo-400 font-medium">★ Launch spine source</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 rounded-lg border border-border p-3 text-xs space-y-2"
          style={{ background: '#0a0f1edd' }}
        >
          {shortagesEnabled && (
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-1.5">Shortage Severity</p>
              <div className="flex gap-2 flex-wrap">
                {(['critical', 'high', 'moderate', 'low'] as ShortageLevel[]).map(level => (
                  <span key={level} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: SHORTAGE_COLORS[level], opacity: SHORTAGE_OPACITY[level] + 0.2 }}
                    />
                    <span className="text-foreground/70 capitalize">{level}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {institutionsEnabled && (
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-1.5">Institution Trust Score</p>
              <div className="flex gap-2">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-foreground/70">≥85</span></span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-foreground/70">70–84</span></span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-foreground/70">&lt;70</span></span>
              </div>
            </div>
          )}
          {networkEnabled && (
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] mb-1.5">Network</p>
              <div className="flex gap-2 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /><span className="text-foreground/70">Launch spine</span></span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /><span className="text-foreground/70">Institution</span></span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" /><span className="text-foreground/70">Staffing</span></span>
              </div>
            </div>
          )}
        </div>

        {/* Data note */}
        <div className="absolute bottom-4 right-4 text-[10px] text-muted-foreground/40 max-w-56 text-right leading-4">
          Contextual intelligence — enrichment only, not decision-grade.
          Shortage data: HRSA HPSA 2024.
        </div>
      </div>
    </div>
  );
}

// ── AlbersUSA approximate projection ─────────────────────────────────────────
// Converts lng/lat to approximate pixel coordinates within AlbersUSA's
// internal 960×610 SVG space. Uses a simplified linear transform calibrated
// against known reference points. Accurate enough for edge line rendering.
function albersUsaApprox(lng: number, lat: number): [number, number] {
  // Continental US bounds: lng -125 to -66, lat 25 to 50
  // AlbersUSA maps to approximately x: 30–930, y: 30–560
  if (lng < -130 || lng > -60 || lat < 20 || lat > 55) {
    // Out of continental bounds — use rough offset (AK/HI approximation)
    if (lat > 50) return [140, 500]; // Alaska approximate
    if (lng < -150) return [290, 550]; // Hawaii approximate
    return [480, 300]; // Default center
  }
  const x = ((lng - (-125)) / ((-66) - (-125))) * 880 + 40;
  const y = ((50 - lat) / (50 - 25)) * 480 + 40;
  return [x, y];
}

// ── State name → code lookup ──────────────────────────────────────────────────
// Required because react-simple-maps us-atlas provides names, not codes
const STATE_NAME_TO_CODE: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};
