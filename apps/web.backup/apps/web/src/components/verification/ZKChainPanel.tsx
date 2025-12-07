import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Link as LinkIcon, Cuboid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZKChainPanelProps {
  chainAnchor?: {
    txHash: string;
    blockNumber: number;
    proofHash: string;
  };
  className?: string;
}

export function ZKChainPanel({ chainAnchor, className }: ZKChainPanelProps) {
  if (!chainAnchor) return null;

  return (
    <Card className={cn("border-l-4 border-l-indigo-500", className)}>
      <CardHeader className="pb-3">
         <CardTitle className="text-lg flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-indigo-500" />
            Blockchain Anchor
         </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
               <span className="text-xs font-medium text-muted-foreground uppercase">Transaction Hash</span>
               <div className="font-mono text-xs break-all bg-slate-50 p-2 rounded border">
                 {chainAnchor.txHash}
               </div>
            </div>

            <div className="space-y-1">
               <span className="text-xs font-medium text-muted-foreground uppercase">Proof Hash</span>
               <div className="font-mono text-xs break-all bg-slate-50 p-2 rounded border">
                 {chainAnchor.proofHash}
               </div>
            </div>

            <div className="space-y-1">
               <span className="text-xs font-medium text-muted-foreground uppercase">Block Number</span>
               <div className="flex items-center gap-2 font-mono text-sm p-1">
                  <Cuboid className="h-4 w-4 text-muted-foreground" />
                  {chainAnchor.blockNumber}
               </div>
            </div>

            <div className="flex items-center h-full pt-4">
               <a
                 href={`https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A9944#/explorer/query/${chainAnchor.txHash}`}
                 target="_blank"
                 rel="noreferrer"
                 className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
               >
                 View on-chain <ExternalLink className="h-3 w-3" />
               </a>
            </div>
         </div>

         <div className="pt-2">
            <Badge variant="outline" className="w-full justify-center bg-indigo-50 text-indigo-700 border-indigo-200 py-1.5 font-normal">
                Cryptographically Verified on Pilot Testnet
            </Badge>
         </div>
      </CardContent>
    </Card>
  );
}














