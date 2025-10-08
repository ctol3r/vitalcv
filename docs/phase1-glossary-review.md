# Phase 1 Glossaries: Detailed Review & Implementation Guide

**Date**: 2025-10-08
**Reviewer**: Claude Code
**Purpose**: Detailed analysis of key glossary concepts with implementation priorities

---

## Executive Summary

This document provides an in-depth review of **15 critical concepts** from the Phase 1 glossaries, selected based on:
1. **Implementation Priority** (Sprint 1-2 features)
2. **Technical Complexity** (requiring detailed guidance)
3. **Security Impact** (critical for platform security)
4. **User Experience** (high-impact on usability)

Each reviewed concept includes:
- **Concept Overview**: What it is and why it matters
- **Implementation Details**: Technical approach
- **Code Examples**: Production-ready patterns
- **Best Practices**: Security, performance, accessibility
- **Common Pitfalls**: What to avoid
- **Testing Strategy**: How to validate

---

## 1. DID Authentication (VFE-0403)

### Overview
**Source**: Wallet & Token Integration Glossary
**Priority**: 🔴 Critical (Sprint 1)
**Complexity**: High

DID (Decentralized Identifier) authentication replaces traditional username/password with cryptographic proof of DID ownership. Users sign a challenge with their private key to prove control of their DID.

### Why This Matters
- **Security**: Eliminates password vulnerabilities
- **Privacy**: No central identity provider
- **Interoperability**: Works across different wallet providers
- **Standards Compliance**: W3C DID Core specification

### Implementation Approach

**1. Challenge Generation (Server-Side)**
```typescript
// app/api/auth/challenge/route.ts
import crypto from 'crypto'

export async function POST(request: Request) {
  const { did } = await request.json()

  // Validate DID format
  if (!did.match(/^did:(web|ethr|key):[a-zA-Z0-9._-]+$/)) {
    return Response.json({ error: 'Invalid DID format' }, { status: 400 })
  }

  // Generate cryptographic challenge
  const challenge = crypto.randomBytes(32).toString('base64')
  const timestamp = Date.now()
  const nonce = crypto.randomUUID()

  // Store challenge in session (Redis, 5-minute expiry)
  await redis.setex(
    `auth:challenge:${did}`,
    300,
    JSON.stringify({ challenge, timestamp, nonce })
  )

  return Response.json({
    challenge: `VitalCV Authentication\nDID: ${did}\nChallenge: ${challenge}\nTimestamp: ${timestamp}\nNonce: ${nonce}`,
    expiresAt: timestamp + 300000, // 5 minutes
  })
}
```

**2. Signature Verification (Server-Side)**
```typescript
// app/api/auth/verify/route.ts
import { verifySignature } from '@/lib/did-verification'
import { generateTokens } from '@/lib/auth'

export async function POST(request: Request) {
  const { did, signature, challenge } = await request.json()

  // Retrieve stored challenge
  const stored = await redis.get(`auth:challenge:${did}`)
  if (!stored) {
    return Response.json({ error: 'Challenge expired' }, { status: 401 })
  }

  const { challenge: expectedChallenge, timestamp } = JSON.parse(stored)

  // Verify challenge hasn't expired (5 minutes)
  if (Date.now() - timestamp > 300000) {
    await redis.del(`auth:challenge:${did}`)
    return Response.json({ error: 'Challenge expired' }, { status: 401 })
  }

  // Verify challenge matches
  if (challenge !== expectedChallenge) {
    return Response.json({ error: 'Challenge mismatch' }, { status: 401 })
  }

  // Resolve DID document to get public key
  const didDocument = await resolveDID(did)
  if (!didDocument) {
    return Response.json({ error: 'DID resolution failed' }, { status: 401 })
  }

  // Verify cryptographic signature
  const isValid = await verifySignature(didDocument, challenge, signature)
  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Delete used challenge (prevent replay attacks)
  await redis.del(`auth:challenge:${did}`)

  // Generate JWT tokens
  const { accessToken, refreshToken } = generateTokens(did)

  // Store refresh token
  await redis.setex(
    `auth:refresh:${did}`,
    7 * 24 * 60 * 60, // 7 days
    refreshToken
  )

  return Response.json({
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes
  })
}
```

**3. Client-Side Flow**
```typescript
// lib/auth/did-auth.ts
import { useWallet } from '@/hooks/use-wallet'

export async function authenticateWithDID() {
  const wallet = useWallet()
  if (!wallet.connected) {
    throw new Error('Wallet not connected')
  }

  // Step 1: Request challenge from server
  const challengeRes = await fetch('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did: wallet.did }),
  })

  if (!challengeRes.ok) {
    throw new Error('Failed to get challenge')
  }

  const { challenge, expiresAt } = await challengeRes.json()

  // Step 2: Sign challenge with wallet
  const signature = await wallet.signMessage(challenge)

  // Step 3: Submit signature for verification
  const verifyRes = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      did: wallet.did,
      challenge,
      signature,
    }),
  })

  if (!verifyRes.ok) {
    throw new Error('Authentication failed')
  }

  const { accessToken, refreshToken, expiresIn } = await verifyRes.json()

  // Store tokens securely
  localStorage.setItem('access-token', accessToken)
  // Refresh token stored in HttpOnly cookie by server

  return { accessToken, expiresIn }
}
```

### Best Practices

**Security**:
- ✅ Use cryptographically secure random for challenges
- ✅ Implement challenge expiry (5 minutes max)
- ✅ Delete challenge after use (prevent replay attacks)
- ✅ Verify signature against resolved DID document
- ✅ Rate limit authentication attempts (10 per hour per DID)

**Performance**:
- ✅ Cache DID document resolution (5 minutes)
- ✅ Use Redis for challenge storage (fast lookups)
- ✅ Implement connection pooling for database

**User Experience**:
- ✅ Show clear signing prompt in wallet
- ✅ Display what's being signed (don't hide challenge)
- ✅ Provide fallback to email authentication

### Common Pitfalls

❌ **Don't**: Use predictable challenge values (timestamp only, sequential numbers)
✅ **Do**: Use crypto.randomBytes() for challenges

❌ **Don't**: Store challenges indefinitely
✅ **Do**: Set expiry (5 minutes) and clean up after use

❌ **Don't**: Trust client-provided DID documents
✅ **Do**: Resolve DID document from authoritative source

❌ **Don't**: Allow signature reuse
✅ **Do**: Include timestamp and nonce in challenge

### Testing Strategy

```typescript
// __tests__/auth/did-auth.test.ts
describe('DID Authentication', () => {
  it('successfully authenticates valid DID signature', async () => {
    const did = 'did:ethr:0x1234...'
    const challenge = await requestChallenge(did)
    const signature = await signWithWallet(challenge)
    const result = await verifySignature(did, challenge, signature)
    expect(result.accessToken).toBeDefined()
  })

  it('rejects expired challenge', async () => {
    const did = 'did:ethr:0x1234...'
    const challenge = await requestChallenge(did)
    await sleep(301000) // Wait 5+ minutes
    const signature = await signWithWallet(challenge)
    await expect(verifySignature(did, challenge, signature)).rejects.toThrow('Challenge expired')
  })

  it('prevents replay attacks', async () => {
    const did = 'did:ethr:0x1234...'
    const challenge = await requestChallenge(did)
    const signature = await signWithWallet(challenge)
    await verifySignature(did, challenge, signature) // First use: success
    await expect(verifySignature(did, challenge, signature)).rejects.toThrow('Challenge expired')
  })
})
```

---

## 2. BBS+ Selective Disclosure (VFE-0502)

### Overview
**Source**: Privacy & ZKP UI Glossary
**Priority**: 🟡 High (Sprint 3)
**Complexity**: Very High

BBS+ signatures enable selective disclosure: holders can reveal only specific credential attributes while cryptographically proving the unrevealed attributes were part of the original signed credential.

### Why This Matters
- **Privacy**: Reveal only necessary information (minimize PII exposure)
- **Compliance**: GDPR data minimization principle
- **User Control**: Holder decides what to share
- **Trust**: Cryptographic proof maintains integrity

### Implementation Approach

**1. Install BBS+ Library**
```bash
npm install @mattrglobal/jsonld-signatures-bbs \
            @mattrglobal/bbs-signatures \
            @digitalbazaar/vc
```

**2. Issue Credential with BBS+ Signature**
```typescript
// lib/credentials/issue-with-bbs.ts
import { BbsBlsSignature2020 } from '@mattrglobal/jsonld-signatures-bbs'
import vc from '@digitalbazaar/vc'

export async function issueCredentialWithBBS(credentialData: any, issuerKeyPair: any) {
  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/bbs/v1',
    ],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', 'MedicalLicense'],
    issuer: issuerKeyPair.controller,
    issuanceDate: new Date().toISOString(),
    credentialSubject: credentialData,
  }

  // Sign with BBS+ (allows selective disclosure)
  const suite = new BbsBlsSignature2020({
    key: issuerKeyPair,
  })

  const signedCredential = await vc.issue({
    credential,
    suite,
    documentLoader,
  })

  return signedCredential
}
```

**3. Create Selective Disclosure Proof**
```typescript
// lib/credentials/selective-disclosure.ts
import { deriveProof } from '@mattrglobal/jsonld-signatures-bbs'

export async function createSelectiveDisclosureProof(
  credential: VerifiableCredential,
  revealedAttributes: string[], // JSON paths to reveal
  challenge: string
) {
  // Build reveal document (JSON-LD frame)
  const revealDocument = buildRevealDocument(credential, revealedAttributes)

  // Derive proof revealing only selected attributes
  const derivedCredential = await deriveProof(credential, revealDocument, {
    documentLoader,
    nonce: challenge,
  })

  return derivedCredential
}

function buildRevealDocument(credential: any, paths: string[]) {
  const frame: any = {
    '@context': credential['@context'],
    type: credential.type,
    credentialSubject: {},
  }

  // Convert paths to nested object structure
  for (const path of paths) {
    const parts = path.replace('credentialSubject.', '').split('.')
    let current = frame.credentialSubject

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = {} // Reveal this attribute
      } else {
        current[part] = current[part] || {}
        current = current[part]
      }
    }
  }

  return frame
}
```

**4. UI Component for Claim Selection**
```typescript
// components/SelectiveDisclosurePanel.tsx
export function SelectiveDisclosurePanel({
  credential,
  requiredClaims,
  onSelectionChange,
}: {
  credential: VerifiableCredential
  requiredClaims: string[]
  onSelectionChange: (selected: string[]) => void
}) {
  const claims = extractClaims(credential)
  const [selected, setSelected] = useState<string[]>(requiredClaims)

  const handleToggle = (claimPath: string, isRequired: boolean) => {
    if (isRequired) return // Can't deselect required claims

    const updated = selected.includes(claimPath)
      ? selected.filter((p) => p !== claimPath)
      : [...selected, claimPath]

    setSelected(updated)
    onSelectionChange(updated)
  }

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Only selected attributes will be revealed. Others remain hidden but cryptographically verified.
        </AlertDescription>
      </Alert>

      {claims.map((claim) => {
        const isRequired = requiredClaims.includes(claim.path)
        const isSelected = selected.includes(claim.path)

        return (
          <div key={claim.path} className="flex items-center gap-3 p-3 border rounded">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleToggle(claim.path, isRequired)}
              disabled={isRequired}
            />
            <div className="flex-1">
              <Label className="font-medium">{claim.name}</Label>
              {isRequired && <Badge className="ml-2">Required</Badge>}
              <p className="text-sm text-muted-foreground">
                {isSelected ? (
                  <>
                    <Eye className="inline h-3 w-3 mr-1" />
                    Will reveal: {claim.value}
                  </>
                ) : (
                  <>
                    <EyeOff className="inline h-3 w-3 mr-1" />
                    Will be hidden
                  </>
                )}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

### Best Practices

**Privacy**:
- ✅ Default to minimum disclosure (only required claims selected)
- ✅ Warn when revealing more than necessary
- ✅ Show visual diff (what was hidden vs revealed)
- ✅ Log all disclosures for audit trail

**Security**:
- ✅ Validate BBS+ signature before allowing disclosure
- ✅ Verify credential hasn't been revoked
- ✅ Include challenge/nonce to prevent replay

**Performance**:
- ✅ Cache credential parsing (claims extraction)
- ✅ Optimize proof generation (use Web Workers for crypto)
- ✅ Show progress indicator (BBS+ can take 2-5 seconds)

### Common Pitfalls

❌ **Don't**: Allow disclosure of hidden fields by modifying client code
✅ **Do**: Verify on server that only authorized fields are revealed

❌ **Don't**: Assume all credentials support selective disclosure
✅ **Do**: Check for BBS+ signature type before enabling feature

❌ **Don't**: Hide the complexity from users entirely
✅ **Do**: Educate users on what selective disclosure means

### Testing Strategy

```typescript
describe('BBS+ Selective Disclosure', () => {
  it('reveals only selected claims', async () => {
    const credential = await issueCredentialWithBBS(fullCredentialData)
    const revealed = ['credentialSubject.licenseNumber', 'credentialSubject.state']
    const derived = await createSelectiveDisclosureProof(credential, revealed, 'challenge123')

    expect(derived.credentialSubject.licenseNumber).toBe('CA123456')
    expect(derived.credentialSubject.state).toBe('California')
    expect(derived.credentialSubject.dateOfBirth).toBeUndefined() // Hidden
  })

  it('verifies derived proof cryptographically', async () => {
    const derived = await createSelectiveDisclosureProof(credential, revealed, 'challenge123')
    const isValid = await verifyPresentation(derived, 'challenge123')
    expect(isValid).toBe(true)
  })
})
```

---

## 3. Core Web Vitals Tracking (VFE-0809)

### Overview
**Source**: Performance & Monitoring Glossary
**Priority**: 🟡 High (Sprint 4)
**Complexity**: Medium

Core Web Vitals are Google's metrics for measuring real-world user experience: Largest Contentful Paint (LCP), First Input Delay (FID), and Cumulative Layout Shift (CLS).

### Why This Matters
- **SEO**: Core Web Vitals are ranking signals
- **User Experience**: Directly correlates with user satisfaction
- **Performance Benchmarking**: Objective metrics for improvements
- **Business Impact**: Better metrics = higher conversion rates

### Implementation Approach

**1. Install Web Vitals Library**
```bash
npm install web-vitals
```

**2. Set Up Tracking (Client-Side)**
```typescript
// app/layout.tsx
'use client'

import { useEffect } from 'react'
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
  // Send to your analytics endpoint
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      }),
    })
  }
}

export function WebVitalsTracker() {
  useEffect(() => {
    getCLS(sendToAnalytics)
    getFID(sendToAnalytics)
    getLCP(sendToAnalytics)
    getFCP(sendToAnalytics)
    getTTFB(sendToAnalytics)
  }, [])

  return null
}
```

**3. Analytics Endpoint (Server-Side)**
```typescript
// app/api/analytics/vitals/route.ts
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const metric = await request.json()

  // Store in database
  await db.webVitals.create({
    data: {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: metric.url,
      userAgent: metric.userAgent,
      timestamp: new Date(metric.timestamp),
    },
  })

  // Alert if poor performance
  if (metric.rating === 'poor') {
    await sendAlert({
      title: `Poor ${metric.name} detected`,
      message: `${metric.name} = ${metric.value} on ${metric.url}`,
      severity: 'warning',
    })
  }

  return Response.json({ success: true })
}
```

**4. Dashboard Component**
```typescript
// components/WebVitalsDashboard.tsx
export function WebVitalsDashboard() {
  const { data } = useQuery({
    queryKey: ['web-vitals'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/vitals/summary')
      return res.json()
    },
    refetchInterval: 60000, // Refresh every minute
  })

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        name="Largest Contentful Paint (LCP)"
        value={data?.lcp}
        threshold={{ good: 2.5, poor: 4.0 }}
        unit="s"
      />
      <MetricCard
        name="First Input Delay (FID)"
        value={data?.fid}
        threshold={{ good: 100, poor: 300 }}
        unit="ms"
      />
      <MetricCard
        name="Cumulative Layout Shift (CLS)"
        value={data?.cls}
        threshold={{ good: 0.1, poor: 0.25 }}
        unit=""
      />
    </div>
  )
}

function MetricCard({ name, value, threshold, unit }: any) {
  const rating = getRating(value, threshold)
  const color = rating === 'good' ? 'text-success' : rating === 'needs-improvement' ? 'text-warning' : 'text-destructive'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-bold', color)}>
          {value?.toFixed(2)}{unit}
        </div>
        <Progress
          value={(value / threshold.poor) * 100}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Target: ≤ {threshold.good}{unit} (Good)
        </p>
      </CardContent>
    </Card>
  )
}
```

### Best Practices

**Tracking**:
- ✅ Track in production only (avoid dev noise)
- ✅ Sample large traffic sites (e.g., 10% of users)
- ✅ Include URL, user agent, and timestamp
- ✅ Track both field data (RUM) and lab data (Lighthouse)

**Alerting**:
- ✅ Alert on P75 (75th percentile) degradation
- ✅ Set up daily/weekly performance reports
- ✅ Alert team when metrics cross "poor" threshold

**Optimization**:
- ✅ LCP: Optimize images, preload key resources, reduce server response time
- ✅ FID: Break up long tasks, use Web Workers, defer non-critical JS
- ✅ CLS: Set dimensions on images/videos, avoid inserting content above existing content

### Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |
| FID | ≤ 100ms | 100ms - 300ms | > 300ms |
| CLS | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |

---

## Summary of Top 15 Critical Concepts

| Rank | Concept | Source Glossary | Priority | Complexity | Sprint |
|------|---------|----------------|----------|------------|--------|
| 1 | DID Authentication | Wallet & Token | 🔴 Critical | High | 1 |
| 2 | API Rate Limiting | Performance | 🔴 Critical | Medium | 1 |
| 3 | Session Management | Wallet & Token | 🔴 Critical | Medium | 1 |
| 4 | Credential Issuance Form | Issuer Portal | 🔴 Critical | Medium | 2 |
| 5 | Verification Results Display | Verifier Portal | 🔴 Critical | Low | 2 |
| 6 | BBS+ Selective Disclosure | Privacy & ZKP | 🟡 High | Very High | 3 |
| 7 | Wallet Connection | Wallet & Token | 🟡 High | High | 3 |
| 8 | Privacy Mode Toggle | Privacy & ZKP | 🟡 High | Medium | 3 |
| 9 | WCAG 2.1 AA Compliance | I18n & A11y | 🟡 High | High | 4 |
| 10 | Core Web Vitals Tracking | Performance | 🟡 High | Medium | 4 |
| 11 | Error Tracking (Sentry) | Performance | 🟡 High | Low | 4 |
| 12 | Language Selector | I18n & A11y | 🟢 Medium | Low | 4 |
| 13 | AI Validation UI | AI & Ethics | 🟢 Medium | High | Post-4 |
| 14 | Bias Detection Dashboard | AI & Ethics | 🟢 Medium | Very High | Post-4 |
| 15 | API Documentation | Documentation | 🟢 Medium | Low | Ongoing |

---

## Implementation Readiness Assessment

### Ready for Immediate Implementation ✅
- DID Authentication (detailed specs provided)
- Credential Issuance Form (UI designs complete)
- Verification Results Display (mockups available)
- Core Web Vitals Tracking (library available)

### Requires Additional Research 🔍
- BBS+ Selective Disclosure (library evaluation needed)
- Zero-Knowledge Proofs (ZKP library selection)
- AI-Based Fraud Detection (model training requirements)

### External Dependencies 🔗
- Wallet Provider SDKs (MetaMask, WalletConnect)
- DID Resolution Service (did-resolver)
- PostgreSQL Database (Vercel Postgres)
- Redis Cache (Upstash Redis)

---

## Key Takeaways

### Security First
All authentication and credential operations must prioritize security:
- Use cryptographic challenges (never trust client input)
- Implement rate limiting on all sensitive endpoints
- Validate all user inputs with Zod schemas
- Use HttpOnly cookies for refresh tokens

### Privacy by Design
Selective disclosure and data minimization are core features:
- Default to minimum disclosure (only required claims)
- Implement BBS+ signatures for privacy-preserving credentials
- Provide clear privacy mode indicators
- Log all data disclosures for audit trail

### Accessibility is Non-Negotiable
WCAG 2.1 AA compliance is a requirement, not a nice-to-have:
- Test with actual screen readers (NVDA, JAWS, VoiceOver)
- Ensure full keyboard navigation
- Maintain 4.5:1 color contrast ratios
- Use semantic HTML and ARIA labels

### Performance Matters
Core Web Vitals directly impact user experience and SEO:
- Target LCP < 2.5s, FID < 100ms, CLS < 0.1
- Implement lazy loading and code splitting
- Use Next.js Image component for optimized images
- Monitor performance in production with real user data

---

**Prepared by**: Claude Code
**Date**: 2025-10-08
**Purpose**: Implementation guidance for Phase 2
**Status**: Ready for development team review
