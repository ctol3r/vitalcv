## Description

<!-- Briefly describe what changes were made and why -->

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation
- [ ] Performance improvement
- [ ] Other (please describe)

## Changes Made

<!-- List specific files and areas affected -->
- Changed `packages/api/src/routes/xyz.ts` to add new endpoint
- Updated `packages/core/src/types.ts` to add new type
- Added tests in `tests/api/xyz.test.ts`

## How It Was Tested

<!-- Describe how you tested these changes -->
1. Ran `pnpm test` - all tests pass
2. Tested manually in development:
   - Created passport with new feature
   - Verified readiness calculation
   - Checked employer API response
3. Tested in staging: https://staging.vitalcv.io/feature-path

## Screenshots/Demo

<!-- For UI changes, include screenshots or link to demo -->
<!-- 
![Screenshot](https://...)
-->

## Breaking Changes

<!-- If this change breaks existing functionality, describe it -->
**NONE**

## Related Issues

<!-- Link to related GitHub issues -->
Fixes #123
Related to #456

## Checklist

- [ ] Code follows the style guidelines
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Self-review completed
- [ ] Added tests (if applicable)
- [ ] Updated documentation (if applicable)
- [ ] No console errors in production mode
- [ ] Feature flags used for new features (if applicable)

## Deployment Notes

<!-- Any special considerations for deployment -->
- Feature flag `NEW_FEATURE` must be enabled in staging
- Database migration included in this PR
- Environment variables: `NEW_API_KEY` required

## Rollback Plan

<!-- If something goes wrong, how do we roll back? -->
1. Disable feature flag `NEW_FEATURE`
2. Revert this commit: `git revert <commit-hash>`
3. Deploy rollback

---

**Engineering Rules:**
- CI must pass before merge
- At least 1 approval required
- Staging verification required before production
- All tests must pass
