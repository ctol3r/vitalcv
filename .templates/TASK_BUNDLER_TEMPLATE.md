# VitalCV Task Bundle: [Feature Name]

**Bundle ID**: `TB-YYYY-MM-DD-short-name`
**Related Design Proposal**: `DP-YYYY-MM-DD-short-name`
**Created**: YYYY-MM-DD
**Domain Owner**: @domain-owner
**Total Estimated Effort**: X days

---

## Bundle Summary

**Objective**: [One sentence describing what this bundle achieves]

**Scope**: [What's included and what's not]

**Success Criteria**: [How we know this bundle is complete]

- [ ] All tasks completed
- [ ] All validation criteria passing
- [ ] Integration tests passing
- [ ] Code review approved

---

## Execution Order

Tasks must be executed in this order due to dependencies:

```text
Phase 1 (Parallel)          Phase 2 (Sequential)       Phase 3 (Parallel)
┌─────────┐ ┌─────────┐    ┌─────────┐                ┌─────────┐
│ Task 01 │ │ Task 02 │───→│ Task 03 │───────────────→│ Task 06 │
└─────────┘ └─────────┘    └─────────┘      ┌────────→└─────────┘
                                  │          │         ┌─────────┐
                                  └─────────→│ Task 04│─→│ Task 07 │
                                             └────────→└─────────┘
                                                       ┌─────────┐
                                                       │ Task 08 │
                                                       └─────────┘
```

**Phases**:

1. **Phase 1** (Day 1-2): Setup and preparation (parallel execution)
2. **Phase 2** (Day 3-5): Core implementation (sequential)
3. **Phase 3** (Day 6-7): Integration and testing (parallel)

---

## Task Index

| Task ID | Title        | Assignee | Effort | Forked | Dependencies |
| ------- | ------------ | -------- | ------ | ------ | ------------ |
| TB-01   | [Task title] | Claude   | 2h     | ✅ Yes | None         |
| TB-02   | [Task title] | Codex    | 4h     | ✅ Yes | None         |
| TB-03   | [Task title] | Claude   | 1d     | ✅ Yes | TB-01, TB-02 |
| TB-04   | [Task title] | Cursor   | 3h     | ❌ No  | TB-03        |
| TB-05   | [Task title] | Claude   | 2h     | ✅ Yes | TB-03        |
| ...     | ...          | ...      | ...    | ...    | ...          |

**Legend**:

- **Claude**: Complex analysis, design, multi-file refactoring
- **Codex**: Single-file implementations, well-defined functions
- **Cursor**: Minor edits, configuration changes, documentation

---

## Tasks

### TB-01: [Task Title]

**Type**: `IMPLEMENTATION` | `REFACTOR` | `TEST` | `CONFIG` | `DOCUMENTATION`
**Assignee**: `Claude` | `Codex` | `Cursor`
**Effort**: [Time estimate]
**Forked Execution**: `✅ REQUIRED` | `❌ NOT REQUIRED`

#### Problem Statement

[What needs to be done and why]

#### Scope

[Exactly what to build/change]

**Files to Create**:

- `/path/to/new/file.ts` - [Description]

**Files to Modify**:

- `/path/to/existing/file.ts` (lines X-Y) - [What to change]

**Files to Delete**:

- `/path/to/old/file.ts` - [Why deleting]

#### Acceptance Criteria

[Specific, measurable, testable criteria]

- [ ] **AC-1**: [Specific outcome]

  - Test: `npm run test:unit -- path/to/test.spec.ts`
  - Expected: All tests pass

- [ ] **AC-2**: [Another outcome]

  - Test: Manual verification via `curl localhost:3000/endpoint`
  - Expected: HTTP 200 with valid JSON

- [ ] **AC-3**: [Code quality]
  - Test: `npm run lint && npm run typecheck`
  - Expected: No errors

#### Implementation Guidance

**Algorithm/Approach**:

```typescript
// Pseudocode or key logic
function implementFeature(input: Input): Output {
  // 1. Validate input
  // 2. Process data
  // 3. Return result
}
```

**Edge Cases to Handle**:

- Empty input
- Invalid credentials
- Network timeout
- Database connection failure

**Error Handling Strategy**:

```typescript
try {
  // main logic
} catch (error) {
  if (error instanceof SpecificError) {
    // specific handling
  }
  logger.error('Operation failed', { error, context });
  throw new CustomError('User-friendly message');
}
```

#### Dependencies

**Upstream** (must complete before this task):

- TB-XX: [Task title]

**Downstream** (blocked until this completes):

- TB-YY: [Task title]

**External Dependencies**:

- Library: `@package/name@^1.0.0` (install via `pnpm add`)
- Service: KMS/database/API must be configured

#### Validation Checklist

**Before marking complete**:

- [ ] All acceptance criteria met
- [ ] Unit tests written and passing (if code changes)
- [ ] Integration test updated (if API change)
- [ ] No console.log or debugging code
- [ ] TypeScript types are strict (no `any`)
- [ ] Error messages are user-friendly
- [ ] Logging added for debugging
- [ ] Code formatted with prettier
- [ ] No linter warnings
- [ ] Forked branch created (if required)
- [ ] Validation command run and passed (see below)

**Validation Command**:

```bash
# Run this before marking task complete
npm run typecheck && \
npm run lint && \
npm run test:unit -- path/to/test && \
npm run test:integration -- relevant-test
```

#### Rollback Plan

If this task causes issues:

1. **Code Rollback**: `git revert <commit-hash>`
2. **Database Rollback**: `pnpm prisma migrate rollback` (if schema changed)
3. **Configuration Rollback**: Restore previous env vars from `.env.backup`
4. **Verification**: Run health check: `curl localhost:3000/health`

#### Copy-Paste Ready Command

**For Claude**:

```text
Implement TB-01: [Task Title]

Context: [Brief description]

Requirements:
1. Create/modify files as specified above
2. Implement [specific functionality]
3. Add unit tests
4. Ensure all acceptance criteria are met

Validation: Run the validation command and confirm all checks pass.
```

**For Codex**:

```javascript
// TB-01: [Task Title]
// File: /path/to/file.ts

// TODO: Implement [specific function]
function newFunction(param: Type): ReturnType {
  // [Implementation guidance from above]
}

// Test:
// npm run test:unit -- path/to/test.spec.ts
```

**For Cursor**:

```text
In file /path/to/file.ts, line X:

Replace:
[old code]

With:
[new code]

Reason: [Why this change]
```

---

### TB-02: [Another Task Title]

[Same structure as TB-01...]

---

### TB-03: [Integration Task Title]

**Type**: `INTEGRATION`
**Assignee**: `Claude`
**Effort**: 1 day
**Forked Execution**: `✅ REQUIRED`

#### Problem Statement (TB-03)

[Integrate TB-01 and TB-02 components...]

[Continue with same structure...]

---

## Validation Gates

Tasks are organized into validation gates. All tasks in a gate must pass before proceeding.

### Gate 1: Unit Tests

**Tasks**: TB-01, TB-02, TB-03

**Validation**:

```bash
npm run test:unit
```

**Success Criteria**:

- All unit tests pass
- Code coverage > 80% for new code
- No linter errors

### Gate 2: Integration Tests

**Tasks**: TB-04, TB-05

**Validation**:

```bash
npm run test:integration
```

**Success Criteria**:

- All integration tests pass
- End-to-end flow works
- No errors in logs

### Gate 3: Security Review

**Tasks**: TB-06, TB-07

**Validation**:

```bash
npm run security:audit
```

**Success Criteria**:

- No critical vulnerabilities
- Authentication/authorization tested
- DPoP proofs validated

### Gate 4: Launch Readiness

**Tasks**: All

**Validation**:

```bash
npm run launch:validate
```

**Success Criteria**:

- All tests pass
- Performance meets SLAs
- Documentation complete
- Deployment successful to staging

---

## Forked Execution Guidelines

### When Fork is Required

Tasks marked `✅ REQUIRED` must use forked execution:

- Creates/modifies code
- Changes database schema
- Modifies API contracts
- Updates configuration affecting behavior

### How to Execute in Fork

#### Step 1: Create Fork Branch

```bash
git checkout -b feature/[task-id]-[short-name]
```

#### Step 2: Implement Task

[Follow task instructions]

#### Step 3: Validation

```bash
# Run task-specific validation
[validation command from task]

# Run all checks
npm run validate:all
```

#### Step 4: Commit

```bash
git add .
git commit -m "[TB-XX] [Task title]

- Implemented [key change]
- Added tests for [functionality]
- Validation: [validation results]

Closes #[issue-number]"
```

#### Step 5: Merge Request

```bash
# Push to remote
git push origin feature/[task-id]-[short-name]

# Create MR/PR (via GitHub/GitLab UI or CLI)
gh pr create --title "[TB-XX] [Task title]" \
  --body "See: .templates/TASK_BUNDLER_TEMPLATE.md#tb-xx"
```

#### Step 6: Validation Before Merge

- [ ] All CI/CD checks pass
- [ ] Code review approved by domain owner
- [ ] No conflicts with main branch
- [ ] Acceptance criteria verified in deployed environment

#### Step 7: Merge & Cleanup

```bash
# Merge via UI (squash or merge commit)
# Then cleanup local branch
git checkout main
git pull origin main
git branch -d feature/[task-id]-[short-name]
```

### Rollback from Fork

If merged code causes issues:

```bash
# Option 1: Revert the merge commit
git revert <merge-commit-hash>
git push origin main

# Option 2: Reset to before merge (dangerous, use only if just merged)
git reset --hard <commit-before-merge>
git push origin main --force

# Always: Verify rollback worked
npm run test:all
curl localhost:3000/health
```

---

## Progress Tracking

### Status Board

| Task  | Status         | Assignee | Started    | Completed  | Notes                         |
| ----- | -------------- | -------- | ---------- | ---------- | ----------------------------- |
| TB-01 | ✅ DONE        | Claude   | 2026-01-09 | 2026-01-09 | Passed all validations        |
| TB-02 | 🟡 IN PROGRESS | Codex    | 2026-01-09 | -          | Waiting on dependency install |
| TB-03 | ⬜ TODO        | Claude   | -          | -          | Blocked by TB-01, TB-02       |
| TB-04 | ⬜ TODO        | Cursor   | -          | -          | -                             |

**Legend**:

- ✅ DONE: Complete and validated
- 🟡 IN PROGRESS: Actively being worked on
- 🔴 BLOCKED: Cannot proceed due to blocker
- ⬜ TODO: Not started

### Daily Standup Template

**Yesterday**:

- Completed: TB-01 (all validations passed)
- In Progress: TB-02 (70% done, debugging edge case)

**Today**:

- Plan: Finish TB-02, start TB-03
- Blockers: Waiting for KMS credentials from infra team

**Tomorrow**:

- Plan: Complete TB-03 integration, start TB-04

---

## Environment Setup

### Required Tools

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL 15+ (for local dev)
- Git
- Docker (for integration tests)

### Installation

```bash
# Clone repo (if not already)
git clone https://github.com/org/vitalcv.git
cd vitalcv

# Install dependencies
pnpm install

# Setup database
pnpm prisma generate
pnpm prisma db push

# Run tests to verify setup
pnpm run test:unit
```

### Environment Variables

```bash
# Copy template
cp .env.example .env

# Required variables for this bundle:
DATABASE_URL="postgresql://user:pass@localhost:5432/vitalcv"
ISSUER_DID="did:web:issuer.vitalcv.com"
SIGNING_KEY_JWK='{"kty":"OKP",...}'

# Optional:
ENABLE_DEBUG_LOGS=true
```

---

## Risk Mitigation

### High-Risk Tasks

| Task  | Risk                                        | Mitigation                                                 |
| ----- | ------------------------------------------- | ---------------------------------------------------------- |
| TB-03 | Database schema change may break production | Run migration in staging first, have rollback script ready |
| TB-05 | Key management change could lock out users  | Keep old keys valid for 7 days during rotation             |

### Contingency Plan

**If critical blocker encountered**:

1. Immediately notify domain owner
2. Document blocker in task notes
3. Mark task as BLOCKED
4. Identify workaround or alternative approach
5. Update task bundle with revised plan

**If deadline at risk**:

1. Identify tasks that can be deferred
2. Focus on P0 tasks only
3. Escalate to stakeholders
4. Consider reducing scope (move features to v2)

---

## Communication Plan

### Notifications

**On Task Start**:

- [ ] Post in #engineering Slack: "Starting TB-XX: [title]"
- [ ] Assign GitHub issue to self

**On Task Complete**:

- [ ] Post validation results in #engineering
- [ ] Request code review from @domain-owner
- [ ] Update status board

**On Task Blocked**:

- [ ] Immediately notify blocker owner
- [ ] Escalate if not resolved in 4 hours
- [ ] Document workaround attempts

### Code Review Protocol

**When to Request Review**:

- After task validation passes locally
- Before merging to main
- For any security-sensitive changes

**Review Checklist**:

- [ ] Code follows style guide
- [ ] Tests are comprehensive
- [ ] Error handling is robust
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance is acceptable

---

## Acceptance & Handoff

### Bundle Complete Criteria

All of the following must be true:

- [ ] All tasks completed (status ✅ DONE)
- [ ] All validation gates passed
- [ ] Integration tests passing
- [ ] Deployed to staging and validated
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] No known critical bugs
- [ ] Monitoring/alerting configured

### Handoff to Next Phase

**What gets handed off**:

- Deployed feature in staging
- Updated documentation
- Test results and coverage reports
- Deployment guide
- Known issues log (if any)

**Who receives handoff**:

- QA team (for final validation)
- DevOps (for production deployment)
- Product team (for user acceptance testing)

**Handoff Meeting Agenda**:

1. Demo of completed functionality
2. Walkthrough of changes
3. Review of test results
4. Deployment plan review
5. Q&A

---

## Appendix

### Glossary

- **Forked Execution**: Creating a separate git branch for changes, validating before merging
- **Validation Gate**: A checkpoint where all prior tasks must pass before proceeding
- **Acceptance Criteria**: Specific, testable conditions that define task completion
- **Atomic Task**: A task that can be completed independently in one session

### Related Documents

- Design Proposal: `[Link to DP-XXX.md]`
- Architecture Docs: `[Link to VITALCV_ARCHITECTURE.md]`
- API Specification: `[Link to OpenAPI spec]`

### Version History

| Version | Date       | Author  | Changes          |
| ------- | ---------- | ------- | ---------------- |
| 1.0     | 2026-01-09 | @author | Initial creation |

---

**Template Version**: 1.0
**Last Updated**: 2026-01-09
**Maintained By**: @engineering-lead
