'use client';

/**
 * TimeSeriesChart.tsx — Wave 131: SVG Telemetry
 *
 * Pure SVG sparkline with area fill and animated reveal.
 * No external chart libraries.
 */

import { useEffect, useRef, useState } from 'react';

export interface TimeSeriesPoint {
  t: number; // unix ms timestamp
  v: number; // value
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  label?: string;
  color?: string;      // CSS color string, default violet
  height?: number;     // px, default 56
  showAxes?: boolean;
  className?: string;
}

function toPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function toAreaPath(points: { x: number; y: number }[], height: number): string {
  if (points.length < 2) return '';
  const line = toPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${last.x.toFixed(1)},${height} L${first.x.toFixed(1)},${height} Z`;
}

export default function TimeSeriesChart({
  data,
  label,
  color = '#8b5cf6',
  height = 56,
  showAxes = false,
  className = '',
}: TimeSeriesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(200);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(el);
    setWidth(el.getBoundingClientRect().width || 200);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 800);
    return () => clearTimeout(t);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <span className="text-[10px] text-zinc-700 font-mono">no data</span>
      </div>
    );
  }

  const pad = { t: 4, b: showAxes ? 16 : 4, l: showAxes ? 28 : 0, r: 4 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;

  const minV = Math.min(...data.map((d) => d.v));
  const maxV = Math.max(...data.map((d) => d.v));
  const rangeV = maxV - minV || 1;
  const minT = data[0].t;
  const maxT = data[data.length - 1].t;
  const rangeT = maxT - minT || 1;

  const pts = data.map((d) => ({
    x: pad.l + ((d.t - minT) / rangeT) * W,
    y: pad.t + H - ((d.v - minV) / rangeV) * H,
  }));

  const linePath = toPath(pts);
  const areaPath = toAreaPath(pts, pad.t + H);
  const totalLen = linePath.length * 3; // rough stroke-dasharray length

  // Axis labels
  const tFirst = new Date(data[0].t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tLast = new Date(data[data.length - 1].t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`relative ${className}`}>
      {label && (
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      )}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-label={label}
      >
        <defs>
          <linearGradient id={`area-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#area-${label})`} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={animating ? totalLen : undefined}
          strokeDashoffset={animating ? totalLen : undefined}
          style={animating ? { transition: 'stroke-dashoffset 0.8s ease-out', strokeDashoffset: 0 } : undefined}
        />

        {/* Latest value dot */}
        {pts.length > 0 && (
          <circle
            cx={pts[pts.length - 1].x}
            cy={pts[pts.length - 1].y}
            r={3}
            fill={color}
          />
        )}

        {/* Axis labels */}
        {showAxes && (
          <>
            <text x={pad.l} y={height - 2} fontSize={9} fill="#52525b" fontFamily="monospace">{tFirst}</text>
            <text x={width - pad.r} y={height - 2} fontSize={9} fill="#52525b" fontFamily="monospace" textAnchor="end">{tLast}</text>
            <text x={pad.l - 2} y={pad.t + 4} fontSize={9} fill="#52525b" fontFamily="monospace" textAnchor="end">{maxV}</text>
            <text x={pad.l - 2} y={pad.t + H} fontSize={9} fill="#52525b" fontFamily="monospace" textAnchor="end">{minV}</text>
          </>
        )}
      </svg>
    </div>
  );
}
