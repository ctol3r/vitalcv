# Design Review: CredentialStatusCard Component

**Component**: `components/CredentialStatusCard.tsx`
**Review Date**: 2025-10-08
**Reviewer**: Claude (VitalCV Design System Compliance)
**Related Tasks**: VFE-0101 (Credential Status)

---

## Summary

The `CredentialStatusCard` component displays verification results for verifiable credentials. Overall, the component follows the VitalCV design system well but has several opportunities for improvement in accessibility, design consistency, and feature completeness.

**Overall Rating**: ⭐⭐⭐⭐☆ (4/5)

---

## ✅ Strengths

### 1. Design System Compliance
- ✅ Uses semantic color tokens (`bg-card`, `text-card-foreground`)
- ✅ Follows Card composition pattern (CardHeader, CardContent)
- ✅ Uses Badge component for status indication
- ✅ Consistent spacing with gap utilities
- ✅ Responsive design with `md:` breakpoints

### 2. Component Architecture
- ✅ Well-typed with TypeScript interfaces
- ✅ Client component with proper "use client" directive
- ✅ Clean separation of concerns (UI vs logic)
- ✅ Composable with Radix UI Dialog primitives

### 3. Features
- ✅ Three status states: valid, revoked, unknown
- ✅ QR code generation for VP tokens
- ✅ One-time share URL generation
- ✅ Metadata display (issuer, dates, audit ref)
- ✅ Toast notifications for user feedback

### 4. Accessibility Basics
- ✅ Uses semantic HTML elements
- ✅ Icons paired with text labels
- ✅ Keyboard accessible buttons and dialogs
- ✅ Loading states with spinners

---

## ⚠️ Issues & Recommendations

### 1. Accessibility Enhancements

#### Issue: Color-Only Status Indication
**Severity**: 🔴 High (WCAG 2.1 AA Violation)
**Current**: Status relies heavily on color (green, red, gray)
**Problem**: Users with color blindness cannot distinguish status
**Recommendation**:
```tsx
// Add explicit status text + icon + color
<div className="flex items-center gap-2">
  {config.icon}
  <Badge variant={config.badgeVariant} className={config.badgeColor}>
    {result.status}
  </Badge>
  {/* Add screen-reader-only text */}
  <span className="sr-only">
    Credential status: {config.title}. {config.description}
  </span>
</div>
```

#### Issue: Missing ARIA Roles for Dialogs
**Severity**: 🟡 Medium
**Current**: Dialogs use Radix defaults
**Problem**: May not announce purpose to screen readers
**Recommendation**:
```tsx
<DialogContent aria-labelledby="qr-dialog-title" aria-describedby="qr-dialog-desc">
  <DialogHeader>
    <DialogTitle id="qr-dialog-title">Verifiable Presentation QR Code</DialogTitle>
    <DialogDescription id="qr-dialog-desc">
      Scan this QR code to access the verifiable presentation token
    </DialogDescription>
  </DialogHeader>
</DialogContent>
```

#### Issue: Loading States Need Better Announcements
**Severity**: 🟡 Medium
**Current**: Loading spinner without screen reader feedback
**Problem**: Screen reader users don't know action is in progress
**Recommendation**:
```tsx
<div className="flex items-center justify-center h-48 w-48 bg-gray-100 rounded-lg">
  <div
    className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
    role="status"
    aria-live="polite"
  >
    <span className="sr-only">Generating VP token...</span>
  </div>
</div>
```

#### Issue: External QR Code Service Privacy Concern
**Severity**: 🟠 Medium-High
**Current**: `https://api.qrserver.com/v1/create-qr-code/`
**Problem**:
- Sends VP token to third-party service (privacy leak)
- Requires internet connection
- Potential HIPAA violation (PHI may be in token)
**Recommendation**: Use a client-side QR code library (e.g., `qrcode.react`)
```tsx
import QRCodeReact from 'qrcode.react'

<QRCodeReact
  value={vpToken}
  size={200}
  level="H"
  includeMargin={true}
/>
```

### 2. Design System Consistency

#### Issue: Inconsistent Color Usage
**Severity**: 🟡 Medium
**Current**: Mix of semantic tokens and hard-coded colors
```tsx
// Current (mixed approach)
bgColor: "bg-green-50 border-green-200"
badgeColor: "bg-green-100 text-green-800"
```
**Problem**: Hard-coded colors don't respond to theme changes
**Recommendation**: Use semantic tokens consistently
```tsx
// Recommended
bgColor: "bg-success/10 border-success/20"
badgeColor: "bg-success/20 text-success-foreground"
```
Define in Tailwind config:
```js
// tailwind.config.js
colors: {
  success: 'hsl(var(--success))',
  'success-foreground': 'hsl(var(--success-foreground))',
}
```

#### Issue: Status Configuration Should Be Centralized
**Severity**: 🟢 Low
**Current**: `getStatusConfig()` function in component
**Problem**: Status configs duplicated if used elsewhere
**Recommendation**: Move to constants file
```tsx
// lib/credential-status-config.ts
export const CREDENTIAL_STATUS_CONFIGS = {
  valid: {
    icon: CheckCircle,
    color: 'text-success',
    // ...
  },
  // ...
} as const
```

#### Issue: Hard-Coded Dimensions
**Severity**: 🟢 Low
**Current**: `h-48 w-48` for QR code container
**Problem**: Not responsive, doesn't scale with user font size
**Recommendation**: Use size tokens or make responsive
```tsx
<div className="flex items-center justify-center size-48 md:size-64 bg-gray-100 rounded-lg">
```

### 3. Feature Gaps

#### Issue: Missing "Expired" Status
**Severity**: 🟡 Medium
**Current**: Only valid, revoked, unknown
**Problem**: Per glossary (VFE-0115), credentials can expire
**Recommendation**: Add expired status handling
```tsx
case "expired":
  return {
    icon: <Clock className="h-6 w-6" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
    badgeVariant: "warning" as const,
    title: "Credential Expired",
    description: "This credential has expired and is no longer valid.",
  }
```

#### Issue: Missing Selective Disclosure UI
**Severity**: 🟡 Medium
**Current**: Shares entire credential in VP
**Problem**: Per glossary (VFE-0114), should support selective disclosure
**Recommendation**: Add claim selection dialog
```tsx
<Dialog>
  <DialogTitle>Select Claims to Share</DialogTitle>
  <DialogContent>
    {availableClaims.map(claim => (
      <Checkbox
        key={claim.id}
        checked={selectedClaims.includes(claim.id)}
        onCheckedChange={(checked) => toggleClaim(claim.id, checked)}
      >
        {claim.label}
      </Checkbox>
    ))}
    <Button onClick={generateSelectiveVP}>Share Selected Claims</Button>
  </DialogContent>
</Dialog>
```

#### Issue: No Audit Trail Display
**Severity**: 🟢 Low
**Current**: Shows `auditRef` as a badge
**Problem**: Per glossary (VFE-0117), should link to full audit trail
**Recommendation**: Make audit ref clickable
```tsx
{result.auditRef && (
  <Button variant="link" onClick={() => viewAuditTrail(result.auditRef)}>
    <FileText className="h-4 w-4 mr-1" />
    View Audit Trail: {result.auditRef}
  </Button>
)}
```

### 4. Error Handling

#### Issue: Generic Error Messages
**Severity**: 🟡 Medium
**Current**: "Failed to generate VP token"
**Problem**: Doesn't guide user on what to do
**Recommendation**: Provide actionable error messages
```tsx
toast({
  title: "Failed to Generate VP Token",
  description: "Please check your internet connection and try again. If the problem persists, contact support.",
  variant: "destructive",
  action: <Button size="sm" onClick={retryGenerateVPToken}>Retry</Button>
})
```

#### Issue: No Offline Support Indicator
**Severity**: 🟢 Low
**Current**: Assumes network connectivity
**Problem**: Fails silently when offline
**Recommendation**: Detect offline state and show appropriate UI
```tsx
{!navigator.onLine && (
  <Alert>
    <AlertDescription>
      You are offline. Some features may not be available.
    </AlertDescription>
  </Alert>
)}
```

### 5. Performance

#### Issue: QR Code Generated on Every Render
**Severity**: 🟢 Low
**Current**: QR code URL recalculated even if `vpToken` unchanged
**Problem**: Minor performance impact
**Recommendation**: Memoize QR code URL
```tsx
const qrCodeUrl = useMemo(
  () => vpToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(vpToken)}`
    : null,
  [vpToken]
)
```

### 6. Security

#### Issue: Share URL Expiry Not Enforced Client-Side
**Severity**: 🟡 Medium
**Current**: Backend sets expiry, but UI doesn't count down
**Problem**: User may try to use expired link
**Recommendation**: Show countdown timer
```tsx
const [timeRemaining, setTimeRemaining] = useState(3600) // 1 hour

useEffect(() => {
  const timer = setInterval(() => {
    setTimeRemaining(prev => Math.max(0, prev - 1))
  }, 1000)
  return () => clearInterval(timer)
}, [])

<AlertDescription className="text-xs">
  This link will expire in {formatTime(timeRemaining)} and can only be accessed once.
</AlertDescription>
```

---

## 📋 Action Items

### High Priority (WCAG Compliance)
- [ ] Replace external QR code service with client-side library
- [ ] Add screen-reader-only text for status
- [ ] Ensure all interactive elements have visible focus indicators
- [ ] Test with NVDA/JAWS screen readers

### Medium Priority (Design System)
- [ ] Define semantic color tokens for credential statuses
- [ ] Add "expired" status handling
- [ ] Centralize status configuration
- [ ] Improve error messages with actionable guidance
- [ ] Add selective disclosure UI (future phase)

### Low Priority (Enhancements)
- [ ] Add audit trail link
- [ ] Memoize QR code generation
- [ ] Add offline detection
- [ ] Show share URL countdown timer
- [ ] Make QR code size responsive

---

## ✅ Updated Component Preview

Here's a snippet showing recommended improvements:

```tsx
// components/CredentialStatusCard.tsx (improved)
import QRCodeReact from 'qrcode.react'
import { CREDENTIAL_STATUS_CONFIGS } from '@/lib/credential-status-config'

export function CredentialStatusCard({ result }: CredentialStatusCardProps) {
  const config = CREDENTIAL_STATUS_CONFIGS[result.status] ?? CREDENTIAL_STATUS_CONFIGS.unknown

  return (
    <Card className={`${config.bgColor} border-2 shadow-lg`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={config.color} aria-hidden="true">
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className={`capitalize ${config.badgeColor}`}>
            {result.status}
            <span className="sr-only">
              Status: {config.title}. {config.description}
            </span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* ... existing content ... */}

        {/* QR Code Dialog with Client-Side Generation */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <QrCode className="h-4 w-4 mr-2" />
              Show QR Code
            </Button>
          </DialogTrigger>
          <DialogContent
            aria-labelledby="qr-dialog-title"
            aria-describedby="qr-dialog-desc"
          >
            <DialogHeader>
              <DialogTitle id="qr-dialog-title">
                Verifiable Presentation QR Code
              </DialogTitle>
              <DialogDescription id="qr-dialog-desc">
                Scan this QR code to access the verifiable presentation token
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              {loading ? (
                <div
                  className="flex items-center justify-center size-48 bg-gray-100 rounded-lg"
                  role="status"
                  aria-live="polite"
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary">
                    <span className="sr-only">Generating VP token...</span>
                  </div>
                </div>
              ) : vpToken ? (
                <>
                  <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                    <QRCodeReact
                      value={vpToken}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  {/* ... rest of content ... */}
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Generation Failed</AlertTitle>
                  <AlertDescription>
                    Failed to generate VP token. Please check your connection and try again.
                  </AlertDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateVPToken}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
```

---

## Testing Checklist

### Functional Testing
- [ ] Valid credential displays with green styling
- [ ] Revoked credential displays with red styling
- [ ] Unknown credential displays with gray styling
- [ ] Expired credential displays with orange styling (to be added)
- [ ] QR code generates correctly
- [ ] One-time URL generates and copies
- [ ] Toast notifications appear on success/error

### Accessibility Testing
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces status correctly (NVDA/JAWS)
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Status distinguishable without color (icon + text)
- [ ] Loading states announced to screen readers

### Responsive Testing
- [ ] Mobile (375px): Layout stacks properly
- [ ] Tablet (768px): Two-column metadata layout
- [ ] Desktop (1024px+): Full layout with actions
- [ ] Dialogs responsive (full-screen on mobile)

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Conclusion

The `CredentialStatusCard` component is well-architected and follows most design system principles. Key improvements needed:

1. **Critical**: Replace external QR service for privacy/security
2. **Critical**: Enhance accessibility (screen reader support, status indication)
3. **Important**: Add semantic color tokens for theming
4. **Important**: Add expired status handling
5. **Nice-to-have**: Selective disclosure, audit trail link, offline support

**Estimated Effort**: 4-6 hours for high/medium priority items

**Next Steps**:
1. Install `qrcode.react` dependency
2. Define semantic color tokens in Tailwind config
3. Implement accessibility improvements
4. Add expired status handling
5. Write comprehensive tests

---

**Related Documents**:
- [Component Library Glossary](./glossary-component-library.md)
- [Credential Management Glossary](./glossary-credential-management.md)
- [Phase 1 Tracking](./phase1-tracking.md)
