import React from 'react';
import { StrategyCard } from './StrategyCard';
import { Sparkles, Building, Network, TrendingUp, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InstitutionStrategyPanelProps {
  institutionId: string;
  institutionName: string;
  className?: string;
}

export const InstitutionStrategyPanel: React.FC<InstitutionStrategyPanelProps> = ({
  institutionId,
  institutionName,
  className
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Institution Strategy
        </h3>
        <p className="text-xs text-muted-foreground">Macro trends and capacity dynamics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Network Expansion
          </h4>
          <div className="grid gap-3">
            <StrategyCard
              title="Regional Hub Formation"
              impactLevel="strategic"
              summary={`${institutionName} is rapidly expanding its regional footprint through strategic clinic acquisitions.`}
              confidence={94}
              linkedEntities={[
                { id: '1', name: 'Primary Care Market', type: 'cluster' }
              ]}
              icon={<Network className="w-4 h-4 text-foreground/80" />}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Research Momentum
          </h4>
          <div className="grid gap-3">
            <StrategyCard
              title="Cardiology Dominance"
              impactLevel="tactical"
              summary="Research output and federal funding for structural heart initiatives have outpaced regional competitors by 40% year-over-year."
              confidence={88}
              linkedEntities={[
                { id: '2', name: 'Cardiology', type: 'specialty' }
              ]}
              icon={<TrendingUp className="w-4 h-4 text-foreground/80" />}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Talent Attrition Risk
          </h4>
          <div className="grid gap-3">
            <StrategyCard
              title="Oncology Flight Risk"
              impactLevel="operational"
              summary="Elevated departure velocity detected among mid-career oncology faculty, indicating potential retention issues."
              confidence={82}
              linkedEntities={[
                { id: '3', name: 'Oncology', type: 'specialty' },
                { id: '4', name: 'Dr. Jane Smith', type: 'provider' }
              ]}
              icon={<ArrowUpRight className="w-4 h-4 text-foreground/80" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
