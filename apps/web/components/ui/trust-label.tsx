import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, Circle, X } from 'lucide-react';

export type TrustStatus = 'confirmed' | 'review' | 'unchecked' | 'blocked' | 'info';

interface TrustLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  status: TrustStatus;
  label: string;
  source?: string;
  date?: string;
  vintage?: string;
}

export function TrustLabel({ status, label, source, date, vintage, className, ...props }: TrustLabelProps) {
  const getIcon = () => {
    switch (status) {
      case 'confirmed': return <Check className="h-4 w-4 text-emerald-500" />;
      case 'review': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'unchecked': return <Circle className="h-4 w-4 text-gray-500" />;
      case 'blocked': return <X className="h-4 w-4 text-red-500" />;
      case 'info': return <div className="flex h-4 w-4 items-center justify-center rounded-full border border-sky-500 text-[10px] font-bold text-sky-500">i</div>;
    }
  };

  const formattedDetails = [
    source,
    date,
    vintage
  ].filter(Boolean).join(' — ');

  return (
    <div className={cn('flex items-start gap-2 text-sm', className)} {...props}>
      <span className="shrink-0 mt-0.5">{getIcon()}</span>
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <span className={cn(
          'font-medium',
          status === 'confirmed' ? 'text-emerald-50' :
          status === 'review' ? 'text-amber-50' :
          status === 'unchecked' ? 'text-gray-400' :
          status === 'blocked' ? 'text-red-50' :
          'text-sky-50'
        )}>
          {label}
        </span>
        {formattedDetails && (
          <span className="text-white/40 text-xs">
            ({formattedDetails})
          </span>
        )}
      </div>
    </div>
  );
}
