'use client';

/**
 * ClaimStatusBadge - Display claim level (L0-L3) with transaction link
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ExternalLink, Info } from 'lucide-react';

export type ClaimLevel = 0 | 1 | 2 | 3;

interface ClaimStatusBadgeProps {
  level: ClaimLevel;
  txHash?: string;
  txUrl?: string;
  className?: string;
}

const LEVEL_CONFIG = {
  0: {
    label: 'L0: Unclaimed',
    color: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
    description: 'Public NPPES record only. No identity verification.',
  },
  1: {
    label: 'L1: Email Verified',
    color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300',
    description: 'Email or phone verified via OTP.',
  },
  2: {
    label: 'L2: Identity Verified',
    color:
      'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300',
    description: 'Documents uploaded and identity confidence score calculated.',
  },
  3: {
    label: 'L3: Issuer Attested',
    color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300',
    description: 'Authorized issuer has attested to your credentials on-chain.',
  },
} as const;

export function ClaimStatusBadge({ level, txHash, txUrl, className }: ClaimStatusBadgeProps) {
  const config = LEVEL_CONFIG[level];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn('font-mono text-xs px-3 py-1 cursor-help', config.color)}
            >
              {config.label}
              <Info className="ml-1 h-3 w-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{config.description}</p>
            {level > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {level === 1 && 'Complete document upload to reach L2.'}
                {level === 2 && 'Request issuer attestation to reach L3.'}
                {level === 3 && 'Maximum verification level achieved.'}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {txHash && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  if (txUrl) {
                    window.open(txUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                aria-label="View transaction on blockchain"
              >
                <span className="font-mono">tx: {txHash.slice(0, 8)}...</span>
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">View transaction on blockchain explorer</p>
              <p className="text-xs font-mono text-muted-foreground mt-1">{txHash}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// Helper to get next level requirements
export function getNextLevelRequirements(currentLevel: ClaimLevel): string | null {
  if (currentLevel === 0) return 'Verify your email or phone number';
  if (currentLevel === 1) return 'Upload identity documents and selfie';
  if (currentLevel === 2) return 'Request attestation from an authorized issuer';
  return null; // L3 is max
}
