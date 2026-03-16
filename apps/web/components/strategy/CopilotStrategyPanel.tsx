import React from 'react';
import { StrategyCard } from './StrategyCard';
import { Sparkles, ArrowRight, BrainCircuit, MessageSquare, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CopilotStrategyInsight {
  query: string;
  insight: string;
  explanation: string;
  confidence: number;
  linkedEntities: Array<{ id: string; name: string; type: 'provider' | 'institution' | 'specialty' | 'cluster' }>;
}

export interface CopilotStrategyPanelProps {
  insight: CopilotStrategyInsight;
  className?: string;
}

export const CopilotStrategyPanel: React.FC<CopilotStrategyPanelProps> = ({
  insight,
  className
}) => {
  return (
    <div className={cn("flex flex-col gap-4 border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Strategic Advisory
          </h3>
        </div>
        <span className="text-[10px] font-medium text-indigo-500/80 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-full">
          AI Analysis
        </span>
      </div>

      <div className="flex items-start gap-3 bg-background rounded-md p-3 border border-border/50 shadow-sm">
        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
        <p className="text-sm text-foreground italic">"{insight.query}"</p>
      </div>

      <div className="space-y-3 pl-1">
        <h4 className="text-base font-semibold text-foreground tracking-tight leading-tight">
          {insight.insight}
        </h4>
        <p className="text-sm text-foreground/80 leading-relaxed">
          {insight.explanation}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="space-y-1">
            <h5 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Confidence Level</h5>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full" 
                  style={{ width: `${insight.confidence}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground">{insight.confidence}%</span>
            </div>
          </div>
        </div>

        {insight.linkedEntities.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <h5 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">Linked Assets</h5>
            <div className="grid gap-2">
              {insight.linkedEntities.map((entity, i) => (
                <div key={i} className="flex flex-col">
                  <StrategyCard
                    title={entity.name}
                    impactLevel="tactical"
                    summary={`Identified as a core target object based on ${insight.query.toLowerCase()}`}
                    variant="ghost"
                    className="border border-border/50 bg-background hover:bg-muted/50 transition-colors p-2.5"
                    icon={<Briefcase className="w-3.5 h-3.5 text-muted-foreground" />}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-2">
         <button className="text-xs font-medium text-foreground bg-background border border-border/50 hover:bg-muted/50 px-3 py-1.5 rounded-md transition-colors shadow-sm">
          Acknowledge
         </button>
         <button className="text-xs font-medium bg-foreground text-background hover:bg-foreground/90 px-3 py-1.5 rounded-md transition-colors shadow-sm flex items-center gap-1">
          Initiate Triage
          <ArrowRight className="w-3.5 h-3.5" />
         </button>
      </div>
    </div>
  );
};
