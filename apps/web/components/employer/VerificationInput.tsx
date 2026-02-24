'use client';

import { AuthButton } from '@/components/AuthButton';
import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Building2, Loader2, ShieldCheck } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface VerificationInputProps {
  clinicianId: string;
  onClinicianIdChange: (id: string) => void;
  employerId: string;
  onEmployerIdChange: (id: string) => void;
  loading: boolean;
  onVerify: () => void;
  actionInProgress?: boolean;
}

/* ------------------------------------------------------------------ */
/*  VerificationInput — header panel with ID entry + employer tabs      */
/* ------------------------------------------------------------------ */

export function VerificationInput({
  clinicianId,
  onClinicianIdChange,
  employerId,
  onEmployerIdChange,
  loading,
  onVerify,
  actionInProgress = false,
}: VerificationInputProps) {
  const disableControls = loading || actionInProgress;
  return (
    <GlassCard weight="heavy" className="space-y-4">
      <GlassCardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-[var(--accent)]" />
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                Verifier Console
              </h1>
              <p className="text-sm text-muted-foreground">
                Trust State Inspection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => onClinicianIdChange(e.target.value)}
              className="w-48 font-mono text-sm"
              disabled={disableControls}
            />
            <Button onClick={onVerify} disabled={disableControls}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Verifying
                </>
              ) : (
                'Verify'
              )}
            </Button>
            <AuthButton />
          </div>
        </div>

        {/* Employer tabs */}
        <div className="flex items-center gap-3 pt-4 border-t border-[var(--glass-border)]">
          <EmployerTab
            label="Employer A"
            value="employer:alpha"
            selected={employerId === 'employer:alpha'}
            onSelect={onEmployerIdChange}
            disabled={disableControls}
          />
          <EmployerTab
            label="Employer B"
            value="employer:beta"
            selected={employerId === 'employer:beta'}
            onSelect={onEmployerIdChange}
            disabled={disableControls}
          />
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/*  EmployerTab                                                        */
/* ------------------------------------------------------------------ */

function EmployerTab({
  label,
  value,
  selected,
  onSelect,
  disabled = false,
}: {
  label: string;
  value: string;
  selected: boolean;
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onSelect(value);
      }}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        selected
          ? 'bg-primary/10 border border-primary/20 text-foreground'
          : 'bg-muted/30 border border-transparent text-muted-foreground hover:border-border/40'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Building2 className="h-4 w-4" />
      {label}
    </button>
  );
}
