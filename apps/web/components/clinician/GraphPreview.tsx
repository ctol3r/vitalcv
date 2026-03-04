'use client';

/**
 * GraphPreview — Mini trust graph card linking to full explorer.
 * Self-contained: fetches data and renders a compact radial preview.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Network } from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';

interface GraphPreviewProps {
  npi: string;
}

interface GraphNode {
  id: string;
  label: string;
  group: string;
  val: number;
}

const NODE_COLORS: Record<string, string> = {
  clinician: '#228B22',
  issuer: '#4A90D9',
  credential: '#DAA520',
  employer: '#8B5CF6',
  policy: '#EC4899',
};

export function GraphPreview({ npi }: GraphPreviewProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || '';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

    fetch(`${normalizedBase}/api/graph/${encodeURIComponent(npi)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.nodes) setNodes(data.nodes.slice(0, 12));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [npi]);

  const layout = useMemo(() => {
    const size = 180;
    const center = size / 2;
    const clinician = nodes.find((n) => n.group === 'clinician');
    const others = nodes.filter((n) => n.group !== 'clinician');
    const result: Array<{ x: number; y: number; r: number; color: string }> = [];

    if (clinician) {
      result.push({ x: center, y: center, r: 10, color: NODE_COLORS.clinician });
    }

    others.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(others.length, 1) - Math.PI / 2;
      const radius = 55 + (i % 2) * 12;
      result.push({
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
        r: Math.max(node.val * 0.4, 4),
        color: NODE_COLORS[node.group] ?? '#888',
      });
    });

    return result;
  }, [nodes]);

  if (!loaded || nodes.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-4">
        <GlassCard>
          <GlassCardContent className="py-6 text-center">
            <Network className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Trust graph data not available</p>
            <Button asChild variant="outline" size="sm" className="mt-3 gap-2">
              <Link href={`/graph/${npi}`}>
                Open Graph Explorer <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </GlassCardContent>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-4">
      <GlassCard>
        <GlassCardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold">Trust Network</h2>
              <span className="text-xs text-muted-foreground">{nodes.length} nodes</span>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/graph/${npi}`}>
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="flex justify-center">
            <svg viewBox="0 0 180 180" className="w-44 h-44">
              {layout.map((node, i) => (
                <circle
                  key={i}
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={node.color}
                  opacity={0.75}
                />
              ))}
            </svg>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
