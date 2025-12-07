# Performance Budget Documentation

## Overview

This document defines performance budgets for VitalCV frontend applications. These budgets are enforced via Lighthouse CI and will block PRs that exceed limits.

## Budget Thresholds

### Core Web Vitals

| Metric | Target | Max Allowed | Status |
|--------|---------|-------------|--------|
| **LCP** (Largest Contentful Paint) | < 2.0s | 2.5s | ✅ Enforced |
| **FID** (First Input Delay) | < 100ms | 130ms | ✅ Enforced |
| **CLS** (Cumulative Layout Shift) | < 0.05 | 0.1 | ✅ Enforced |
| **FCP** (First Contentful Paint) | < 1.5s | 2.0s | ⚠️ Warning |
| **TBT** (Total Blocking Time) | < 200ms | 300ms | ⚠️ Warning |

### Resource Budgets

| Resource Type | Target | Max Allowed |
|---------------|---------|-------------|
| **Total JS** | < 200KB (gzipped) | 300KB |
| **Total CSS** | < 50KB (gzipped) | 75KB |
| **Images** | < 500KB | 1MB |
| **Fonts** | < 100KB | 150KB |
| **Total Page Weight** | < 1MB | 1.5MB |
| **Network Requests** | < 30 | 50 |
| **DOM Size** | < 1000 nodes | 1500 nodes |

### Page-Specific Budgets

#### `/verify` Page

**Goal:** ≥20% JS reduction, Better LCP

| Metric | Before | Target | Current |
|--------|---------|---------|---------|
| JS Bundle | 350KB | 280KB (20% reduction) | TBD |
| LCP | 2.8s | < 2.2s | TBD |
| Time to Interactive | 4.2s | < 3.5s | TBD |

**Optimizations Applied:**
- ✅ Dynamic import of QR scanner library
- ✅ Deferred loading of non-critical UI components
- ✅ Code splitting for camera/torch modules
- ✅ Lazy loading verification results panel

#### `/developers` Page

| Metric | Target | Max Allowed |
|--------|---------|-------------|
| LCP | < 2.0s | 2.5s |
| FCP | < 1.5s | 2.0s |
| JS Bundle | < 150KB | 200KB |

**Optimizations Applied:**
- ✅ Static code examples (no runtime highlighting)
- ✅ Minimal dependencies
- ✅ Server-side rendering for code snippets

#### `/wallet` Page

| Metric | Target | Max Allowed |
|--------|---------|-------------|
| LCP | < 2.2s | 2.8s |
| TBT | < 250ms | 400ms |
| CLS | < 0.05 | 0.1 |

## Lighthouse CI Configuration

Budget enforcement is automated via `.lighthouserc.json`:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}]
      }
    }
  }
}
```

## CI/CD Integration

### Pull Request Checks

Every PR runs Lighthouse CI against:
- `/verify`
- `/developers`
- `/wallet`

**Blocking Conditions:**
- Performance score < 85
- Accessibility score < 95
- LCP > 2.5s
- CLS > 0.1

**Warning Conditions:**
- Total page weight > 1MB
- JS bundle > 300KB (gzipped)
- Network requests > 50

### Running Locally

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Build and run Lighthouse
npm run build
npm run start &
lhci autorun --config=.lighthouserc.json
```

## Budget Override Process

If you need to temporarily exceed a budget:

1. **Document Justification**
   - Create an issue explaining why the override is needed
   - Link to relevant PR
   - Specify duration of override

2. **Update Config**
   - Modify `.lighthouserc.json` with new threshold
   - Add comment referencing issue number
   - Set expiration date

3. **Create Remediation Plan**
   - File follow-up issue for optimization
   - Set deadline for compliance
   - Assign owner

Example override:

```json
{
  "assertions": {
    // OVERRIDE: Issue #123 - Large credential types need optimization
    // Expires: 2025-12-31
    // Owner: @developer
    "total-byte-weight": ["warn", {"maxNumericValue": 2000000}]
  }
}
```

## Monitoring

### Production Monitoring

We use Real User Monitoring (RUM) to track actual user experience:

- **Tool:** Vercel Analytics / Web Vitals
- **Alerts:** Triggered when p75 LCP > 3.0s or CLS > 0.15
- **Dashboard:** https://vercel.com/vitalcv/analytics

### Reporting

Weekly performance report generated via:
```bash
npm run perf:report
```

Includes:
- Budget compliance status
- Trends over time
- Top pages by weight
- Recommended optimizations

## Common Optimizations

### JavaScript Reduction

- ✅ **Code Splitting:** Use `next/dynamic` for large components
- ✅ **Tree Shaking:** Remove unused code
- ✅ **Minification:** Enabled via Next.js prod build
- ✅ **Compression:** gzip/brotli via Vercel CDN

### Image Optimization

- ✅ **Next.js Image:** Use `next/image` component
- ✅ **WebP Format:** Automatic conversion
- ✅ **Lazy Loading:** Below-the-fold images
- ✅ **Responsive Images:** srcset for different sizes

### Font Optimization

- ✅ **Font Subsetting:** Include only used glyphs
- ✅ **Font Display:** Use `font-display: swap`
- ✅ **Preload:** Critical fonts in `<head>`

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Performance Budget Calculator](https://www.performancebudget.io/)

## Changelog

- **2025-11-01:** Initial budget definition for pilot launch
- **2025-11-01:** Added `/verify` specific targets (20% JS reduction)

