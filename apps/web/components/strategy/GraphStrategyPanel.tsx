import React from 'react';
import { StrategyCard } from './StrategyCard';
import { Sparkles, Network, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GraphStrategyPanelProps {
  selectedNodeId?: string;
  selectedNodeType?: 'provider' | 'institution' | 'specialty';
  selectedNodeName?: string;
  className?: string;
}

export const GraphStrategyPanel: React.FC<GraphStrategyPanelProps> = ({
  selectedNodeId,
  selectedNodeType,
  selectedNodeName,
  className
}) => {
  return (
    <div className={cn("flex flex-col h-full bg-background border-l border-border", className)}>
      <div className="p-4 border-b border-border/50">
        <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Strategic Context
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedNodeName ? `Network insights for ${selectedNodeName}` : "Select a node to view strategic insights."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedNodeId ? (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Network Intel
            </h4>
            <div className="grid gap-3">
              <StrategyCard
                title="Emerging Research Cluster"
                impactLevel="strategic"
                summary={`An isolated sub-community of high-impact research output is rapidly forming around ${selectedNodeName}. Indicates strong local leadership.`}
                confidence={92}
                linkedEntities={[
                  { id: '1', name: 'Oncology', type: 'specialty' },
                  { id: '2', name: 'Clinical Trials Network', type: 'cluster' }
                ]}
                variant="ghost"
                className="bg-card/40 border border-border/50"
              />
              <StrategyCard
                title="Structural Weakness"
                impactLevel="operational"
                summary="This node acts as a critical bottleneck for knowledge transfer between regional clinics. Departure would severely fracture the network."
                confidence={85}
                linkedEntities={[
                  { id: '4', name: 'Regional Health System', type: 'institution' }
                ]}
                variant="ghost"
                className="bg-card/40 border border-border/50"
              />
            </div>
            
            <button className="w-full flex items-center justify-between p-2 mt-2 text-xs font-medium text-foreground hover:bg-muted/50 rounded-md transition-colors border border-transparent hover:border-border/50">
              View full impact analysis
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground space-y-3">
            <Network className="w-8 h-8 opacity-20" />
            <div className="text-xs">
              Interact with the graph topology to uncover hidden bottlenecks and structural advantages.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
