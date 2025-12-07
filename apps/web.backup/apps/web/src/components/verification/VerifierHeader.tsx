import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, Lock } from 'lucide-react';

interface VerifierHeaderProps {
  title: string;
  description: string;
  proofType?: 'sd' | 'zk';
}

export function VerifierHeader({ title, description, proofType }: VerifierHeaderProps) {
  return (
    <header className="space-y-2 mb-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Badge variant="outline" className="gap-1 w-fit">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Verification
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">
            {description}
          </p>
        </div>

        {proofType === 'zk' && (
          <Badge variant="secondary" className="h-8 px-3 gap-1.5 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
            <Lock className="h-3.5 w-3.5" />
            Zero-Knowledge Verification
          </Badge>
        )}
      </div>
    </header>
  );
}














