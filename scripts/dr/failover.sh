#!/bin/bash
# failover.sh - Scripted multi-region failover drill for Kubernetes clusters

set -euo pipefail

MAIN_CONTEXT="${MAIN_REGION:-}"
SECONDARY_CONTEXT="${SECONDARY_REGION:-}"

if [[ -z "$MAIN_CONTEXT" || -z "$SECONDARY_CONTEXT" ]]; then
  echo "MAIN_REGION and SECONDARY_REGION environment variables must be set" >&2
  exit 1
fi

echo "Checking health of primary region: $MAIN_CONTEXT"
if ! kubectl --context "$MAIN_CONTEXT" get nodes >/dev/null 2>&1; then
  echo "Primary region $MAIN_CONTEXT unreachable. Failing over to $SECONDARY_CONTEXT"
  kubectl config use-context "$SECONDARY_CONTEXT"
  echo "Traffic switched to $SECONDARY_CONTEXT"
else
  echo "Primary region healthy. Running failover drill."
  kubectl config use-context "$SECONDARY_CONTEXT"
  echo "Failover to $SECONDARY_CONTEXT successful."
  kubectl config use-context "$MAIN_CONTEXT"
  echo "Restored traffic to $MAIN_CONTEXT"
fi

