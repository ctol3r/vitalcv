'use client';

import { Slider } from '@/components/ui/slider';
import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';

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
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
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

  return (
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
          linkColor={() => 'rgba(148,163,184,0.6)'}
          linkWidth={(l: any) => (l.weight ? 1 + l.weight * 0.5 : 1)}
          d3VelocityDecay={0.3}
          cooldownTicks={100}
          onEngineStop={() => {
            const fg = ref.current;
            if (!fg) return;
            fg.d3Force('center').strength(center);
            fg.d3Force('charge').strength(repel);
            fg.d3Force('link').distance(linkDist).iterations(1);
          }}
        />
      </div>

      <aside className="rounded-lg border bg-white p-4 dark:bg-neutral-900 space-y-4">
        <h3 className="font-semibold">Graph Controls</h3>

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

        <div>
          <div className="mb-2 text-sm font-medium">Groups</div>
          <div className="flex flex-wrap gap-2">
            {ALL_GROUPS.map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled[g]}
                  onChange={(e) => setEnabled((s) => ({ ...s, [g]: e.target.checked }))}
                />
                <span className="capitalize">{g}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <Control
            label="Center force"
            value={center}
            min={0}
            max={1}
            step={0.05}
            onChange={setCenter}
          />
          <Control
            label="Repel force"
            value={repel}
            min={-2000}
            max={-50}
            step={50}
            onChange={setRepel}
          />
          <Control
            label="Link distance"
            value={linkDist}
            min={20}
            max={240}
            step={5}
            onChange={setLinkDist}
          />
        </div>
      </aside>
    </div>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-neutral-500">{value}</span>
      </div>
      <Slider
        defaultValue={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
