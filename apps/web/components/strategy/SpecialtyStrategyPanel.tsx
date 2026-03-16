import React from 'react';
import { StrategyCard } from './StrategyCard';
import { Sparkles, Users, Activity, Target, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpecialtyStrategyPanelProps {
  specialtyId: string;
  specialtyName: string;
  className?: string;
}

export const SpecialtyStrategyPanel: React.FC<SpecialtyStrategyPanelProps> = ({
  specialtyId,
  specialtyName,
  className
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Specialty Intelligence
        </h3>
        <p className="text-xs text-muted-foreground">Macro trends and capacity dynamics.</p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Market Dynamics
        </h4>
        <div className="grid gap-3">
          <StrategyCard
            title="Severe Supply Shortage Projected"
            impactLevel="strategic"
            summary={`Future demand for ${specialtyName} is rapidly outpacing new residency and fellowship graduates. Projected 35% shortfall within the next 5 years.`}
            confidence={95}
            linkedEntities={[
              { id: '1', name: 'Workforce Capacity', type: 'cluster' }
            ]}
            icon={<Clock className="w-4 h-4 text-foreground/80" />}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pressure Indicators
        </h4>
        <div className="grid gap-3">
          <StrategyCard
            title="Elevated Burnout Risk"
            impactLevel="operational"
            summary="Clinical hours and patient panel sizes for this specialty have increased notably relative to peer specialties over the past 12 months."
            confidence={88}
            linkedEntities={[
              { id: '2', name: 'Clinical Operations', type: 'institution' }
            ]}
            icon={<Activity className="w-4 h-4 text-foreground/80" />}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Top Rising Talent
        </h4>
        <div className="grid gap-3">
          <StrategyCard
            title="Recruitment Opportunity"
            impactLevel="tactical"
            summary="Identified high-velocity researchers operating in this severe shortage specialty, presenting strategic early recruitment targets."
            confidence={90}
            linkedEntities={[
              { id: '3', name: 'Dr. Sarah Chen', type: 'provider' },
              { id: '4', name: 'Dr. Michael Roberts', type: 'provider' }
            ]}
            icon={<Users className="w-4 h-4 text-foreground/80" />}
          />
        </div>
      </div>
    </div>
  );
};
