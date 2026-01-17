# VitalCV Forked Execution Defaults

**Version**: 1.0
**Last Updated**: 2026-01-09
**Enforcement**: MANDATORY for all mutating VitalCV skills

---

## Overview

All VitalCV development skills that modify code, configuration, or data MUST use forked execution by default. This ensures:

- **Safety**: Changes are isolated until validated
- **Review**: All changes go through validation gates
- **Rollback**: Easy to revert if issues discovered
- **Audit**: Complete history of what changed and why

---

## Mandatory Forked Execution

### Skills Requiring Forked Context

The following VitalCV skills **MUST** execute in a forked git branch:

| Skill                        | Reason                 | Validation Required   |
| ---------------------------- | ---------------------- | --------------------- |
| `vitalcv:implement-feature`  | Creates/modifies code  | Full test suite       |
| `vitalcv:fix-bug`            | Modifies code          | Regression tests      |
| `vitalcv:refactor`           | Changes code structure | All existing tests    |
| `vitalcv:add-test`           | Adds test code         | New tests must pass   |
| `vitalcv:update-schema`      | Changes database       | Migration validation  |
| `vitalcv:update-api`         | Changes API contracts  | Integration tests     |
| `vitalcv:configure`          | Changes configuration  | Deployment validation |
| `vitalcv:upgrade-dependency` | Updates packages       | Full test suite       |
| `vitalcv:fix-and-harden`     | Security improvements  | Security test suite   |

### Skills Exempt from Forking

The following skills are READ-ONLY and do NOT require forking:

| Skill                      | Reason             | Output             |
| -------------------------- | ------------------ | ------------------ |
| `vitalcv:repo-map`         | Read-only analysis | Documentation only |
| `vitalcv:current-state`    | Status assessment  | Report only        |
| `vitalcv:flow-trace`       | Trust analysis     | Analysis document  |
| `vitalcv:gap-analysis`     | Identifies gaps    | Gap report         |
| `vitalcv:launch-readiness` | Validation check   | Checklist status   |
| `vitalcv:design-proposal`  | Planning           | Design document    |
| `vitalcv:task-bundler`     | Task breakdown     | Task list          |

---

## Forked Execution Workflow

### Step 0: Pre-Flight Check

**Before starting ANY code changes**, verify:

```bash
# Ensure on main branch with latest changes
git checkout main
git pull origin main

# Ensure clean working directory
git status
# Should show: "nothing to commit, working tree clean"

# Verify tests pass on main
npm run test:all
# Should show: all tests passing
```

If pre-flight fails, **STOP** and resolve issues before proceeding.

---

### Step 1: Create Fork Branch

**Branch Naming Convention**:

```text
feature/[skill-name]-[short-description]
bugfix/[issue-id]-[short-description]
refactor/[component-name]
security/[vulnerability-id]
```

**Examples**:

- `feature/trust-layer-signing`
- `bugfix/P0-01-unknown-issuer`
- `refactor/credential-controller`
- `security/dpop-replay-protection`

**Command**:

```bash
# Create and switch to fork branch
git checkout -b feature/trust-layer-signing

# Verify you're on the new branch
git branch --show-current
# Should output: feature/trust-layer-signing
```

---

### Step 2: Implement Changes

**Rules**:

- Make atomic commits (one logical change per commit)
- Write clear commit messages (see format below)
- Run validation after each major change
- Never commit secrets or sensitive data

**Commit Message Format**:

```text
[Skill] Short description (50 chars max)

Detailed explanation of what changed and why. Include:
- What was broken/missing
- What this commit fixes/adds
- How it was tested

Related: [DP-XXX, TB-YY, P0-ZZ]
```

**Example**:

```text
[trust-layer] Add Ed25519 signing to credential issuance

- Implemented signingKeyProvider loading keys from env
- Added VC signing with EdDSA algorithm
- Included kid (key ID) in JWT header
- Added unit tests for signing flow

Validation: npm run test:unit -- credential.spec.ts (all pass)

Related: DP-2026-01-09-trust-layer, TB-05, P0-05
```

---

### Step 3: Validation (REQUIRED)

**After each commit**, run validation:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Unit tests
npm run test:unit

# Integration tests (if applicable)
npm run test:integration

# Security scan
npm audit

# Build check
npm run build
```

**All validations MUST pass** before proceeding to next step.

---

### Step 4: Validation Checklist

Before pushing, verify ALL of the following:

- [ ] **Code Quality**

  - [ ] No `console.log` or debugging code
  - [ ] No `any` types (TypeScript strict mode)
  - [ ] No commented-out code
  - [ ] No TODO comments without GitHub issues

- [ ] **Testing**

  - [ ] New code has unit tests (>80% coverage)
  - [ ] Integration tests updated (if API changed)
  - [ ] All tests pass locally
  - [ ] Edge cases covered

- [ ] **Security**

  - [ ] No hardcoded secrets
  - [ ] No sensitive data in logs
  - [ ] Authentication/authorization added (if needed)
  - [ ] Input validation implemented

- [ ] **Documentation**

  - [ ] Code comments for complex logic
  - [ ] API docs updated (if API changed)
  - [ ] README updated (if setup changed)
  - [ ] CHANGELOG.md entry added

- [ ] **Performance**
  - [ ] No obvious performance regressions
  - [ ] Database queries optimized
  - [ ] Caching added where appropriate

---

### Step 5: Push to Remote

```bash
# Push branch to remote
git push origin feature/trust-layer-signing

# If branch already exists and you've rebased:
git push origin feature/trust-layer-signing --force-with-lease
```

---

### Step 6: Create Merge Request

**Via GitHub CLI**:

```bash
gh pr create \
  --title "[Trust Layer] Add Ed25519 signing to credential issuance" \
  --body "$(cat <<'EOF'
## Summary
Implements P0-05: VC Signing Logic

## Changes
- Added signingKeyProvider for key management
- Implemented Ed25519 signing for credentials
- Updated credential controller to sign VCs
- Added comprehensive unit tests

## Validation
- ✅ All unit tests pass (npm run test:unit)
- ✅ Integration tests pass (npm run test:integration)
- ✅ TypeScript strict mode (no any types)
- ✅ Linter clean (npm run lint)
- ✅ Security audit clean (npm audit)

## Related
- Design Proposal: DP-2026-01-09-trust-layer
- Task Bundle: TB-05
- P0 Gap: P0-05

## Testing Instructions
1. Checkout this branch
2. Run: pnpm install && pnpm build
3. Run: pnpm test:unit
4. Verify: All tests pass

## Deployment Notes
Requires ISSUER_PRIVATE_KEY_JWK environment variable
EOF
)" \
  --reviewer "@security-lead" \
  --reviewer "@backend-lead" \
  --label "trust-layer" \
  --label "P0"
```

**Via GitHub Web UI**:

1. Navigate to repository
2. Click "Pull Requests" → "New Pull Request"
3. Select base: `main`, compare: `feature/trust-layer-signing`
4. Fill in title and description (use template above)
5. Request reviewers
6. Add labels
7. Create pull request

---

### Step 7: Code Review

**Review Requirements**:

- Minimum 1 approving review from domain owner
- All CI/CD checks must pass
- No unresolved comments
- Security review if touching authentication/cryptography

**Addressing Review Comments**:

```bash
# Make changes based on feedback
[edit files]

# Commit with reference to review
git add .
git commit -m "[review] Address @reviewer's feedback

- Changed X to Y as suggested
- Added test case for Z
- Fixed typo in comments
"

# Push update
git push origin feature/trust-layer-signing
```

---

### Step 8: Pre-Merge Validation

**Automated Checks** (CI/CD pipeline):

- [ ] All tests pass
- [ ] Type checking passes
- [ ] Linter passes
- [ ] Security scan passes
- [ ] Build succeeds
- [ ] Code coverage >= 80%

**Manual Checks** (reviewer):

- [ ] Code review approved
- [ ] Meets acceptance criteria from task bundle
- [ ] No breaking changes (or documented migration path)
- [ ] Documentation updated

---

### Step 9: Merge to Main

**Merge Strategy**: Use **Squash and Merge** for clean history

**Via GitHub UI**:

1. Click "Squash and merge" button
2. Edit commit message to be concise:

   ```text
   [Trust Layer] Add Ed25519 signing to credential issuance (#123)

   Implements P0-05. Full details in PR description.
   ```

3. Confirm merge

**Via Git CLI**:

```bash
# Switch to main
git checkout main

# Merge with squash
git merge --squash feature/trust-layer-signing

# Commit
git commit -m "[Trust Layer] Add Ed25519 signing to credential issuance

Implements P0-05: VC Signing Logic
See: feature/trust-layer-signing branch for full history
"

# Push to main
git push origin main
```

---

### Step 10: Post-Merge Validation

**Immediately after merge**, verify main branch is healthy:

```bash
# Pull latest main
git checkout main
git pull origin main

# Run full validation
npm run validate:all

# Verify deployment (if auto-deploy enabled)
# Check staging environment
curl https://staging.vitalcv.com/health

# Monitor logs for errors
# [View logs via monitoring dashboard]
```

**If validation fails**:

1. Immediately revert merge (see Rollback section below)
2. Investigate failure
3. Fix in new branch
4. Re-submit PR

---

### Step 11: Cleanup

```bash
# Delete local branch
git branch -d feature/trust-layer-signing

# Delete remote branch (via GitHub UI or CLI)
git push origin --delete feature/trust-layer-signing

# Or via GitHub CLI
gh pr close 123 --delete-branch
```

---

## Explicit Rollback Instructions

### When to Rollback

Rollback immediately if:

- Tests fail in production/staging
- Critical bug discovered
- Performance regression detected
- Security vulnerability introduced

### Rollback Methods

#### Method 1: Revert Merge Commit (Preferred)

```bash
# Find the merge commit hash
git log --oneline | head -10

# Revert the merge (creates new commit)
git revert -m 1 <merge-commit-hash>

# Push revert
git push origin main

# Verify rollback
npm run test:all
curl https://staging.vitalcv.com/health
```

**Advantages**:

- Preserves history
- Safe (doesn't rewrite history)
- Can be reverted later if needed

#### Method 2: Reset to Before Merge (Dangerous)

**⚠️ WARNING**: Only use if merge was within last hour and no one else has pulled

```bash
# Find commit before merge
git log --oneline | head -10

# Reset main to that commit
git reset --hard <commit-before-merge>

# Force push (DANGEROUS)
git push origin main --force

# Notify team immediately
```

**Disadvantages**:

- Rewrites history
- Can break other developers' work
- Cannot easily recover if mistake made

#### Method 3: Database Rollback (If Schema Changed)

```bash
# If database migration was part of merge
pnpm prisma migrate rollback

# Verify database state
pnpm prisma studio
# Check tables are in expected state
```

#### Method 4: Configuration Rollback

```bash
# If environment variables changed
# Restore from backup
cp .env.backup .env

# Restart services
pnpm restart
```

---

## Validation Requirements by Change Type

### Code Changes

| Change Type  | Required Validations                                     |
| ------------ | -------------------------------------------------------- |
| New feature  | Unit tests, integration tests, E2E test, security review |
| Bug fix      | Regression test, all existing tests                      |
| Refactor     | All existing tests, performance benchmark                |
| Optimization | Performance benchmark, all tests                         |

### Schema Changes

| Change Type   | Required Validations                     |
| ------------- | ---------------------------------------- |
| Add column    | Migration up/down, data integrity check  |
| Remove column | Migration up/down, verify unused         |
| Add table     | Migration up/down, seed data test        |
| Change type   | Migration up/down, data migration script |

### API Changes

| Change Type     | Required Validations                                    |
| --------------- | ------------------------------------------------------- |
| New endpoint    | OpenAPI spec updated, integration test, security review |
| Modify endpoint | Backward compatibility check, integration test          |
| Remove endpoint | Deprecation notice, migration guide, confirm no usage   |
| Change response | Version API, update docs, integration test              |

### Configuration Changes

| Change Type    | Required Validations                     |
| -------------- | ---------------------------------------- |
| Add env var    | Update .env.example, docs, default value |
| Remove env var | Verify unused, update docs               |
| Change default | Test impact, update docs                 |

---

## Enforcement Mechanisms

### Pre-Commit Hooks

Install Git hooks to enforce standards:

```bash
# Install husky
pnpm add -D husky

# Setup hooks
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run typecheck"
```

### Pre-Push Hooks

```bash
# Add pre-push hook (runs tests before push)
npx husky add .husky/pre-push "npm run test:unit"
```

### Branch Protection Rules

**Configure on GitHub**:

1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable:
   - [x] Require pull request before merging
   - [x] Require approvals: 1
   - [x] Require status checks to pass
   - [x] Require branches to be up to date
   - [x] Include administrators
4. Save

---

## Exceptions

### Emergency Hotfix Process

For **critical production issues** only:

1. **Create hotfix branch from main**:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue
   ```

2. **Make minimal fix** (smallest possible change)

3. **Expedited validation** (still required, but can be subset):

   ```bash
   npm run test:unit -- affected-tests.spec.ts
   npm run lint -- path/to/changed/file.ts
   ```

4. **Expedited review**: Require only 1 review, can merge within 1 hour

5. **Merge to main immediately**

6. **Post-merge**: Full validation must run within 2 hours

**Who can approve emergency hotfix**:

- @cto
- @security-lead
- @backend-lead

---

## Continuous Improvement

### Retrospective After Each Major Change

After merging significant changes, conduct mini-retrospective:

**Questions**:

1. What went well in the forked execution process?
2. What could be improved?
3. Were validation requirements sufficient?
4. Was rollback plan adequate?

**Action Items**: Update this document if process improvements identified

---

## Related Documentation

- [Design Proposal Template](./.templates/DESIGN_PROPOSAL_TEMPLATE.md)
- [Task Bundler Template](./.templates/TASK_BUNDLER_TEMPLATE.md)
- [P0 Gap Analysis](../P0_GAP_ANALYSIS.md)
- [Trust Flow Analysis](../TRUST_FLOW_ANALYSIS.md)

---

## Appendix: Validation Command Reference

### Quick Validation

```bash
# Fast checks (< 30 seconds)
npm run typecheck && npm run lint
```

### Full Validation

```bash
# Complete validation (2-5 minutes)
npm run typecheck && \
npm run lint && \
npm run test:unit && \
npm run test:integration && \
npm run build && \
npm audit
```

### Validation by Component

```bash
# Backend only
cd apps/api/backend && npm run test

# Frontend only
cd apps/web && npm run test

# Blockchain only
cd blockchain/substrate && cargo test
```

---

## FAQ

**Q: Can I skip forked execution for a tiny change?**
A: No. Even one-line changes must go through fork → validate → merge process. Tiny changes are fast to validate.

**Q: What if I'm just updating documentation?**
A: Documentation changes still require forking, but can skip some validations (tests not required if only markdown changes).

**Q: Can I merge my own PR?**
A: No. All PRs require at least one approving review from someone other than the author.

**Q: What if CI/CD is broken?**
A: Fix CI/CD in a separate PR first. Do not merge code changes while CI/CD is broken.

**Q: How do I handle merge conflicts?**
A:

```bash
git checkout main
git pull origin main
git checkout feature/my-branch
git rebase main
# Resolve conflicts
git rebase --continue
git push origin feature/my-branch --force-with-lease
```

---

**Document Version**: 1.0
**Maintained By**: @engineering-lead
**Last Review**: 2026-01-09
**Next Review**: 2026-02-09
