import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export interface RelationshipNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'entity' | 'artifact' | 'claim';
}

export interface RelationshipExplainerProps extends React.ComponentPropsWithoutRef<typeof Card> {
  sourceNode: RelationshipNode;
  targetNode: RelationshipNode;
  relationLabel: string;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * RelationshipExplainer
 * 
 * Visualizes the connection between an entity and an artifact/claim cleanly.
 * Black/white minimal design rendering nodes and connecting arrows.
 */
export const RelationshipExplainer = React.forwardRef<HTMLDivElement, RelationshipExplainerProps>(
  ({ className, sourceNode, targetNode, relationLabel, confidence = 'high', ...props }, ref) => {
    
    // Aesthetic variants based on component types can be expanded.
    const nodeClass = "px-4 py-3 rounded-lg border flex flex-col items-center justify-center min-w-[120px] text-center";
    
    const confidenceOpacities = {
      high: 'opacity-100',
      medium: 'opacity-60',
      low: 'opacity-30'
    };
    
    return (
      <Card 
        ref={ref} 
        className={cn('bg-black/40 border border-white/10 p-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6', className)}
        {...props}
      >
        {/* Source Node */}
        <div className={cn(nodeClass, "bg-white/[0.03] border-white/20 shadow-sm")}>
          <span className="text-[10px] uppercase tracking-widest text-white/30 mb-1 font-semibold">
            {sourceNode.type}
          </span>
          <span className="text-sm font-medium text-white/90">{sourceNode.label}</span>
          {sourceNode.sublabel && (
            <span className="text-xs text-white/40 mt-0.5">{sourceNode.sublabel}</span>
          )}
        </div>

        {/* Connector */}
        <div className={cn("flex flex-col items-center gap-1 min-w-[100px]", confidenceOpacities[confidence])}>
          <span className="text-[10px] uppercase tracking-wider text-white/50 text-center px-2 bg-black z-10 font-bold">
            {relationLabel}
          </span>
          <div className="w-full flex items-center justify-center -mt-2">
            <div className="h-[1px] w-full bg-white/20" />
            <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white/20 -ml-1 flex-shrink-0" />
          </div>
        </div>

        {/* Target Node */}
        <div className={cn(nodeClass, "bg-white/[0.05] border-white/30 shadow-md")}>
          <span className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-semibold">
            {targetNode.type}
          </span>
          <span className="text-sm font-semibold text-white">{targetNode.label}</span>
          {targetNode.sublabel && (
            <span className="text-xs text-white/50 mt-0.5">{targetNode.sublabel}</span>
          )}
        </div>
      </Card>
    );
  }
);

RelationshipExplainer.displayName = 'RelationshipExplainer';
