#!/bin/bash
# Release Candidate (RC) Tag Script
# Tagged: cursor-batch-1107 (Task 0019)
# Agent: CODEX • BACKEND • chai-vc-platform
#
# Creates RC tags and generates CHANGELOGs for pilot sign-off

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RC_PREFIX="rc"
TAG_PREFIX="v"
CHANGELOG_FILE="CHANGELOG.md"

# ============================================================================
# Functions
# ============================================================================

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the next RC number
get_next_rc_number() {
    local base_version=$1

    # Find all RC tags for this version
    local rc_tags=$(git tag -l "${TAG_PREFIX}${base_version}-${RC_PREFIX}*" | sort -V)

    if [ -z "$rc_tags" ]; then
        echo "1"
    else
        # Get the last RC tag and increment
        local last_rc=$(echo "$rc_tags" | tail -n 1)
        local last_rc_num=$(echo "$last_rc" | sed "s/${TAG_PREFIX}${base_version}-${RC_PREFIX}//")
        echo $((last_rc_num + 1))
    fi
}

# Generate CHANGELOG from git commits
generate_changelog() {
    local from_ref=$1
    local to_ref=${2:-HEAD}
    local version=$3

    print_info "Generating CHANGELOG from ${from_ref} to ${to_ref}..."

    # Get commits
    local commits=$(git log --pretty=format:"%h %s" ${from_ref}..${to_ref})

    # Create CHANGELOG content
    cat > "$CHANGELOG_FILE" << EOF
# CHANGELOG

## [${version}] - $(date +%Y-%m-%d)

### Overview
Release Candidate ${version} for Chai VC Platform Backend

### Features
EOF

    # Parse commits for features (commits starting with feat:)
    echo "$commits" | grep -i "^[a-f0-9]* feat:" | sed 's/^[a-f0-9]* feat: /- /' >> "$CHANGELOG_FILE" || echo "- No new features" >> "$CHANGELOG_FILE"

    cat >> "$CHANGELOG_FILE" << EOF

### Bug Fixes
EOF

    # Parse commits for fixes (commits starting with fix:)
    echo "$commits" | grep -i "^[a-f0-9]* fix:" | sed 's/^[a-f0-9]* fix: /- /' >> "$CHANGELOG_FILE" || echo "- No bug fixes" >> "$CHANGELOG_FILE"

    cat >> "$CHANGELOG_FILE" << EOF

### Improvements
EOF

    # Parse commits for improvements (commits starting with improvement:, refactor:, perf:)
    echo "$commits" | grep -iE "^[a-f0-9]* (improvement|refactor|perf):" | sed 's/^[a-f0-9]* [^:]*: /- /' >> "$CHANGELOG_FILE" || echo "- No improvements" >> "$CHANGELOG_FILE"

    cat >> "$CHANGELOG_FILE" << EOF

### Breaking Changes
EOF

    # Parse commits for breaking changes (commits with BREAKING CHANGE:)
    echo "$commits" | grep -i "BREAKING CHANGE" | sed 's/^[a-f0-9]* /- /' >> "$CHANGELOG_FILE" || echo "- No breaking changes" >> "$CHANGELOG_FILE"

    cat >> "$CHANGELOG_FILE" << EOF

### Tasks Completed (Round 6)
- [x] SD-JWT: deterministic claim ordering & stable canonicalization
- [x] SD-JWT: multi-credential bundle verification (batched VP)
- [x] BBS+: proof verification fallback & explicit 406
- [x] Issuer /issue idempotency keys
- [x] Trust Registry: per-issuer rate limits + audit trails
- [x] Revocation: partial statuslist fetch
- [x] NPI integration: circuit breaker & backoff
- [x] DID resolver: NX cache + admin flush endpoint
- [x] Widget backend: token scope + CORS allowlist
- [x] API: /healthz and /readyz endpoints
- [x] Observability: log sampling + PII redaction
- [x] Perf: JWKS & DID cache warmup
- [x] Security headers: HSTS, COEP/CORP/COOP
- [x] RFC7807: requestId + doc_url
- [x] FHIR facade: consistent error responses
- [x] Queue: staggered schedules + jitter
- [x] DB migrations: preflight checker
- [x] OpenAPI: error catalog + CI validation
- [x] Release tooling: RC scripts + CHANGELOG
- [x] Bug bash: labels + CI integration

### All Commits
EOF

    echo "$commits" | sed 's/^/- /' >> "$CHANGELOG_FILE"

    print_info "CHANGELOG generated: ${CHANGELOG_FILE}"
}

# ============================================================================
# Main Script
# ============================================================================

echo ""
echo "=========================================="
echo "  Release Candidate (RC) Tag Creator"
echo "=========================================="
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    print_error "Not a git repository. Please run this script from the repository root."
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warn "You have uncommitted changes:"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_info "Current branch: ${CURRENT_BRANCH}"

# Get base version
if [ -z "$1" ]; then
    print_error "Usage: $0 <version>"
    print_error "Example: $0 1.0.0"
    exit 1
fi

BASE_VERSION=$1
RC_NUMBER=$(get_next_rc_number "$BASE_VERSION")
RC_TAG="${TAG_PREFIX}${BASE_VERSION}-${RC_PREFIX}${RC_NUMBER}"

print_info "Next RC tag: ${RC_TAG}"

# Find the last tag to use as base for CHANGELOG
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
    print_warn "No previous tags found. Using first commit as base."
    LAST_TAG=$(git rev-list --max-parents=0 HEAD)
fi

print_info "Generating CHANGELOG from ${LAST_TAG} to HEAD..."

# Generate CHANGELOG
generate_changelog "$LAST_TAG" "HEAD" "$RC_TAG"

# Show CHANGELOG preview
echo ""
print_info "CHANGELOG Preview:"
echo "----------------------------------------"
head -n 50 "$CHANGELOG_FILE"
echo "----------------------------------------"
echo ""

# Confirm tag creation
read -p "Create tag ${RC_TAG}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warn "Tag creation cancelled."
    exit 0
fi

# Create annotated tag
git tag -a "$RC_TAG" -m "Release Candidate ${RC_NUMBER} for version ${BASE_VERSION}

$(head -n 30 ${CHANGELOG_FILE})"

print_info "Tag ${RC_TAG} created successfully!"

# Ask if user wants to push
echo ""
read -p "Push tag ${RC_TAG} to remote? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin "$RC_TAG"
    print_info "Tag ${RC_TAG} pushed to remote!"
fi

# Summary
echo ""
print_info "=========================================="
print_info "  Release Candidate Created!"
print_info "=========================================="
print_info "Tag: ${RC_TAG}"
print_info "CHANGELOG: ${CHANGELOG_FILE}"
print_info ""
print_info "Next steps:"
print_info "1. Review CHANGELOG.md"
print_info "2. Test the RC thoroughly"
print_info "3. Fix any pilot-blocker issues"
print_info "4. Repeat RC process if needed"
print_info "5. Promote to final release when ready"
echo ""

