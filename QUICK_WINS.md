# Quick Wins - VitalCV Frontend

## Overview

High-impact, low-effort tasks for immediate user value. Target: Ship all 10 in one sprint (2 weeks).

**Total Estimated Effort**: 9 days
**Expected Impact**: 🚀 High user satisfaction & engagement

---

## Top 10 Quick Wins

### 1. Badge Level Explainer (1 day) 🟦

**Task**: Add "What's this?" popover for L0/L1/L2/L3 badges

**Impact**: Reduces confusion, improves claim flow understanding

**Implementation**:

```tsx
// components/status/ClaimStatusBadge.tsx
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const LEVEL_EXPLANATIONS = {
  0: 'Public record only - anyone can look up this NPI',
  1: 'Email verified - you control this email address',
  2: 'Document verified - license and ID uploaded & validated',
  3: 'Issuer attested - on-chain verification by trusted authority',
};

// Inside badge component:
<Popover>
  <PopoverTrigger asChild>
    <button className="ml-1 inline-flex">
      <HelpCircle className="h-3 w-3" />
    </button>
  </PopoverTrigger>
  <PopoverContent className="text-sm">
    <strong>Level {status.level}</strong>
    <p>{LEVEL_EXPLANATIONS[status.level]}</p>
  </PopoverContent>
</Popover>;
```

**Files to modify**:

- `components/status/ClaimStatusBadge.tsx`

---

### 2. Demo Mode with Sample NPI (1 day) 🟦

**Task**: Add "Try with Sample NPI" button on start page

**Impact**: Instant user engagement, safe testing without real data

**Implementation**:

```tsx
// app/start/page.tsx
const SAMPLE_NPI = '1801921148'; // Real test NPI

<div className="mt-4 text-center">
  <button
    onClick={() => {
      setNpi(SAMPLE_NPI);
      router.push(`/npi/${SAMPLE_NPI}?auto=1&demo=true`);
    }}
    className="text-sm text-neutral-600 underline hover:text-neutral-900"
  >
    Try with sample NPI →
  </button>
</div>;
```

**Files to modify**:

- `app/start/page.tsx`
- `app/npi/[npi]/page.tsx` (add demo banner)

---

### 3. Persistent Help Beacon (1 day) 🟦

**Task**: Floating help button with contextual documentation pane

**Impact**: Always-accessible support reduces user frustration

**Implementation**:

```tsx
// components/layout/HelpBeacon.tsx
'use client';
import { HelpCircle } from 'lucide-react';
import { usePanes } from '@/components/panes/PaneManager';
import { usePathname } from 'next/navigation';

const HELP_CONTENT = {
  '/start': { title: 'Getting Started', content: '...' },
  '/npi': { title: 'NPI Lookup Help', content: '...' },
  '/claim': { title: 'Claim Process', content: '...' },
};

export function HelpBeacon() {
  const { push } = usePanes();
  const pathname = usePathname();
  const help = HELP_CONTENT[pathname] || HELP_CONTENT['/start'];

  return (
    <button
      onClick={() =>
        push({ title: help.title, content: <div className="p-4">{help.content}</div> })
      }
      className="fixed bottom-6 right-6 z-50 rounded-full bg-blue-600 p-4 text-white shadow-lg hover:bg-blue-700"
      aria-label="Help"
    >
      <HelpCircle className="h-6 w-6" />
    </button>
  );
}
```

**Files to create**:

- `components/layout/HelpBeacon.tsx`
- `app/layout.tsx` (add HelpBeacon)

---

### 4. Resend OTP with Cooldown (2 days) 🟨

**Task**: Add resend button with countdown timer and SMS fallback

**Impact**: Reduces support tickets for OTP delivery issues

**Implementation**:

```tsx
// components/claim/ClaimWizardPane.tsx
const [resendCooldown, setResendCooldown] = useState(0);

useEffect(() => {
  if (resendCooldown > 0) {
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }
}, [resendCooldown]);

async function handleResendOTP() {
  setResendCooldown(60); // 60 second cooldown
  await postJSON('/api/claim/basic', { npi, email });
}

// UI:
<div className="mt-2 flex items-center gap-2">
  <button
    disabled={resendCooldown > 0}
    onClick={handleResendOTP}
    className="text-sm text-blue-600 disabled:text-neutral-400"
  >
    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
  </button>
  {resendCooldown === 0 && (
    <span className="text-xs text-neutral-500">
      Didn't receive?{' '}
      <a href="#" className="underline">
        Try SMS
      </a>
    </span>
  )}
</div>;
```

**Files to modify**:

- `components/claim/ClaimWizardPane.tsx`

---

### 5. Color Contrast Improvements (0.5 day) 🟦

**Task**: Ensure all badges and buttons meet WCAG AA+ standards

**Impact**: Accessibility compliance, better readability

**Implementation**:

```tsx
// components/status/ClaimStatusBadge.tsx
// Update palette for better contrast:
const palette = [
  'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100',
  'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100',
  'bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100',
  'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100',
];
```

**Files to audit**:

- `components/status/ClaimStatusBadge.tsx`
- `components/ui/button.tsx`
- `components/ui/badge.tsx`

**Tool**: Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

### 6. Skip-to-Main Shortcut (0.5 day) 🟦

**Task**: Add keyboard shortcut to skip navigation

**Impact**: Keyboard users can quickly access content

**Implementation**:

```tsx
// app/layout.tsx
<body>
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
  >
    Skip to main content
  </a>
  <Providers>
    <Header />
    <main id="main-content" className="min-h-screen">
      {children}
    </main>
  </Providers>
</body>
```

**Files to modify**:

- `app/layout.tsx`

---

### 7. Error ID Copy Button (1 day) 🟦

**Task**: Add "Copy Error ID" button to error banners

**Impact**: Better support communication, faster debugging

**Implementation**:

```tsx
// components/ui/error-banner.tsx
'use client';
import { Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export function ErrorBanner({ error, errorId }: { error: string; errorId: string }) {
  const [copied, setCopied] = useState(false);

  const copyErrorId = () => {
    navigator.clipboard.writeText(errorId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded border-l-4 border-red-500 bg-red-50 p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-red-800">{error}</p>
        <button onClick={copyErrorId} className="flex items-center gap-1 text-xs text-red-700">
          {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy Error ID'}
        </button>
      </div>
      <p className="mt-1 text-xs text-red-600">Error ID: {errorId}</p>
    </div>
  );
}
```

**Files to create**:

- `components/ui/error-banner.tsx`

**Usage**: Replace generic error alerts with this component

---

### 8. Route Prefetching (0.5 day) 🟦

**Task**: Preload frequently used routes (NPI→Claim)

**Impact**: Perceived performance boost, instant navigation

**Implementation**:

```tsx
// app/start/page.tsx
import Link from 'next/link';

// Replace router.push with Link:
<Link
  href={`/npi/${npi}?auto=1`}
  prefetch={true}
  className="w-full rounded bg-neutral-900 px-3 py-2 text-white"
>
  Continue
</Link>;

// Or programmatically:
import { useRouter } from 'next/navigation';

const router = useRouter();
useEffect(() => {
  // Prefetch common routes
  router.prefetch('/npi/[npi]');
  router.prefetch('/claim/[npi]');
}, [router]);
```

**Files to modify**:

- `app/start/page.tsx`
- `app/npi/[npi]/page.tsx`

---

### 9. Defer Non-Critical Analytics (0.5 day) 🟦

**Task**: Load analytics after main content is interactive

**Impact**: Faster initial page load

**Implementation**:

```tsx
// lib/analytics.ts
export function trackEvent(event: string, data?: any) {
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Send analytics event
        console.log('[Analytics]', event, data);
      });
    } else {
      setTimeout(() => {
        console.log('[Analytics]', event, data);
      }, 1000);
    }
  }
}

// Usage:
trackEvent('npi_lookup', { npi });
```

**Files to create**:

- `lib/analytics.ts`

**Files to update**:

- Replace direct analytics calls with deferred version

---

### 10. Dark Mode QR Colors (1 day) 🟦

**Task**: Optimize QR code colors for dark mode contrast

**Impact**: Better mobile scanning in dark mode

**Implementation**:

```tsx
// components/QRCodeDisplay.tsx
import { useTheme } from 'next-themes';
import QRCode from 'qrcode';

export function QRCodeDisplay({ value }: { value: string }) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const isDark = theme === 'dark';
      QRCode.toCanvas(canvasRef.current, value, {
        width: 256,
        color: {
          dark: isDark ? '#FFFFFF' : '#000000',
          light: isDark ? '#000000' : '#FFFFFF',
        },
      });
    }
  }, [value, theme]);

  return <canvas ref={canvasRef} />;
}
```

**Files to modify**:

- `components/QRCodeDisplay.tsx`

---

## Implementation Checklist

### Week 1

- [ ] Task #5: Color contrast improvements (Day 1 AM)
- [ ] Task #6: Skip-to-main shortcut (Day 1 PM)
- [ ] Task #1: Badge level explainer (Day 2)
- [ ] Task #2: Demo mode with sample NPI (Day 3)
- [ ] Task #8: Route prefetching (Day 3 PM)
- [ ] Task #9: Defer analytics (Day 3 PM)

### Week 2

- [ ] Task #3: Persistent help beacon (Day 4)
- [ ] Task #7: Error ID copy button (Day 5)
- [ ] Task #4: Resend OTP with cooldown (Days 6-7)
- [ ] Task #10: Dark mode QR colors (Day 8)

### Testing & Polish

- [ ] Lighthouse audit (target ≥90 all metrics)
- [ ] Accessibility audit with axe DevTools
- [ ] Manual testing on mobile devices
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

---

## Success Metrics

**Before** (Baseline):

- Help button clicks: N/A
- Demo mode usage: 0%
- Error ticket volume: High
- Lighthouse performance: 85
- Accessibility score: 88

**After** (Target):

- Help button clicks: <5% of sessions
- Demo mode usage: >40% of new users
- Error ticket volume: -30%
- Lighthouse performance: ≥90
- Accessibility score: ≥95

---

## Dependencies

### New Packages (Optional)

```bash
# For advanced QR features
npm i qrcode @types/qrcode
```

### No Breaking Changes

All tasks are additive enhancements - no refactoring required.

---

**Created**: October 26, 2025
**Sprint**: Sprint 1 - Quick Wins
**Status**: Ready to Start
