'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { GraphControls } from './GraphControls';
import { GraphNodeType, GraphToolbar } from './GraphToolbar';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type Node = {
  id: string;
  group?: 'holder' | 'issuer' | 'verifier' | 'cred' | 'job';
  label?: string;
  x?: number;
  y?: number;
};
type Link = { source: string; target: string; weight?: number };
type GraphData = { nodes: Node[]; links: Link[] };
const ALL_GROUPS = ['holder', 'issuer', 'verifier', 'cred', 'job'] as const;

export default function VitalGraph({ data }: { data: GraphData }) {
  const ref = useRef<any>(null);
  const [center, setCenter] = useState(0.5);
  const [repel, setRepel] = useState(-1000);
  const [linkDist, setLinkDist] = useState(80);
  const [enabled, setEnabled] = useState<Record<GraphNodeType, boolean>>({
    holder: true,
    issuer: true,
    verifier: true,
    cred: true,
    job: true,
  });
  const [query, setQuery] = useState('');

  const filteredData = useMemo<GraphData>(() => {
    const nodeSet = new Set(data.nodes.filter((n) => enabled[n.group ?? 'job']).map((n) => n.id));
    return {
      nodes: data.nodes.filter((n) => nodeSet.has(n.id)),
      links: data.links.filter(
        (l) => nodeSet.has(l.source as string) && nodeSet.has(l.target as string),
      ),
    };
  }, [data, enabled]);

  const colors = useMemo(
    () => ({
      holder: '#0ea5e9',
      issuer: '#22c55e',
      verifier: '#f59e0b',
      cred: '#a78bfa',
      job: '#ef4444',
    }),
    [],
  );

  function focusNode(text: string) {
    const fg = ref.current;
    if (!fg) return;
    const node = filteredData.nodes.find((n) =>
      (n.label || n.id).toLowerCase().includes(text.toLowerCase()),
    );
    if (!node) return;
    const distance = 60;
    const distRatio = 1 + distance / Math.hypot(node.x ?? 0, node.y ?? 0);
    fg.centerAt((node.x ?? 0) * distRatio, (node.y ?? 0) * distRatio, 800);
    fg.zoom(4, 1200);
  }

  function fitToView() {
    const fg = ref.current;
    if (!fg) return;
    fg.zoomToFit(400, 20);
  }

  function resetView() {
    const fg = ref.current;
    if (!fg) return;
    fg.centerAt(0, 0, 1000);
    fg.zoom(1, 1000);
  }

  function exportGraph() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `graph-${Date.now()}.png`;
    link.href = url;
    link.click();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <GraphToolbar
        enabled={enabled}
        onToggle={(type, value) => setEnabled((prev) => ({ ...prev, [type]: value }))}
        onShowAll={() =>
          setEnabled({ holder: true, issuer: true, verifier: true, cred: true, job: true })
        }
        onHideAll={() =>
          setEnabled({ holder: false, issuer: false, verifier: false, cred: false, job: false })
        }
      />

      <div className="grid h-[75vh] grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border bg-white dark:bg-neutral-900">
          <ForceGraph2D
            ref={ref}
            graphData={filteredData}
            nodeRelSize={6}
            nodeCanvasObject={(node: any, ctx, scale) => {
              const label = node.label ?? node.id;
              const color =
                node.group === 'holder'
                  ? colors.holder
                  : node.group === 'issuer'
                  ? colors.issuer
                  : node.group === 'verifier'
                  ? colors.verifier
                  : node.group === 'cred'
                  ? colors.cred
                  : colors.job;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, 5, 0, 2 * Math.PI, false);
              ctx.fill();
              const fontSize = 12 / scale;
              if (fontSize > 3) {
                ctx.font = `${fontSize}px Inter, system-ui`;
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillText(label, node.x! + 8, node.y! + 3);
              }
            }}
            linkColor={(l: any) => {
              // Highlight AI-inferred links with a different color
              return l.inferred
                ? 'rgba(139,92,246,0.8)' // Purple for AI links
                : 'rgba(148,163,184,0.6)'; // Default gray
            }}
            linkWidth={(l: any) => (l.weight ? 1 + l.weight * 0.5 : 1)}
            linkLabel={(l: any) => l.relationship || 'related'}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            onEngineStop={() => {
              const fg = ref.current;
              if (!fg) return;
              fg.d3Force('center').strength(center);
              fg.d3Force('charge').strength(repel);
              fg.d3Force('link').distance(linkDist).iterations(1);
            }}
            onNodeClick={(node: any) => {
              // Handle node click - could open sliding pane
              console.log('Node clicked:', node);
            }}
            onLinkClick={(link: any) => {
              // Handle link click - show relationship details
              console.log('Link clicked:', link);
            }}
          />
        </div>
      </div>

      <aside className="rounded-lg border bg-white p-4 dark:bg-neutral-900">
        <GraphControls
          center={center}
          repel={repel}
          linkDist={linkDist}
          onCenterChange={setCenter}
          onRepelChange={setRepel}
          onLinkDistChange={setLinkDist}
          onReset={resetView}
          onFitToView={fitToView}
        />

        <div className="mt-4 space-y-4 border-t pt-4">
          <h3 className="font-semibold">Search & Actions</h3>

          <div className="space-y-2">
            <label className="text-sm">Search / Focus</label>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ID or label…"
                className="w-full rounded border p-2 text-sm"
              />
              <button
                onClick={() => focusNode(query)}
                className="rounded bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-neutral-900"
              >
                Focus
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm">Search / Focus</label>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ID or label..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button size="sm" onClick={() => focusNode(query)}>
                Focus
              </Button>
            </div>
          </div>

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={exportGraph} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Export Graph as PNG
          </Button>
        </div>
      </aside>
    </div>
  );
}
