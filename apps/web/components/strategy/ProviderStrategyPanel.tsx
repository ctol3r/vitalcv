import React from 'react';
import { StrategyCard } from './StrategyCard';
import { Sparkles, Network, TrendingDown, Target, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProviderStrategyPanelProps {
  providerId: string;
  providerName: string;
  className?: string;
}

export const ProviderStrategyPanel: React.FC<ProviderStrategyPanelProps> = ({
  providerId,
  providerName,
  className
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Strategic Context
        </h3>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Strategic Opportunities
        </h4>
        <div className="grid gap-3">
          <StrategyCard
            title="Emerging Research Leader"
            impactLevel="strategic"
            summary={`${providerName} is demonstrating a high-velocity publication trajectory in predictive oncology, placing them in the 98th percentile for their career stage.`}
            confidence={92}
            linkedEntities={[
              { id: '1', name: 'Predictive Oncology', type: 'specialty' },
              { id: '2', name: 'Precision Medicine Hub', type: 'cluster' }
            ]}
            icon={<Target className="w-4 h-4 text-foreground/80" />}
          />
          <StrategyCard
            title="Network Expansion Pivot"
            impactLevel="tactical"
            summary="Recent co-authorship patterns indicate a shift towards cross-institutional collaboration, suggesting potential for an interdisciplinary leadership role."
            confidence={78}
            linkedEntities={[
              { id: '3', name: 'Dana-Farber Cancer Institute', type: 'institution' }
            ]}
            icon={<Network className="w-4 h-4 text-foreground/80" />}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Strategic Risks
        </h4>
        <div className="grid gap-3">
          <StrategyCard
            title="Clinical Volume Saturation"
            impactLevel="operational"
            summary="Provider trajectory shows declining clinical output over the last 3 quarters, potentially constrained by excessive administrative or research load."
            confidence={85}
            linkedEntities={[
              { id: '4', name: 'Clinical Capacity', type: 'specialty' }
            ]}
            icon={<TrendingDown className="w-4 h-4 text-foreground/80" />}
          />
        </div>
      </div>
    </div>
  );
};
