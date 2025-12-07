'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, ShieldCheck, AlertTriangle } from 'lucide-react';

export interface ProofPayload {
  presentationId: string;
  generatedAt: string;
  verificationSummary: {
    status: string;
    valid: boolean;
    credentialType?: string;
    holder?: {
      subject?: string;
    };
  };
  issuerMetadata: {
    did: string;
    name?: string;
    thumbprint?: string;
    kid?: string;
  };
  timestamps: {
    verifiedAt: string;
    expiresAt?: string;
  };
  auditAnchors: {
    txHash: string;
    blockHash: string;
    blockNumber: number;
    merkleProof: string[];
    network: string;
    status: string;
  };
  revocation: {
    revoked: boolean;
    statusListUrl?: string;
  };
  raw: {
    vpToken: string;
    payload: Record<string, any>;
  };
}

interface ProofDrawerProps {
  proof: ProofPayload;
}

export function ProofDrawer({ proof }: ProofDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleCopy = useCallback(
    async (value: string, label: string) => {
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard.`,
      });
    },
    [toast],
  );

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DrawerContent className="mx-auto w-full max-w-3xl">
        <DrawerHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-xl">Technical Proof</DrawerTitle>
            {proof.verificationSummary.valid ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                <ShieldCheck className="h-4 w-4" />
                Valid
              </Badge>
            ) : (
              <Badge className="gap-1 bg-red-100 text-red-700 border-red-200" variant="outline">
                <AlertTriangle className="h-4 w-4" />
                {proof.verificationSummary.status}
              </Badge>
            )}
          </div>
          <DrawerDescription>
            Anchored verification evidence for presentation {proof.presentationId}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 px-6 pb-6">
          <section className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase text-muted-foreground">Issuer DID</span>
              <span className="font-mono text-xs break-all">{proof.issuerMetadata.did}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase text-muted-foreground">Key thumbprint</span>
              <span className="font-mono text-xs break-all">
                {proof.issuerMetadata.thumbprint || '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase text-muted-foreground">Key ID</span>
              <span className="font-mono text-xs break-all">{proof.issuerMetadata.kid || '—'}</span>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Raw VP Token</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => handleCopy(proof.raw.vpToken, 'VP token')}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <ScrollArea className="max-h-64 rounded-md border bg-muted/40 p-3">
              <pre className="text-xs font-mono text-wrap break-all">
                {proof.raw.vpToken}
              </pre>
            </ScrollArea>
          </section>

          <section className="space-y-3 rounded-lg border bg-background p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Block hash</span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => handleCopy(proof.auditAnchors.blockHash, 'Block hash')}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <p className="font-mono text-xs break-all">{proof.auditAnchors.blockHash}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs uppercase text-muted-foreground">Tx hash</span>
                <p className="font-mono text-xs break-all">{proof.auditAnchors.txHash}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Network</span>
                <p className="font-medium">{proof.auditAnchors.network}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Block number</span>
                <p className="font-mono text-xs">{proof.auditAnchors.blockNumber}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted-foreground">Status</span>
                <p className="font-medium capitalize">{proof.auditAnchors.status}</p>
              </div>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Merkle proof</span>
              <div className="mt-2 space-y-1">
                {proof.auditAnchors.merkleProof.map((leaf) => (
                  <p key={leaf} className="font-mono text-[11px] break-all">
                    {leaf}
                  </p>
                ))}
              </div>
            </div>
          </section>
        </div>

        <DrawerFooter className="gap-3">
          <Button
            className="gap-2"
            asChild
          >
            <a
              href={`/api/verify/export/${proof.presentationId}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </a>
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

