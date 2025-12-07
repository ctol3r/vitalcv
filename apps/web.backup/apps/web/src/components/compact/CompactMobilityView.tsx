'use client';

/**
 * Compact Mobility View
 *
 * Phase 3: Visualize practice rights across the country with interactive USA map
 */

import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getStatusColor, type StateDetail, generateStateDetail } from '@/lib/compact/mobility-ui';
import type { CompactRuleInput, CompactRuleOutput } from '@/lib/compact/CompactEngine';
import { CompactEngine, STATE_COMPACT_MEMBERSHIP } from '@/lib/compact/CompactEngine';

interface CompactMobilityViewProps {
  input: CompactRuleInput;
  onStateSelect?: (state: string, detail: StateDetail) => void;
}

export default function CompactMobilityView({ input, onStateSelect }: CompactMobilityViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stateDetail, setStateDetail] = useState<StateDetail | null>(null);
  const [mapData, setMapData] = useState<Map<string, CompactRuleOutput>>(new Map());

  useEffect(() => {
    // Load map data for all states
    const loadMapData = async () => {
      const states = Object.keys(STATE_COMPACT_MEMBERSHIP);
      const data = new Map<string, CompactRuleOutput>();

      states.forEach(state => {
        const evaluation = CompactEngine.evaluate(input, state);
        data.set(state, evaluation);
      });

      setMapData(data);
    };

    loadMapData();
  }, [input]);

  useEffect(() => {
    if (!svgRef.current || mapData.size === 0) return;

    const loadMap = async () => {
      try {
        const topo = await fetch('/us.json').then(r => r.json());
        const states = feature(topo, topo.objects.states) as any;
        const width = 960;
        const height = 600;
        const projection = d3.geoAlbersUsa().fitSize([width, height], states);
        const path = d3.geoPath(projection);

        const svg = d3.select(svgRef.current)
          .attr('viewBox', `0 0 ${width} ${height}`)
          .attr('role', 'img')
          .attr('aria-label', 'US compact mobility map');

        svg.selectAll('*').remove();
        const g = svg.append('g');

        const tooltip = d3.select(svg.node()?.parentElement)
          .append('div')
          .attr('class', 'absolute z-10 px-2 py-1 text-xs bg-white border rounded shadow-lg pointer-events-none opacity-0 transition-opacity')
          .style('pointer-events', 'none');

        const handleStateClick = (stateCode: string) => {
          const evaluation = mapData.get(stateCode);
          if (evaluation) {
            const detail = generateStateDetail(stateCode, evaluation);
            setSelectedState(stateCode);
            setStateDetail(detail);
            if (onStateSelect) {
              onStateSelect(stateCode, detail);
            }
          }
        };

        g.selectAll('path.state')
          .data(states.features)
          .enter()
          .append('path')
          .attr('d', path as any)
          .attr('class', 'state cursor-pointer transition-all')
          .attr('fill', (d: any) => {
            const stateCode = d.properties.postal;
            const evaluation = mapData.get(stateCode);
            if (!evaluation) return '#f3f4f6'; // gray-100

            return getStatusColor(evaluation.status);
          })
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('opacity', (d: any) => {
            const stateCode = d.properties.postal;
            return selectedState === stateCode ? 1 : 0.8;
          })
          .on('mouseenter', function(event: MouseEvent, d: any) {
            const stateCode = d.properties.postal;
            const evaluation = mapData.get(stateCode);

            d3.select(this)
              .attr('opacity', 1)
              .attr('stroke-width', 2.5);

            if (evaluation) {
              tooltip
                .html(`
                  <div class="font-semibold">${stateCode}</div>
                  <div>Status: ${evaluation.status}</div>
                  <div>States: ${evaluation.authorizedStates.length}</div>
                `)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`)
                .style('opacity', 1);
            }
          })
          .on('mouseleave', function() {
            d3.select(this)
              .attr('opacity', (d: any) => {
                const stateCode = d.properties.postal;
                return selectedState === stateCode ? 1 : 0.8;
              })
              .attr('stroke-width', 1.5);

            tooltip.style('opacity', 0);
          })
          .on('click', (event: MouseEvent, d: any) => {
            handleStateClick(d.properties.postal);
          })
          .on('keydown', (event: KeyboardEvent, d: any) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleStateClick(d.properties.postal);
            }
          })
          .attr('tabindex', 0);

        // Add zoom/pan
        svg.call(
          d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([1, 4])
            .on('zoom', (event) => {
              g.attr('transform', event.transform.toString());
            })
        );
      } catch (error) {
        console.error('Failed to load map:', error);
      }
    };

    loadMap();
  }, [mapData, selectedState, onStateSelect]);

  const eligibleCount = Array.from(mapData.values()).filter(e => e.status === 'eligible').length;
  const conditionalCount = Array.from(mapData.values()).filter(e => e.status === 'conditional').length;
  const ineligibleCount = Array.from(mapData.values()).filter(e => e.status === 'ineligible').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compact Mobility Map</CardTitle>
        <CardDescription>
          Visualize where you can practice across the United States
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('eligible') }} />
            <span>Eligible ({eligibleCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('conditional') }} />
            <span>Conditional ({conditionalCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('ineligible') }} />
            <span>Not Covered ({ineligibleCount})</span>
          </div>
        </div>

        {/* Map */}
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          <svg ref={svgRef} className="w-full h-[600px]" />
        </div>

        {/* State Detail Panel */}
        {stateDetail && selectedState && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">State: {selectedState}</CardTitle>
                <Badge variant={stateDetail.status === 'eligible' ? 'default' : 'secondary'}>
                  {stateDetail.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {stateDetail.rules.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Rules</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {stateDetail.rules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              {stateDetail.timeline.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Timeline</h4>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {stateDetail.timeline.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {stateDetail.exclusions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-red-600">Exclusions</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-red-600">
                    {stateDetail.exclusions.map((exclusion, idx) => (
                      <li key={idx}>{exclusion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {stateDetail.estimatedTime !== undefined && stateDetail.estimatedTime > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Estimated time to eligibility: {stateDetail.estimatedTime} days
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedState(null);
                  setStateDetail(null);
                }}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

