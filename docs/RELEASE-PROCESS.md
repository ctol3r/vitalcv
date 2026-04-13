# VitalCV Release Process

This guide details the step-by-step process for releasing VitalCV.

## Quick Reference

| Stage | Branch | Environment | Action |
|-------|--------|-------------|--------|
| Development | `feat/*` | Local | Code and test |
| Integration | `develop` | Staging | Verify and test |
| Production | `main` | Production | Deploy and monitor |

## Release Flow

### Phase 1: Development

```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feat/new-feature

# 2. Make changes, commit, push
git add .
git commit -m "feat(api): add new endpoint"
git push origin feat/new-feature

# 3. Create PR to develop
# Include:
# - Clear description
# - Testing steps
# - Screenshots if UI change

# 4. Wait for CI and review
# CI runs automatically
# Reviewer approves

# 5. Merge to develop
# Only after CI passes and review approved
```

### Phase 2: Staging Verification

```bash
# 1. Merge to develop triggers staging deploy
# Wait for staging deploy to complete

# 2. Access staging: https://staging.vitalcv.io

# 3. Run verification checklist:
# - Passport flow completes
# - Readiness calculation accurate
# - Employer API responds
# - No console errors
# - Response times < 2s
# - Error rate < 1%

# 4. Document verification results
# Post in #engineering with:
# - What was tested
# - Any issues found
# - Pass/fail status
```

### Phase 3: Production Release

```bash
# 1. Create release PR: develop → main
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# 2. Update version numbers
# Update packages/*/package.json

# 3. Create changelog
# Create docs/CHANGELOG-v1.0.0.md

# 4. Push and create PR
git push origin release/v1.0.0

# 5. PR to main includes:
# - Changelog
# - Breaking changes
# - Staging verification results

# 6. Wait for CI and review
# CI runs automatically
# At least 1 approval required

# 7. Merge to main
# Only after CI passes and approved

# 8. Deploy to production
pnpm deploy:production

# 9. Tag release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 10. Monitor for 1 hour
# Check logs
# Monitor metrics
# Verify key flows
```

## Staging Verification Checklist

Before deploying to production, verify:

### Core Flows

- [ ] Passport creation completes
- [ ] Passport sharing works
- [ ] Readiness calculation accurate
- [ ] Employer verification succeeds

### API Endpoints

- [ ] `/api/npi/:npi` returns correct data
- [ ] `/api/passport/:id` loads passport
- [ ] `/api/employer/:id` returns employer data
- [ ] `/api/verify/:id` runs verification

### Performance

- [ ] P50 response time < 500ms
- [ ] P95 response time < 2s
- [ ] P99 response time < 3s
- [ ] No requests timeout

### Error Handling

- [ ] Invalid NPI returns 404
- [ ] Missing fields return 400
- [ ] Server errors return 500 with details
- [ ] No unhandled exceptions

### Logging

- [ ] Requests logged with IDs
- [ ] Errors logged with context
- [ ] No console errors in production mode
- [ ] Logs contain request IDs

### Security

- [ ] API keys not leaked in logs
- [ ] User data properly sanitized
- [ ] No SQL injection vulnerabilities
- [ ] Rate limiting enforced

## Production Monitoring

After deploying to production:

### First 15 Minutes

- [ ] Check error rate < 1%
- [ ] Check response times < 3s P99
- [ ] Verify no alerts triggered
- [ ] Check database connection pool

### First Hour

- [ ] Monitor key user flows
- [ ] Check for slow queries
- [ ] Verify cache hit rate
- [ ] Watch memory usage

### First Day

- [ ] Daily active users stable
- [ ] No increase in support tickets
- [ ] No increase in error rate
- [ ] Performance stable

## Emergency Hotfix Process

Skip develop for urgent production fixes:

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix, test locally
pnpm test
pnpm build
pnpm typecheck
pnpm lint

# 3. Push and create PR directly to main
git push origin hotfix/critical-bug

# 4. PR includes:
# - Bug description
# - Impact assessment
# - Testing steps
# - Rollback plan

# 5. CI must pass
# At least 1 approval

# 6. Merge to main
# Deploy to production
pnpm deploy:production

# 7. Tag hotfix release
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin v1.0.1

# 8. Backport to develop
# Create PR to merge hotfix into develop
git checkout develop
git checkout -b backport/hotfix-critical-bug
git cherry-pick <hotfix-commit>
git push origin backport/hotfix-critical-bug
# Create PR and merge
```

## Release Communication

### Internal Team

Announce releases in #engineering:

```
🚀 Release v1.0.0 deployed to production

What's new:
- Feature 1
- Feature 2
- Bug fix 1

Known issues:
- Issue 1 (tracking in #123)

Staging verification: ✅ Passed
Production monitoring: 🟢 Started
```

### External Users

For major releases, post to relevant channels:

- Update documentation
- Post in user-facing channels
- Send release notes if appropriate

## Rollback Procedures

If issues arise after deployment:

### Step 1: Assess Impact

- How many users affected?
- Severity of the issue?
- Can it be worked around?

### Step 2: Mitigate

- Disable feature flags if applicable
- Scale up resources if performance issue
- Add status page if widespread issue

### Step 3: Rollback

```bash
# Rollback code deployment
git revert <commit-hash>
git push origin main
pnpm deploy:production

# Or revert to previous tag
git checkout v1.0.0
git push -f origin main
pnpm deploy:production

# Rollback feature flag
# Set feature flag to false via admin panel
```

### Step 4: Fix

- Create fix branch from main
- Test thoroughly
- Deploy fix

### Step 5: Post-Incident Review

- What happened?
- Why did it happen?
- How can we prevent it?
- Update runbooks

## Release Cadence

### Regular Releases

- **Weekly**: For non-breaking changes
- **Monthly**: For larger features
- **Quarterly**: For major releases

### Release Schedule

- **Tuesday-Thursday**: Preferred deployment days
- **10 AM - 2 PM PT**: Preferred deployment time
- **Avoid**: Friday afternoons, holidays, weekends

## Version Numbers

Follow Semantic Versioning (semver):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

Examples:
- `v1.0.0` → `v1.1.0` (new feature)
- `v1.1.0` → `v1.1.1` (bug fix)
- `v1.1.1` → `v2.0.0` (breaking change)

## Pre-Release Checklist

Before merging to main:

- [ ] All PRs reviewed and approved
- [ ] CI passed on all PRs
- [ ] Staging verified
- [ ] Changelog updated
- [ ] Breaking changes documented
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] Team notified

## Release Artifacts

Each release includes:

- Git tag
- Changelog
- Release notes
- Deployed artifacts
- Documentation updates

## Metrics

Track release metrics:

- Time from PR to merge
- Time from merge to deploy
- Rollback rate
- Post-release bug count
- User feedback

---

**Remember**: Fast is good, but correct is better. A well-tested, well-documented release beats a rushed deployment every time.
