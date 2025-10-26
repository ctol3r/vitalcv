'use client';

/**
 * TaxonomyChip - Display provider taxonomy with NPPES verification badge
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CheckCircle2, Stethoscope } from 'lucide-react';

interface TaxonomyChipProps {
  code?: string;
  description?: string;
  isPrimary?: boolean;
  isNppesVerified?: boolean;
  className?: string;
}

export function TaxonomyChip({
  code,
  description,
  isPrimary = false,
  isNppesVerified = false,
  className,
}: TaxonomyChipProps) {
  if (!code && !description) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={isPrimary ? 'default' : 'secondary'}
              className={cn(
                'flex items-center gap-1.5 cursor-help',
                isPrimary && 'bg-primary/90 hover:bg-primary',
              )}
            >
              <Stethoscope className="h-3 w-3" />
              {description || 'Medical Taxonomy'}
              {code && <span className="ml-1 text-xs opacity-70">({code})</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              {code && <p className="text-xs font-mono">Code: {code}</p>}
              {description && <p className="text-sm">{description}</p>}
              <p className="text-xs text-muted-foreground">
                {isPrimary ? 'Primary taxonomy' : 'Secondary taxonomy'}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isNppesVerified && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="flex items-center gap-1 bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800 cursor-help"
              >
                <CheckCircle2 className="h-3 w-3" />
                NPPES Verified
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">
                This taxonomy is verified by the National Plan and Provider Enumeration System
                (NPPES)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last verified: {new Date().toLocaleDateString()}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// Multiple taxonomies display
interface TaxonomyListProps {
  taxonomies: Array<{
    code: string;
    description: string;
    isPrimary?: boolean;
  }>;
  isNppesVerified?: boolean;
  className?: string;
}

export function TaxonomyList({ taxonomies, isNppesVerified, className }: TaxonomyListProps) {
  if (!taxonomies || taxonomies.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {taxonomies.map((taxonomy, idx) => (
        <TaxonomyChip
          key={idx}
          code={taxonomy.code}
          description={taxonomy.description}
          isPrimary={taxonomy.isPrimary}
          isNppesVerified={isNppesVerified && taxonomy.isPrimary}
        />
      ))}
    </div>
  );
}
