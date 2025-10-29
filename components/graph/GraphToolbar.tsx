'use client';

/**
 * Graph Toolbar
 *
 * Toggles for holder/issuer/verifier/cred/job node types
 * With reduced-motion support
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Award, Briefcase, CheckCircle, Eye, EyeOff, GraduationCap, Users } from 'lucide-react';

export type GraphNodeType = 'holder' | 'issuer' | 'verifier' | 'cred' | 'job';

interface NodeTypeConfig {
  id: GraphNodeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const nodeTypes: NodeTypeConfig[] = [
  {
    id: 'holder',
    label: 'Holders',
    icon: <Users className="h-4 w-4" />,
    color: 'text-blue-600',
    description: 'Credential holders',
  },
  {
    id: 'issuer',
    label: 'Issuers',
    icon: <Award className="h-4 w-4" />,
    color: 'text-green-600',
    description: 'Credential issuers',
  },
  {
    id: 'verifier',
    label: 'Verifiers',
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'text-purple-600',
    description: 'Credential verifiers',
  },
  {
    id: 'cred',
    label: 'Credentials',
    icon: <Briefcase className="h-4 w-4" />,
    color: 'text-orange-600',
    description: 'Verifiable credentials',
  },
  {
    id: 'job',
    label: 'Jobs',
    icon: <GraduationCap className="h-4 w-4" />,
    color: 'text-red-600',
    description: 'Related jobs/positions',
  },
];

interface GraphToolbarProps {
  enabled: Record<GraphNodeType, boolean>;
  onToggle: (type: GraphNodeType, enabled: boolean) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  className?: string;
}

export function GraphToolbar({
  enabled,
  onToggle,
  onShowAll,
  onHideAll,
  className,
}: GraphToolbarProps) {
  const enabledCount = Object.values(enabled).filter(Boolean).length;
  const hasReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card', className)}
    >
      {/* Show/Hide All Buttons */}
      <div className="flex items-center gap-1 border-r pr-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onShowAll}>
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show all node types</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onHideAll}>
                <EyeOff className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hide all node types</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Node Type Toggles */}
      <ToggleGroup
        type="multiple"
        value={Object.keys(enabled).filter((k) => enabled[k as GraphNodeType])}
      >
        {nodeTypes.map((type) => (
          <TooltipProvider key={type.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={type.id}
                  aria-label={`Toggle ${type.label}`}
                  onClick={() => onToggle(type.id, !enabled[type.id])}
                  className={cn(
                    'flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                    hasReducedMotion && 'transition-none',
                  )}
                  disabled={!hasReducedMotion ? undefined : false}
                >
                  {type.icon}
                  <span className={cn(enabled[type.id] && type.color)}>{type.label}</span>
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                <p>{type.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to {enabled[type.id] ? 'hide' : 'show'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </ToggleGroup>

      {/* Count Badge */}
      <Badge variant="secondary" className="ml-auto">
        {enabledCount}/{nodeTypes.length} types
      </Badge>
    </div>
  );
}

// Individual toggle button variant
interface GraphNodeToggleProps {
  type: GraphNodeType;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function GraphNodeToggle({ type, enabled, onToggle }: GraphNodeToggleProps) {
  const config = nodeTypes.find((t) => t.id === type);

  if (!config) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            pressed={enabled}
            onPressedChange={onToggle}
            aria-label={`Toggle ${config.label}`}
          >
            {config.icon}
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Get node type color
export function getNodeTypeColor(type: GraphNodeType): string {
  const config = nodeTypes.find((t) => t.id === type);
  return config?.color || 'text-gray-600';
}
