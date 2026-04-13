# VitalCV Engineering Discipline

This document defines the engineering practices, release process, and safety guards for VitalCV.

## Core Principles

1. **Stability over speed**: Production stability is paramount
2. **Discipline over shortcuts**: All changes follow the process
3. **Verification over trust**: Every change must be tested and reviewed
4. **Safety over convenience**: Rollback capability is mandatory

## Branch Strategy

### Branch Structure

- **`main`** → Production branch. NEVER commit directly to main.
- **`develop`** → Integration branch for staging deployment.
- **`feat/*`** → Feature branches for new functionality.
- **`hotfix/*`** → Emergency fixes for production issues.
- **`fix/*`** → Bug fixes for non-critical issues.

### Branch Rules

1. **Direct commits to main are FORBIDDEN**
2. All changes must go through a feature/hotfix branch
3. Feature branches branch from `develop`
4. Hotfix branches branch from `main`
5. PRs merge into `develop` (features) or `main` (hotfixes)

### Merge Requirements

Before ANY merge can occur:

```bash
pnpm build      # Must pass
pnpm typecheck  # Must pass
pnpm lint       # Must pass
pnpm test       # Must pass (if tests exist)
```

### Example Workflow

```bash
# Start a new feature
git checkout develop
git pull origin develop
git checkout -b feat/new-readiness-flow

# Make changes, commit, push
git push origin feat/new-readiness-flow

# Create PR against develop
# Wait for CI + review
# Merge after approval
```

## Pull Request Discipline

### Required for Every Change

- Feature work
- Bug fixes
- Refactoring
- Configuration changes
- Documentation updates (when they affect runtime behavior)

### PR Template Requirements

Every PR must include:

1. **Title**: Follows conventional commits (feat/fix/refactor/chore/docs)
2. **Description**:
   - What changes were made
   - Why they were made
   - How they were tested
   - Breaking changes (if any)
3. **Test Verification**: Explicit test steps
4. **Screenshots/Demo**: For UI changes

### Review Process

1. Author creates PR
2. CI runs automatically (blocks merge on failure)
3. At least one approval required
4. Reviewer validates test verification
5. Author addresses review comments
6. Merge after approval

## CI Pipeline

### GitHub Actions Workflow

Location: `.github/workflows/ci.yml`

Runs on: Pull requests to `develop` and `main`, and pushes to `develop`

### Pipeline Steps

1. **Install Dependencies**: `pnpm install --frozen-lockfile`
2. **Lint**: `pnpm lint`
3. **Type Check**: `pnpm typecheck`
4. **Build**: `pnpm build`
5. **Test**: `pnpm test` (when tests exist)

### Branch Protection

- `main` and `develop` are protected branches
- CI must pass before merge
- At least 1 approval required
- No direct pushes allowed

## Feature Flag System

### Purpose

- Safe rollouts for new features
- Instant disable capability for unstable features
- A/B testing support
- Gradual rollout capacity

### Implementation

Location: `packages/core/src/feature-flags.ts`

```typescript
export const FEATURE_FLAGS = {
  // Readiness enhancements
  ENHANCED_READINESS_SUMMARY: {
    enabled: false,
    rollout: 0, // 0-100% of users
    description: "Enhanced readiness summary with AI insights",
  },
  // Passport improvements
  DIGITAL_WALLET_INTEGRATION: {
    enabled: false,
    rollout: 0,
    description: "Digital wallet integration for passport",
  },
  // API features
  EMPLOYER_RISK_INTELLIGENCE: {
    enabled: false,
    rollout: 10,
    description: "Employer risk intelligence API",
  },
} as const;
```

### Usage Pattern

```typescript
import { FEATURE_FLAGS } from "@vitalcv/core/feature-flags";

export async function generateReadinessSummary(userId: string) {
  const baseSummary = await getBaseSummary(userId);

  if (FEATURE_FLAGS.ENHANCED_READINESS_SUMMARY.enabled) {
    const enhanced = await getEnhancedSummary(userId);
    return { ...baseSummary, ...enhanced };
  }

  return baseSummary;
}
```

### Feature Flag Management

1. **Local Development**: Override via environment variable
   ```bash
   FEATURE_FLAGS__ENHANCED_READINESS_SUMMARY__enabled=true
   ```

2. **Staging**: Test flags at 100% before production
3. **Production**: Gradual rollout (0% → 10% → 50% → 100%)
4. **Emergency**: Immediate disable by setting `enabled: false`

## Environment Separation

### Environments

1. **Local** (`localhost`): Developer workstations
2. **Staging** (`staging.vitalcv.io`): Pre-production testing
3. **Production** (`vitalcv.io`): Live production environment

### Environment Variables

See `.env.example` for required variables per environment.

**Critical Variables (Never commit to repo):**
- Database credentials
- API keys (NPPES, etc.)
- Secret keys for signing
- Third-party service tokens

### Deployment Rules

1. **Local**: Manual, on-demand
2. **Staging**: Automated on merge to `develop`
3. **Production**: Manual, requires explicit approval

## Staging First Rule

### Mandatory Staging Verification

Every change MUST:

1. Deploy to staging first
2. Verify core flows work
3. Test error states
4. Validate performance
5. Check logs for errors

### Staging Verification Checklist

- [ ] Passport flow completes successfully
- [ ] Readiness calculation is accurate
- [ ] Employer API responds correctly
- [ ] No console errors
- [ ] Response times under 2s
- [ ] Error rate < 1%

**Only after staging passes can production deployment proceed.**

## Release Process

### Release Steps

1. **Merge to `develop`**
   - Create PR from feature branch to `develop`
   - CI must pass
   - At least 1 approval
   - Merge after approval

2. **Deploy to Staging**
   - Automatic deployment triggers on merge
   - Verify staging environment
   - Run staging verification checklist

3. **Create Release PR**
   - Create PR from `develop` to `main`
   - Include changelog
   - Document breaking changes
   - Attach staging verification results

4. **Merge to `main`**
   - CI must pass
   - At least 1 approval
   - Merge only after staging verification

5. **Deploy to Production**
   - Manual deployment command
   - Monitor production metrics
   - Watch for error spikes
   - Verify production health

6. **Tag Release**
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

7. **Post-Release Monitoring**
   - Monitor error logs for 1 hour
   - Check response times
   - Verify key flows working
   - Document any issues

### Emergency Hotfix Process

Skip develop for urgent production fixes:

1. Branch from `main`: `git checkout -b hotfix/critical-bug`
2. Fix, test, commit
3. Create PR directly to `main`
4. CI + review + merge
5. Deploy to production
6. Backport to `develop`: Create PR to merge fix into develop

## Error & Performance Monitoring

### Error Logging

- All errors logged with context
- Stack traces captured
- User ID, request ID tracked
- Error categorization

### Metrics to Track

1. **Error Metrics**
   - Error rate (errors / total requests)
   - Error by endpoint
   - Error by type (4xx vs 5xx)
   - Error frequency (time series)

2. **Performance Metrics**
   - P50 response time
   - P95 response time
   - P99 response time
   - Database query time

3. **API Metrics**
   - Request volume
   - Success rate
   - Timeout rate
   - Rate limit hits

### Alerting Thresholds

- **Critical**: Error rate > 5% for 5 minutes
- **Warning**: P99 response time > 3s for 10 minutes
- **Info**: Error rate > 1% for 15 minutes

### Monitoring Stack

- **Logs**: Structured JSON logging
- **Metrics**: Prometheus/Grafana or similar
- **Tracing**: Request ID correlation
- **Alerting**: PagerDuty or similar for critical alerts

### Monitoring Implementation

See `packages/core/src/monitoring.ts` for instrumentation hooks.

## Database Migration Safety

### Migration Rules

1. **Backward compatible**: New migrations must work with old code
2. **Rollback capable**: Every migration must have a down migration
3. **Non-blocking**: Long-running migrations must be non-blocking
4. **Test in staging**: Never migrate production directly

### Migration Process

1. Write migration in `packages/core/src/db/migrations/`
2. Test migration locally
3. Deploy migration to staging (without code)
4. Verify migration success
5. Deploy code that uses new schema
6. Deploy to production (migration first, then code)
7. Monitor for errors

### Rollback Process

If a migration causes issues:

1. Roll back code deployment
2. If critical, run down migration
3. Fix the issue
4. Create new migration

### Migration Safety Checks

Before merging migration PRs:

- [ ] Down migration exists and tested
- [ ] Migration is idempotent
- [ ] Migration doesn't lock tables for > 1s
- [ ] Tested on staging database

## Deploy Safety

### Pre-Deployment Checklist

- [ ] CI passed
- [ ] PR approved
- [ ] Staging verified
- [ ] Breaking changes documented
- [ ] Rollback plan ready
- [ ] Monitoring configured

### Rollback Readiness

Every deployment must have a rollback plan:

1. **Database**: Down migration exists
2. **Feature**: Feature flag can be disabled
3. **API**: Previous version can be redeployed
4. **Infrastructure**: Infrastructure changes are reversible

### No Breaking Deploys

Breaking changes require:

- Feature flag rollout (disable old, enable new)
- API version bump
- Migration support period (old API stays for 1 release)
- Explicit communication to API consumers

### Deployment Safety Rules

1. Deploy during off-peak hours when possible
2. Monitor production for 1 hour after deploy
3. Have rollback command ready to execute
4. Never deploy on Friday afternoon
5. Document deployment results

## Code Ownership

### CODEOWNERS File

Location: `.github/CODEOWNERS`

```
# API routes
packages/api/src/routes/ @chris

# Frontend components
packages/web/app/ @chris

# Core logic
packages/core/src/ @chris

# Database
packages/core/src/db/ @chris

# Infrastructure
.github/ @chris
infra/ @chris
```

### Ownership Rules

1. Code owners approve PRs for their areas
2. At least one owner approval required
3. No PR merges without approval
4. Ownership documented in CODEOWNERS file

### Onboarding New Owners

Add new owners to `.github/CODEOWNERS` when:
- New team member joins
- Responsibility changes
- Module ownership transfers

## Documentation

### Required Documentation

1. **This file**: Engineering process and release rules
2. **README.md**: Project overview and quickstart
3. **API Documentation**: API routes and contracts
4. **Architecture Docs**: High-level design decisions
5. **Deployment Guide**: How to deploy to each environment

### Documentation Updates

Documentation must be updated when:
- New features are added
- API contracts change
- Deployment process changes
- Architecture decisions are made

## Emergency Procedures

### Production Incident Response

1. **Detect**: Alert triggers (error rate > threshold)
2. **Assess**: Determine severity and impact
3. **Contain**: Rollback or disable feature
4. **Fix**: Implement permanent fix
5. **Review**: Post-incident review
6. **Document**: Update runbooks

### Emergency Rollback

```bash
# Rollback code deployment
git revert <commit-hash>
git push origin main

# Rollback feature flag
# Set feature flag to false via env var or admin panel

# Rollback database migration
# Run down migration
```

### Communication

- Slower incidents: Post in #engineering
- Critical incidents: Page on-call engineer
- Public incidents: Issue public status update

---

**Remember**: These rules exist to keep VitalCV stable and reliable. Following them prevents production incidents and saves time in the long run.

**When in doubt**: Ask for review, test in staging, and have a rollback plan.
