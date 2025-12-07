# Frontend Dependency Security

## Overview

This document outlines the security measures for frontend dependencies, specifically addressing React2Shell (CVE-2025-55182) and related vulnerabilities.

## Pinned Versions

To prevent automatic upgrades to vulnerable versions, the following dependencies are pinned to exact versions:

- **React**: `19.2.1` (patched against React2Shell)
- **ReactDOM**: `19.2.1` (patched against React2Shell)
- **Next.js**: `15.2.6` (patched against React2Shell)

### Why Exact Versions?

Using exact versions (without `^` or `~`) ensures that:
1. Dependencies do not automatically upgrade to vulnerable versions
2. Security patches are applied only after explicit review
3. CI/CD pipelines can detect version drift

## Upgrade Process

When upgrading React/Next.js dependencies:

1. **Check Security Advisories**
   - Review [React Security Advisories](https://github.com/facebook/react/security/advisories)
   - Review [Next.js Security Advisories](https://github.com/vercel/next.js/security/advisories)
   - Check for React2Shell-related CVEs

2. **Update package.json**
   - Change exact version numbers (e.g., `"react": "19.2.1"` → `"react": "19.2.2"`)
   - Do NOT add `^` or `~` prefixes

3. **Run Tests**
   ```bash
   npm install
   npm run test:all
   npm run build
   ```

4. **Update Lock File**
   - Commit both `package.json` and `package-lock.json` (or `pnpm-lock.yaml`)

5. **Document Changes**
   - Update this file with the new version and reason for upgrade

## Vulnerable Versions

The following versions are known to be vulnerable to React2Shell (CVE-2025-55182):

### React
- 19.0.0
- 19.1.0
- 19.1.1
- 19.2.0

### Next.js (when using App Router)
- 15.0.0 - 15.0.4
- 15.1.0 - 15.1.8
- 15.2.0 - 15.2.5
- 15.3.0 - 15.3.5
- 15.4.0 - 15.4.7
- 15.5.0 - 15.5.6
- 16.0.0 - 16.0.6

## CI Guardrails

The CI pipeline includes automated checks to prevent vulnerable versions from being merged:

- `scripts/check-vulnerable-deps.js` - Validates package-lock.json against known vulnerable versions
- GitHub Actions workflow enforces this check on all PRs

## Dependency Scanning

We use the following tools for dependency scanning:

1. **npm audit** - Run `npm audit` before each release
2. **GitHub Dependabot** - Configured to alert on high/critical severity vulnerabilities
3. **CI Pipeline** - Automated scanning in GitHub Actions

## Emergency Response

If a new React/Next.js vulnerability is discovered:

1. **Immediately pin to a patched version** (if available)
2. **Update this document** with the new vulnerability information
3. **Run full test suite** to ensure compatibility
4. **Deploy hotfix** if production is affected
5. **Notify security team** and stakeholders

## References

- [React2Shell CVE-2025-55182](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-55182)
- [React Security](https://react.dev/community/versioning-policy#security-updates)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)

