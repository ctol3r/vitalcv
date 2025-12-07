"use client";
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';

interface BoardsMapProps {
  onStateSelect: (state: string) => void;
  selectedState: string | null;
}

export default function BoardsMap({ onStateSelect, selectedState }: BoardsMapProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Basic topojson loading. Ensure /us.json exists in public folder.
      const topo = await fetch('/us.json').then(r => r.json());
      if (!mounted) return;

      const states = feature(topo, topo.objects.states) as any;
      const width = 880, height = 520;
      const projection = d3.geoAlbersUsa().fitSize([width, height], states);
      const path = d3.geoPath(projection);

      const svg = d3.select(ref.current)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', 'US boards map');

      svg.selectAll('*').remove();
      const g = svg.append('g');

      g.selectAll('path.state')
        .data(states.features)
        .enter()
        .append('path')
        .attr('d', path as any)
        .attr('class', 'state cursor-pointer transition-colors duration-200')
        .attr('fill', (d: any) => {
            const st = d.properties.postal;
            return st === selectedState ? '#3b82f6' : '#f1f5f9'; // blue-500 vs slate-100
        })
        .attr('stroke', '#94a3b8') // slate-400
        .attr('stroke-width', 1)
        .on('click', (_: any, d: any) => {
            onStateSelect(d.properties.postal);
        })
        .on('mouseover', function() {
           // Hover effect
           if (d3.select(this).attr('fill') !== '#3b82f6') {
               d3.select(this).attr('fill', '#bfdbfe'); // blue-200
           }
        })
        .on('mouseout', function(e: any, d: any) {
           const st = d.properties.postal;
           d3.select(this).attr('fill', st === selectedState ? '#3b82f6' : '#f1f5f9');
        });

      // Labels for states could be added here if needed, skipping for MVP clarity

    })();

    return () => { mounted = false; };
  }, [selectedState, onStateSelect]);

  return (
    <div className='relative w-full max-w-4xl mx-auto aspect-[1.7] bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden'>
      <svg ref={ref} className='w-full h-full outline-none' />
    </div>
  );
}














