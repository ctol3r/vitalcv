"use client";
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import CompactLegend from './CompactLegend';

interface CompactInfo {
  state: string;
  rows: Array<{
    compact: string;
    special_rules?: {
      residency_move_new_multistate_days?: number;
    };
  }>;
}

export default function CompactMap() {
  const ref = useRef<SVGSVGElement>(null);
  const [focus, setFocus] = useState('CA');
  const [panel, setPanel] = useState<CompactInfo | null>(null);

  // Load overlay flags from localStorage
  const [flags, setFlags] = useState<{ psypact?: boolean; aprn?: boolean; imlc?: boolean }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('compactMapFlags');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  // Save flags to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('compactMapFlags', JSON.stringify(flags));
    }
  }, [flags]);

  const handleToggle = (key: string) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  useEffect(() => {
    (async () => {
      const topo = await fetch('/us.json').then(r => r.json());
      const states = feature(topo, topo.objects.states) as any;
      const width = 880, height = 520;
      const projection = d3.geoAlbersUsa().fitSize([width, height], states);
      const path = d3.geoPath(projection);

      const svg = d3.select(ref.current)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', 'US compact map');

      svg.selectAll('*').remove();
      const g = svg.append('g');

      const tooltip = d3.select(svg.node()?.parentElement)
        .append('div')
        .attr('class', 'absolute text-[11px] bg-white/95 border rounded px-2 py-1 shadow hidden');

      const onOpen = async (st: string) => {
        setFocus(st);
        const r = await fetch(`/api/compacts/state/${st}`);
        setPanel(await r.json());
      };

      g.selectAll('path.state')
        .data(states.features)
        .enter()
        .append('path')
        .attr('d', path as any)
        .attr('class', 'state')
        .attr('fill', async (d: any) => {
          const st = d.properties.postal;
          const info = await fetch(`/api/compacts/state/${st}`).then(r => r.json());
          const compacts = info.rows.map((r: any) => r.compact);

          // Apply color based on active overlays
          if (flags.imlc && compacts.includes('imlc')) return '#dbeafe'; // blue-100
          if (flags.aprn && compacts.includes('aprn')) return '#ccfbf1'; // teal-100
          if (flags.psypact && compacts.includes('psypact')) return '#f3e8ff'; // purple-100
          return '#f8fafc'; // default gray
        })
        .attr('stroke', '#cbd5e1')
        .attr('tabindex', 0)
        .on('mousemove', async (e: any, d: any) => {
          const st = d.properties.postal;
          const info = await fetch(`/api/compacts/state/${st}`).then(r => r.json());
          const rules = info.rows.map((r: any) => {
            let text = r.compact;
            if (r.special_rules?.residency_move_new_multistate_days) {
              text += ` (NLC move→${r.special_rules.residency_move_new_multistate_days}d)`;
            }
            return text;
          });

          // Add overlay hints if enabled
          const hasPsypact = info.rows.some((r: any) => r.compact === 'psypact');
          const hasImlc = info.rows.some((r: any) => r.compact === 'imlc');
          const hasAprn = info.rows.some((r: any) => r.compact === 'aprn');

          if (flags.psypact && hasPsypact) {
            rules.push('(tele: APIT • temp: TAP)');
          }
          if (flags.imlc && hasImlc) {
            rules.push('(IMLC: expedited physician licensing)');
          }
          if (flags.aprn && hasAprn) {
            rules.push('(APRN: multi-state practice)');
          }

          tooltip
            .style('left', e.offsetX + 12 + 'px')
            .style('top', e.offsetY + 12 + 'px')
            .classed('hidden', false)
            .text(`${st}: ${rules.join(', ') || '—'}`);
        })
        .on('mouseleave', () => tooltip.classed('hidden', true))
        .on('click', (_: any, d: any) => onOpen(d.properties.postal))
        .on('keydown', (e: any, d: any) => {
          if (e.key === 'Enter') onOpen(d.properties.postal);
        });

      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 8])
          .on('zoom', (e) => g.attr('transform', e.transform))
      );
    })();
  }, [flags]);

  return (
    <div className='relative p-3 border rounded'>
      <div className='flex items-center gap-2 text-sm'>
        <b>Compacts</b>
        <span className='opacity-60'>Focus: {focus}</span>
      </div>
      <CompactLegend flags={flags} onToggle={handleToggle} />
      <svg ref={ref} className='w-full h-[460px] outline-none' />
      {panel && (
        <div className='mt-3 text-xs'>
          <div className='font-semibold'>{panel.state}</div>
          <ul className='list-disc ml-4 mt-1'>
            {panel.rows.map((r: any, i: number) => (
              <li key={i}>
                {r.compact}
                {r.special_rules?.residency_move_new_multistate_days
                  ? ` (NLC move→${r.special_rules.residency_move_new_multistate_days}d)`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
