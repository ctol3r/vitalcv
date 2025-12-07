# React2Shell Mitigation and Response Runbook

## Overview

This document outlines the React2Shell vulnerability (CVE-2025-55182), the mitigation measures implemented in VitalCV, and the incident response procedures for future React-related CVEs.

## What is React2Shell?

React2Shell (CVE-2025-55182) is a critical remote code execution (RCE) vulnerability in React Server Components (RSC) that allows unauthenticated attackers to execute arbitrary code on affected servers. The vulnerability has a CVSS score of 10.0 (Critical).

### Affected Versions

#### React
- 19.0.0
- 19.1.0
- 19.1.1
- 19.2.0

**Patched Versions:**
- 19.0.1
- 19.1.2
- 19.2.1

#### Next.js (App Router)
- 15.0.0 - 15.0.4
- 15.1.0 - 15.1.8
- 15.2.0 - 15.2.5
- 15.3.0 - 15.3.5
- 15.4.0 - 15.4.7
- 15.5.0 - 15.5.6
- 16.0.0 - 16.0.6

**Patched Versions:**
- 15.0.5
- 15.1.9
- 15.2.6
- 15.3.6
- 15.4.8
- 15.5.7
- 16.0.7

### How It Works

The vulnerability exploits React Server Components' Flight protocol to inject malicious payloads that are executed server-side during the rendering process. Attackers can craft special requests that bypass input validation and execute arbitrary code.

## VitalCV Mitigation Measures

### 1. Dependency Pinning (SEC-R2S-001)

**Status:** ✅ Implemented

- React and ReactDOM are pinned to exact version `19.2.1`
- Next.js is pinned to exact version `15.2.6`
- Version ranges (`^` and `~`) have been removed to prevent automatic upgrades

**Location:**
- `package.json`
- `docs/security/frontend-deps.md`

### 2. CI Guardrails (SEC-R2S-002)

**Status:** ✅ Implemented

- Automated check script: `scripts/check-vulnerable-deps.js`
- GitHub Actions workflow: `.github/workflows/security-check.yml`
- Prevents merging PRs with vulnerable versions
- Runs on all pull requests and pushes to main/develop

**How to Use:**
```bash
npm run security:check
```

### 3. Dependency Scanning (SEC-R2S-003)

**Status:** ✅ Configured

- `npm audit` integrated into CI pipeline
- GitHub Dependabot enabled for high/critical severity alerts
- Automated scanning in security-check workflow

**Configuration:**
- See `.github/workflows/security-check.yml`
- Dependabot configuration in `.github/dependabot.yml` (if configured)

### 4. API Hardening (SEC-R2S-004)

**Status:** ✅ Implemented

- Strict input validation using Zod schemas
- Error responses sanitized to prevent information leakage
- All user-controlled input validated before processing

**Location:**
- `apps/web/src/lib/security/error-handler.ts`
- `apps/web/src/lib/security/sanitize.ts`

### 5. SSR Sanitization (SEC-R2S-005)

**Status:** ✅ Implemented

- Centralized sanitization utilities
- All user-controlled props escaped before SSR rendering
- HTML, JavaScript, and URL sanitization functions

**Location:**
- `apps/web/src/lib/security/sanitize.ts`

**Usage:**
```typescript
import { escapeHtml, sanitizeObject } from '@/lib/security/sanitize';

const safeProps = sanitizeObject(userControlledProps);
```

### 6. Debug Tooling Removal (SEC-R2S-006)

**Status:** ⚠️ Requires Audit

- Production builds should not expose debug tooling
- Environment flags should gate developer utilities
- **Action Required:** Audit codebase for debug components in SSR paths

### 7. WAF/CDN Rules (SEC-R2S-010)

**Status:** 📋 Infrastructure Task

- Work with CDN/WAF provider (Cloudflare/AWS WAF) to implement rules
- Monitor and block suspicious Flight-related paths
- Block known React2Shell payload patterns
- Start in logging mode, then enable blocking

**Recommended Rules:**
- Block requests with suspicious Flight headers
- Monitor `/__nextjs` and RSC-related paths
- Alert on abnormal header combinations

### 8. Security Logging (SEC-R2S-011)

**Status:** 📋 Infrastructure Task

- Centralize security logs (CloudWatch/ELK)
- Create dashboard for React2Shell-related activity
- Set up alerts for blocked request spikes
- Log all WAF/CDN blocks with metadata

### 9. Rate Limiting (SEC-R2S-012)

**Status:** ✅ Implemented

- Rate limiting middleware for high-value endpoints
- Per-IP and per-endpoint limits
- Configurable limits for different endpoint types

**Location:**
- `apps/web/src/lib/security/rate-limit.ts`

**Usage:**
```typescript
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

const result = checkRateLimit(request, RATE_LIMITS.auth);
if (!result.allowed) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 10. CSRF Protection (SEC-R2S-013)

**Status:** ✅ Implemented

- CSRF token generation and validation
- Token-based protection for state-changing operations
- Secure cookie handling

**Location:**
- `apps/web/src/lib/security/csrf.ts`

**Usage:**
```typescript
import { requireCsrfToken } from '@/lib/security/csrf';

const csrfError = await requireCsrfToken(request);
if (csrfError) return csrfError;
```

### 11. Error Handling Hardening (SEC-R2S-014)

**Status:** ✅ Implemented

- Opaque error codes for client responses
- Stack traces logged server-side only
- No internal paths or module names exposed

**Location:**
- `apps/web/src/lib/security/error-handler.ts`

### 12. Security Regression Tests (SEC-R2S-015)

**Status:** ✅ Implemented

- Automated security tests for key flows
- Tests for input validation, error handling, rate limiting
- Integrated into CI pipeline

**Location:**
- `__tests__/security/regression.test.ts`

## Incident Response Procedures

### If a New React/Next.js CVE is Discovered

1. **Immediate Assessment (0-1 hour)**
   - Check if VitalCV is affected by reviewing CVE details
   - Check current dependency versions in `package.json`
   - Review security advisories:
     - [React Security Advisories](https://github.com/facebook/react/security/advisories)
     - [Next.js Security Advisories](https://github.com/vercel/next.js/security/advisories)

2. **Emergency Response (1-4 hours)**
   - If affected, identify patched version
   - Update `package.json` with exact patched version
   - Run `npm install` to update lock file
   - Run full test suite: `npm run test:all`
   - Verify build: `npm run build`

3. **Deployment (4-8 hours)**
   - Create hotfix branch: `git checkout -b hotfix/react-cve-YYYY-XXXXX`
   - Update `docs/security/frontend-deps.md` with new vulnerability info
   - Update `scripts/check-vulnerable-deps.js` with new vulnerable versions
   - Create PR with security label
   - Deploy to staging for verification
   - Deploy to production after verification

4. **Post-Incident (24-48 hours)**
   - Review logs for any exploitation attempts
   - Update this runbook with lessons learned
   - Notify stakeholders if production was affected
   - Document any additional mitigations needed

### Monitoring and Alerts

**Key Metrics to Monitor:**
- Failed authentication attempts
- Rate limit violations
- WAF/CDN blocks
- Unusual request patterns to RSC endpoints
- Error rate spikes

**Alert Thresholds:**
- > 100 rate limit violations in 5 minutes
- > 50 WAF blocks in 5 minutes
- > 10% error rate increase
- Unusual traffic patterns to `/__nextjs` or RSC paths

## Upgrade Process

When upgrading React/Next.js:

1. **Check Security Status**
   ```bash
   npm audit
   npm run security:check
   ```

2. **Review Changelog**
   - Check React changelog for breaking changes
   - Check Next.js changelog for breaking changes
   - Review security advisories

3. **Update Dependencies**
   - Update `package.json` with exact version (no `^` or `~`)
   - Run `npm install`
   - Update lock file

4. **Test Thoroughly**
   ```bash
   npm run test:all
   npm run build
   ```

5. **Update Documentation**
   - Update `docs/security/frontend-deps.md`
   - Update `scripts/check-vulnerable-deps.js` if needed
   - Update this runbook if new mitigations added

## References

- [CVE-2025-55182 (React2Shell)](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-55182)
- [React Security Policy](https://react.dev/community/versioning-policy#security-updates)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## CI Jobs and Dashboards

- **Security Check CI:** `.github/workflows/security-check.yml`
- **Dependency Scanning:** Runs in security-check workflow
- **Security Tests:** `__tests__/security/regression.test.ts`

## Contact

For security concerns or questions:
- Security Team: [security@vitalcv.com]
- Emergency: [emergency-contact]

---

**Last Updated:** 2025-01-XX
**Next Review:** 2025-04-XX

