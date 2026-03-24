'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, FileText } from 'lucide-react';

export interface ClaimExplanationProps {
  subject: string;
  predicate: string;
  objectValue: string;
  issuer: string;
  confidenceContext?: string;
  className?: string;
}

export function ClaimExplanation({
  subject,
  predicate,
  objectValue,
  issuer,
  confidenceContext,
  className
}: ClaimExplanationProps) {
  return (
    <div className={cn("font-sans border border-black p-5 bg-white text-black", className)}>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4" />
        <h3 className="text-xs font-bold uppercase tracking-widest">Claim Semantic</h3>
      </div>
      
      <div className="p-4 bg-neutral-50 border border-neutral-200 mb-4 rounded-sm">
        <p className="text-lg leading-snug">
          <span className="font-semibold">{issuer}</span> asserts that{' '}
          <span className="bg-black text-white px-1.5 py-0.5 rounded-sm text-sm inline-block mx-1">
            {subject}
          </span>{' '}
          <span className="italic text-neutral-600 font-medium">{predicate}</span>{' '}
          <span className="font-semibold underline decoration-2 underline-offset-4">
            {objectValue}
          </span>.
        </p>
      </div>

      {confidenceContext && (
        <div className="flex items-start gap-2 mt-4 pt-4 border-t border-neutral-200">
          <ArrowRight className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-black uppercase tracking-wider mr-2">Context</span>
            {confidenceContext}
          </p>
        </div>
      )}
    </div>
  );
}
