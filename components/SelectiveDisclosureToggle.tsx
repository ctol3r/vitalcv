'use client';

/**
 * Selective Disclosure Toggle
 *
 * BBS+/VP "Share status only" toggle with microcopy
 * Allows users to share credential status without revealing full data
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info, Lock, Shield } from 'lucide-react';

interface SelectiveDisclosureToggleProps {
  onToggle: (enabled: boolean) => void;
  value?: boolean;
  variant?: 'full' | 'compact';
  className?: string;
}

export function SelectiveDisclosureToggle({
  onToggle,
  value = false,
  variant = 'full',
  className,
}: SelectiveDisclosureToggleProps) {
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Switch id="selective-disclosure" checked={value} onCheckedChange={onToggle} />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor="selective-disclosure" className="text-sm cursor-pointer">
                Share Status Only
              </Label>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                Reveal only verification status, not credential data (BBS+ signature)
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Selective Disclosure
            </CardTitle>
            <CardDescription>Control what information you share</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  Selective disclosure allows you to prove credential validity without revealing all
                  credential data, using zero-knowledge proofs (BBS+ signatures).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="status-only" className="font-semibold">
              Share Status Only
            </Label>
            <p className="text-sm text-muted-foreground">
              Verifier will only see validation status, not credential details
            </p>
          </div>
          <Switch id="status-only" checked={value} onCheckedChange={onToggle} />
        </div>

        {value && (
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="font-medium">Privacy Protected</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ Verifier can validate credential status</p>
              <p>✓ Credential details remain private</p>
              <p>✓ Uses BBS+ zero-knowledge proof</p>
              <p>✓ W3C Verifiable Presentation standard</p>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            <strong>How it works:</strong> When enabled, a verifiable presentation contains only
            proof of credential validity, not the credential data itself. This uses cryptographic
            techniques (BBS+ signatures) to prove claims without revealing them.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
