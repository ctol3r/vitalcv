'use client';

/**
 * On-Chain Verification Badge
 *
 * Shows "Verified on-chain" status with chain/network indicator
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CheckCircle2, ExternalLink, Link } from 'lucide-react';

export type BlockchainNetwork = 'polygon' | 'ethereum' | 'avalanche' | 'arbitrum' | 'optimism';

interface OnChainVerificationBadgeProps {
  txHash: string;
  network: BlockchainNetwork;
  blockNumber?: number;
  timestamp?: string;
  explorerUrl?: string;
  className?: string;
}

const networkConfig: Record<
  BlockchainNetwork,
  {
    name: string;
    color: string;
    explorerBase: string;
  }
> = {
  polygon: {
    name: 'Polygon',
    color:
      'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900 dark:text-purple-300',
    explorerBase: 'https://polygonscan.com/tx',
  },
  ethereum: {
    name: 'Ethereum',
    color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300',
    explorerBase: 'https://etherscan.io/tx',
  },
  avalanche: {
    name: 'Avalanche',
    color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300',
    explorerBase: 'https://snowtrace.io/tx',
  },
  arbitrum: {
    name: 'Arbitrum',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-300',
    explorerBase: 'https://arbiscan.io/tx',
  },
  optimism: {
    name: 'Optimism',
    color:
      'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300',
    explorerBase: 'https://optimistic.etherscan.io/tx',
  },
};

export function OnChainVerificationBadge({
  txHash,
  network,
  blockNumber,
  timestamp,
  explorerUrl,
  className,
}: OnChainVerificationBadgeProps) {
  const config = networkConfig[network];
  const explorerLink = explorerUrl || `${config.explorerBase}/${txHash}`;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2', className)}>
        {/* Verified on-chain badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'flex items-center gap-1.5 font-mono text-xs cursor-help',
                'bg-green-50 text-green-700 border-green-300',
                'dark:bg-green-950 dark:text-green-300 dark:border-green-800',
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              Verified On-Chain
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Blockchain Verified</p>
              <p>This credential has been anchored on {config.name} blockchain.</p>
              {blockNumber && <p className="text-xs">Block: {blockNumber}</p>}
              {timestamp && (
                <p className="text-xs text-muted-foreground">
                  {new Date(timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Network indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn('font-mono text-xs px-2 py-1 cursor-help', config.color)}
            >
              {config.name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Network: {config.name}</p>
          </TooltipContent>
        </Tooltip>

        {/* Transaction link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={explorerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Link className="h-3 w-3" />
              <span className="font-mono">
                {txHash.slice(0, 6)}...{txHash.slice(-4)}
              </span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">View transaction on blockchain explorer</p>
            <p className="text-xs font-mono text-muted-foreground mt-1">{txHash}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
