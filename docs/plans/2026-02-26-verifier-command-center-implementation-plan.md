# Verifier Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Employer Dashboard at `apps/web/app/verifier/page.tsx` utilizing a split-pane architecture with a mock data layer and a cryptographic terminal.

**Architecture:** We are using a "Clean Slate" approach by building a new `<CommandCenterPortal />` instead of mutating the existing `<VerifierPortal />`. The layout uses a split-pane design (`flex-row h-[calc(100vh-80px)]`) where the left pane is an inbound queue of candidates, and the right pane shows candidate details, a massive "Instant Approve" button (disabled unless L3), and a Cryptographic Audit Terminal. A new mock data provider (`createSafeFallbackState`) will be added to `apps/web/lib/api.ts`.

**Tech Stack:** React, Next.js, Tailwind CSS, Lucide React

---

### Task 1: Add Mock Data Provider to API Lib

**Files:**
- Modify: `apps/web/lib/api.ts`

**Step 1: Define Mock Types and Data Provider**

Modify `apps/web/lib/api.ts` to export new types and a mock fallback state.

```typescript
export type VerificationLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type ReadinessBand = 'Not Ready' | 'Conditionally Ready' | 'Ready';

export interface CommandCandidate {
  id: string;
  name: string;
  npi: string;
  trustLevel: VerificationLevel;
  readinessBand: ReadinessBand;
  readinessScore: number;
  logs: string[];
}

export function createSafeFallbackState(): CommandCandidate[] {
  return [
    {
      id: 'cand:1',
      name: 'Alice Smith, MD',
      npi: '1234567890',
      trustLevel: 'L3',
      readinessBand: 'Ready',
      readinessScore: 100,
      logs: [
        '[08:42:11.15] Checking ES256 cryptographic signatures...',
        '[08:42:11.89] State License signature matched to CA Medical Board DID.',
        '[08:42:12.10] ✓ L3 Bundle mathematically proven. Readiness Score: 100/100.',
      ],
    },
    {
      id: 'cand:2',
      name: 'Bob Jones, DO',
      npi: '0987654321',
      trustLevel: 'L1',
      readinessBand: 'Not Ready',
      readinessScore: 35,
      logs: [
        '[09:15:02.00] Verifying provided credentials...',
        '[09:15:02.50] State License found, but cryptographic signature is missing or invalid.',
        '[09:15:02.75] ⚠ L1 fallback activated. Readiness Score: 35/100.',
      ],
    },
    {
      id: 'cand:3',
      name: 'Charlie Davis, RN',
      npi: '1122334455',
      trustLevel: 'L2',
      readinessBand: 'Conditionally Ready',
      readinessScore: 75,
      logs: [
        '[10:05:44.12] Authenticating verifiable credentials...',
        '[10:05:44.88] Verified partial credential chain. DEA license pending primary source verification.',
        '[10:05:45.02] ⚠ L2 Conditional state reached. Readiness Score: 75/100.',
      ],
    },
    {
      id: 'cand:4',
      name: 'Diana Prince, NP',
      npi: '5544332211',
      trustLevel: 'L0',
      readinessBand: 'Not Ready',
      readinessScore: 0,
      logs: [
        '[11:20:01.05] Initiating trust state resolution...',
        '[11:20:01.40] No credentials found in decentralized wallet.',
        '[11:20:01.60] ✖ L0 Unknown state. Readiness Score: 0/100.',
      ],
    },
  ];
}
```

**Step 2: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(api): Add createSafeFallbackState mock provider and types"
```

---

### Task 2: Create CandidateQueue Component

**Files:**
- Create: `apps/web/components/employer/CandidateQueue.tsx`

**Step 1: Write minimal implementation**

Create a component that renders the left pane queue.

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { CommandCandidate } from '@/lib/api';

interface CandidateQueueProps {
  candidates: CommandCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CandidateQueue({ candidates, selectedId, onSelect }: CandidateQueueProps) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-muted/10">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search candidates by name or NPI..." className="pl-9" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {candidates.map((cand) => (
          <button
            key={cand.id}
            onClick={() => onSelect(cand.id)}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              selectedId === cand.id
                ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                : 'bg-card border-border hover:bg-muted/50'
            }`}
          >
            <div className="font-medium text-sm">{cand.name}</div>
            <div className="text-xs text-muted-foreground mt-1 flex justify-between">
              <span>NPI: {cand.npi}</span>
              <span
                className={`font-mono px-1.5 py-0.5 rounded ${
                  cand.trustLevel === 'L3'
                    ? 'bg-green-500/10 text-green-600'
                    : cand.trustLevel === 'L2'
                    ? 'bg-yellow-500/10 text-yellow-600'
                    : 'bg-red-500/10 text-red-600'
                }`}
              >
                {cand.trustLevel}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/employer/CandidateQueue.tsx
git commit -m "feat(ui): Add CandidateQueue component for Command Center"
```

---

### Task 3: Create CryptoTerminal Component

**Files:**
- Create: `apps/web/components/employer/CryptoTerminal.tsx`

**Step 1: Write minimal implementation**

Create a component for the dark-mode terminal window.

```tsx
'use client';

import { CommandCandidate } from '@/lib/api';
import { useEffect, useState } from 'react';

interface CryptoTerminalProps {
  candidate: CommandCandidate | null;
}

export function CryptoTerminal({ candidate }: CryptoTerminalProps) {
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);

  useEffect(() => {
    setVisibleLogs([]);
    if (!candidate) return;

    let timeoutIds: NodeJS.Timeout[] = [];
    
    // Simulate animated logs typing out
    candidate.logs.forEach((log, index) => {
      const id = setTimeout(() => {
        setVisibleLogs((prev) => [...prev, log]);
      }, 500 * (index + 1));
      timeoutIds.push(id);
    });

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [candidate]);

  if (!candidate) {
    return (
      <div className="bg-gray-900 text-blue-400/50 font-mono text-sm p-4 rounded-md h-48 flex items-center justify-center border border-gray-800">
        Awaiting candidate selection...
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-blue-400 font-mono text-sm p-4 rounded-md h-48 overflow-y-auto border border-gray-800 shadow-inner flex flex-col">
      <div className="text-gray-500 text-xs mb-2 pb-2 border-b border-gray-800 flex justify-between">
        <span>VITALCV_SECURE_TERMINAL_v2.2</span>
        <span>AUTH_SESSION_ACTIVE</span>
      </div>
      <div className="space-y-1 flex-1">
        {visibleLogs.map((log, i) => (
          <div key={i} className="animate-[fade-in_0.2s_ease-in-out]">
            {log}
          </div>
        ))}
        {visibleLogs.length < candidate.logs.length && (
          <div className="animate-pulse">_</div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/employer/CryptoTerminal.tsx
git commit -m "feat(ui): Add CryptoTerminal component for cryptographic logs"
```

---

### Task 4: Create CandidateGoldenRecord Component

**Files:**
- Create: `apps/web/components/employer/CandidateGoldenRecord.tsx`

**Step 1: Write minimal implementation**

Create a component that houses candidate details, the instant approve button, and the crypto terminal.

```tsx
'use client';

import { CommandCandidate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ShieldCheck, UserCircle2, ShieldAlert } from 'lucide-react';
import { CryptoTerminal } from './CryptoTerminal';

interface CandidateGoldenRecordProps {
  candidate: CommandCandidate | null;
}

export function CandidateGoldenRecord({ candidate }: CandidateGoldenRecordProps) {
  if (!candidate) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center space-y-4 max-w-sm">
          <UserCircle2 className="h-16 w-16 mx-auto opacity-20" />
          <h2 className="text-lg font-medium text-foreground">No Candidate Selected</h2>
          <p className="text-sm">Select a candidate from the inbound queue to view their cryptographic trust record.</p>
        </div>
      </div>
    );
  }

  const isL3 = candidate.trustLevel === 'L3';

  return (
    <div className="h-full flex flex-col p-8 space-y-8 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
      
      {/* Header Profile */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{candidate.name}</h1>
          <p className="text-muted-foreground mt-1">NPI: {candidate.npi}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Current Trust State
          </div>
          <div className="flex items-center gap-2 justify-end">
            {isL3 ? (
              <ShieldCheck className="h-6 w-6 text-green-500" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-yellow-500" />
            )}
            <span className={`text-2xl font-bold font-mono ${isL3 ? 'text-green-500' : 'text-yellow-500'}`}>
              {candidate.trustLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Massive Instant Approve CTA */}
      <div className="py-6 border-y border-border flex flex-col items-center space-y-4">
        <Button 
          size="lg" 
          disabled={!isL3}
          className={`w-full max-w-md h-16 text-lg font-semibold tracking-wide transition-all ${
            isL3 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20' 
              : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50'
          }`}
        >
          {isL3 ? 'INSTANT APPROVE' : 'APPROVAL DISABLED: REQUIRES L3 PROOF'}
        </Button>
        {!isL3 && (
          <p className="text-xs text-muted-foreground text-center">
            Zero-Knowledge Proofs are insufficient or missing. Manual review required.
          </p>
        )}
      </div>

      {/* Cryptographic Terminal */}
      <div className="flex-1 min-h-[250px] flex flex-col">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">
          Cryptographic Audit Trail
        </h3>
        <CryptoTerminal candidate={candidate} />
      </div>

    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/employer/CandidateGoldenRecord.tsx
git commit -m "feat(ui): Add CandidateGoldenRecord component for right pane"
```

---

### Task 5: Assemble CommandCenterPortal

**Files:**
- Create: `apps/web/components/employer/CommandCenterPortal.tsx`

**Step 1: Write minimal implementation**

Combine the queue and golden record into the split-pane layout.

```tsx
'use client';

import { useState, useMemo } from 'react';
import { createSafeFallbackState, CommandCandidate } from '@/lib/api';
import { CandidateQueue } from './CandidateQueue';
import { CandidateGoldenRecord } from './CandidateGoldenRecord';

export function CommandCenterPortal() {
  const candidates = useMemo(() => createSafeFallbackState(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCandidate = useMemo(() => {
    return candidates.find(c => c.id === selectedId) || null;
  }, [candidates, selectedId]);

  return (
    <div className="flex flex-row w-full h-[calc(100vh-80px)] overflow-hidden bg-background">
      {/* Left Pane - w-1/3 */}
      <div className="w-1/3 min-w-[320px] max-w-[450px] h-full shadow-sm z-10">
        <CandidateQueue 
          candidates={candidates} 
          selectedId={selectedId} 
          onSelect={setSelectedId} 
        />
      </div>

      {/* Right Pane - w-2/3 */}
      <div className="flex-1 h-full bg-background relative z-0">
        <CandidateGoldenRecord candidate={selectedCandidate} />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/employer/CommandCenterPortal.tsx
git commit -m "feat(ui): Add CommandCenterPortal orchestrator component"
```

---

### Task 6: Swap Component in Page Route

**Files:**
- Modify: `apps/web/app/verifier/page.tsx`

**Step 1: Write minimal implementation**

Replace `VerifierPortal` with `CommandCenterPortal`.

```tsx
'use client';

import { CommandCenterPortal } from '@/components/employer/CommandCenterPortal';

export default function VerifierPage() {
  return <CommandCenterPortal />;
}
```

**Step 2: Commit**

```bash
git add apps/web/app/verifier/page.tsx
git commit -m "feat(ui): Swap to CommandCenterPortal for verifier route"
```
