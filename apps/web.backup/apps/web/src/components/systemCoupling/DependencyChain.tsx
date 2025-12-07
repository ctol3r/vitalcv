'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChainLink {
  id: string;
  type: 'credential' | 'department' | 'service';
  label: string;
  value?: string;
  impact?: 'high' | 'medium' | 'low';
}

interface DependencyChainProps {
  chain: ChainLink[];
  title?: string;
  description?: string;
}

export function DependencyChain({
  chain,
  title = 'Dependency Chain',
  description = 'Shows the chain of dependencies from source to impact',
}: DependencyChainProps) {
  const getImpactColor = (impact?: 'high' | 'medium' | 'low') => {
    if (!impact) return 'bg-slate-500';
    if (impact === 'high') return 'bg-rose-500';
    if (impact === 'medium') return 'bg-orange-500';
    return 'bg-amber-500';
  };

  const getTypeColor = (type: ChainLink['type']) => {
    if (type === 'credential') return 'bg-purple-500';
    if (type === 'department') return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  if (chain.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-center text-muted-foreground">
          <div>
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No dependency chain data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          {chain.map((link, index) => (
            <div key={link.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'rounded-lg px-4 py-2 text-white font-medium text-sm min-w-[120px] text-center',
                    getTypeColor(link.type)
                  )}
                >
                  {link.label}
                </div>
                {link.value && (
                  <Badge variant="outline" className="text-xs">
                    {link.value}
                  </Badge>
                )}
                {link.impact && (
                  <Badge
                    variant="outline"
                    className={cn('text-xs', {
                      'border-rose-500 text-rose-700': link.impact === 'high',
                      'border-orange-500 text-orange-700': link.impact === 'medium',
                      'border-amber-500 text-amber-700': link.impact === 'low',
                    })}
                  >
                    {link.impact} impact
                  </Badge>
                )}
              </div>
              {index < chain.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Chain Summary */}
        <div className="mt-6 rounded-lg border bg-muted/50 p-4">
          <div className="text-sm font-medium mb-2">Chain Summary</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Length:</span>
              <span className="ml-2 font-semibold">{chain.length} links</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 font-semibold">
                {chain.map((l) => l.type).join(' → ')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Impact:</span>
              <span className="ml-2 font-semibold">
                {chain.reduce((max, link) => {
                  const impactOrder = { high: 3, medium: 2, low: 1 };
                  return link.impact && impactOrder[link.impact] > (impactOrder[max as keyof typeof impactOrder] || 0)
                    ? link.impact
                    : max;
                }, null as 'high' | 'medium' | 'low' | null) || 'unknown'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

