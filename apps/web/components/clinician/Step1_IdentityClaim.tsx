'use client';

import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Building, Loader2, Search, Shield } from 'lucide-react';
import type { DataState, NpiIdentityResult } from './intake-types';
import { formatDisplayValue } from './intake-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface Step1Props {
  npi: string;
  onNpiChange: (value: string) => void;
  npiState: DataState;
  npiResult: NpiIdentityResult | null;
  npiValidationError: string | null;
  npiApiError: string | null;
  npiAuditRef: string | null;
  onLookup: () => void;
  npiInputRef: React.RefObject<HTMLInputElement | null>;
}

/* ------------------------------------------------------------------ */
/*  ResultPanel — shared data-state wrapper                            */
/* ------------------------------------------------------------------ */

function ResultPanel({
  state,
  error,
  children,
}: {
  state: DataState;
  error: string | null;
  children: React.ReactNode;
}) {
  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Looking up…</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-destructive/5 border border-destructive/20 p-4">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-destructive">{error || 'Lookup interrupted. Please try again.'}</p>
      </div>
    );
  }

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/*  Identity display entries                                           */
/* ------------------------------------------------------------------ */

const IDENTITY_PRIORITY_KEYS = [
  'full_name',
  'npi',
  'provider_type',
  'primary_specialty',
  'primary_practice_state',
  'status',
] as const;

/* ------------------------------------------------------------------ */
/*  Step1_IdentityClaim                                                */
/* ------------------------------------------------------------------ */

export function Step1_IdentityClaim({
  npi,
  onNpiChange,
  npiState,
  npiResult,
  npiValidationError,
  npiApiError,
  npiAuditRef,
  onLookup,
  npiInputRef,
}: Step1Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold font-heading">
          1
        </div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Identity Claim
        </h2>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            NPI Lookup
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="npi-input" className="text-sm">
              National Provider Identifier
            </Label>
            <div className="flex gap-2">
              <Input
                ref={npiInputRef}
                id="npi-input"
                type="text"
                inputMode="numeric"
                placeholder="Enter 10-digit NPI"
                maxLength={10}
                value={npi}
                onChange={(e) => onNpiChange(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onLookup();
                }}
                className="font-mono"
              />
              <Button
                onClick={onLookup}
                disabled={npiState === 'loading'}
                size="default"
              >
                {npiState === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2">Lookup</span>
              </Button>
            </div>
            {npiValidationError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {npiValidationError}
              </p>
            )}
          </div>

          <ResultPanel state={npiState} error={npiApiError}>
            {npiResult && (
              <GlassCard weight="heavy" className="space-y-3">
                <GlassCardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-sm">
                        {String((npiResult as Record<string, unknown>).full_name ?? 'Provider')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        NPI {String((npiResult as Record<string, unknown>).npi ?? npi)}
                      </p>
                    </div>
                    {npiAuditRef && (
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded">
                        ref:{npiAuditRef}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2">
                    {IDENTITY_PRIORITY_KEYS.map((key) => {
                      const value = (npiResult as Record<string, unknown>)[key];
                      if (value == null || value === '') return null;
                      return (
                        <div
                          key={key}
                          className="flex items-baseline justify-between text-sm gap-4"
                        >
                          <span className="text-muted-foreground capitalize text-xs">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="font-medium text-right truncate max-w-[60%]">
                            {formatDisplayValue(key, value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Verified via NPPES registry</span>
                  </div>
                </GlassCardContent>
              </GlassCard>
            )}
          </ResultPanel>
        </GlassCardContent>
      </GlassCard>
    </section>
  );
}
