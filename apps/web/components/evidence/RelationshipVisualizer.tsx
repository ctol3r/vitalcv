'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Box, Shield, Building2, User } from 'lucide-react';

export interface RelationshipNode {
  id: string;
  label: string;
  type: 'claim' | 'credential' | 'source' | 'employer' | 'clinician';
}

export interface RelationshipVisualizerProps {
  source: RelationshipNode;
  target: RelationshipNode;
  relationshipType: string;
  className?: string;
}

const typeIconMap = {
  claim: Box,
  credential: Shield,
  source: Building2,
  employer: Building2,
  clinician: User,
};

export function RelationshipVisualizer({
  source,
  target,
  relationshipType,
  className,
}: RelationshipVisualizerProps) {
  const SourceIcon = typeIconMap[source.type] || Box;
  const TargetIcon = typeIconMap[target.type] || Box;

  return (
    <div className={cn("font-sans w-full max-w-md bg-white p-6 border-2 border-black", className)}>
      <div className="flex items-center justify-between relative">
        {/* Source Node */}
        <div className="flex flex-col items-center flex-1 z-10">
          <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center mb-3">
            <SourceIcon className="w-6 h-6 text-black" />
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">
            {source.type}
          </span>
          <span className="text-sm font-semibold text-center leading-tight">
            {source.label}
          </span>
        </div>

        {/* Relationship Link */}
        <div className="flex-1 flex flex-col items-center justify-center px-2 relative z-0">
          <div className="absolute inset-0 flex items-center justify-center top-[-1.5rem]">
            <div className="w-full h-0.5 bg-black" />
            <ArrowRight className="absolute right-0 w-4 h-4 bg-white text-black" />
          </div>
          <span className="mt-6 text-[10px] uppercase font-bold tracking-widest bg-white px-2 py-0.5 border border-black/10 inline-block text-center whitespace-nowrap">
            {relationshipType.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Target Node */}
        <div className="flex flex-col items-center flex-1 z-10">
          <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center mb-3">
            <TargetIcon className="w-6 h-6 text-black" />
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">
            {target.type}
          </span>
          <span className="text-sm font-semibold text-center leading-tight">
            {target.label}
          </span>
        </div>
      </div>
    </div>
  );
}
