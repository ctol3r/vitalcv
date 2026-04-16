'use client';

import React from 'react';
import { Network, TrendingUp, AlertCircle, Target, ArrowRight, Activity, Building, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImpactLevel = 'strategic' | 'tactical' | 'operational';

export interface StrategyEntity {
  id: string;
  name: string;
  type: 'provider' | 'institution' | 'specialty' | 'cluster';
}

export interface StrategyCardProps {
  title: string;
  impactLevel: ImpactLevel;
  summary: string;
  confidence?: number;
  linkedEntities?: StrategyEntity[];
  className?: string;
  variant?: 'default' | 'compact' | 'ghost';
  onClick?: () => void;
  icon?: React.ReactNode;
}

const impactConfig = {
  strategic: {
    color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    dot: 'bg-indigo-500',
    label: 'Strategic',
    icon: Target
  },
  tactical: {
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    dot: 'bg-amber-500',
    label: 'Tactical',
    icon: TrendingUp
  },
  operational: {
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    dot: 'bg-blue-500',
    label: 'Operational',
    icon: Activity
  }
};

const entityIconMap = {
  provider: <Briefcase className="w-3.5 h-3.5" />,
  institution: <Building className="w-3.5 h-3.5" />,
  specialty: <Activity className="w-3.5 h-3.5" />,
  cluster: <Network className="w-3.5 h-3.5" />
};

export const StrategyCard: React.FC<StrategyCardProps> = ({
  title,
  impactLevel,
  summary,
  confidence,
  linkedEntities = [],
  className,
  variant = 'default',
  onClick,
  icon
}) => {
  const config = impactConfig[impactLevel];
  const ImpactIcon = config.icon;

  if (variant === 'ghost') {
    return (
      <div 
        className={cn(
          "group flex flex-col gap-2 p-3 rounded-md transition-all",
          "hover:bg-muted/50",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon || <ImpactIcon className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">{title}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border",
            config.color
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
            {config.label}
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {summary}
        </p>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-border/50 bg-card/40 p-4 transition-all",
        "hover:border-border hover:bg-card/60",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border shadow-sm",
              config.color
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_4px_currentColor]", config.dot)} />
              {config.label}
            </div>
            {confidence && (
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Target className="w-3 h-3" />
                {confidence}% Confidence
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-foreground tracking-tight flex items-center gap-2 mt-1">
            {icon}
            {title}
          </h4>
        </div>
        {onClick && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {summary}
      </p>

      {linkedEntities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-1 pt-3 border-t border-border/40">
          {linkedEntities.map((entity, i) => (
            <div 
              key={i} 
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-1 rounded-md"
            >
              <div className="text-foreground/60">{entityIconMap[entity.type]}</div>
              <span className="truncate max-w-[120px]">{entity.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
