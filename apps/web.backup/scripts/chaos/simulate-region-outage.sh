#!/usr/bin/env bash

set -euo pipefail

REGION="${1:-eu-central-1}"
NAMESPACE="${NAMESPACE:-vitalcv}"
COMPONENTS=(${COMPONENTS:-api web worker})
REGION_STATUS_ENDPOINT="${REGION_STATUS_ENDPOINT:-http://localhost:4000/api/region/status}"
REGION_ADMIN_TOKEN="${REGION_ADMIN_TOKEN:-}"
CLUSTER_NAME="${CLUSTER_NAME:-${EKS_CLUSTER_NAME:-vitalcv}}"

if [[ -z "${REGION}" ]]; then
  echo "Usage: $0 <aws-region>"
  exit 1
fi

log() {
  echo "[chaos][${REGION}] $1"
}

if command -v aws >/dev/null 2>&1; then
  log "Updating kubeconfig for ${CLUSTER_NAME}-${REGION}"
  aws eks update-kubeconfig --name "${CLUSTER_NAME}-${REGION}" --region "${REGION}"
else
  log "aws CLI not found, assuming kubeconfig already configured"
fi

for component in "${COMPONENTS[@]}"; do
  log "Scaling ${component} to 0 replicas"
  kubectl -n "${NAMESPACE}" scale deploy "${component}" --replicas=0 || true
done

log "Deleting leftover pods"
kubectl -n "${NAMESPACE}" delete pods --field-selector=status.phase=Running || true

if [[ -n "${REGION_ADMIN_TOKEN}" ]]; then
  log "Marking ${REGION} as down via region registry"
  curl -sf -X POST "${REGION_STATUS_ENDPOINT}" \
    -H "Content-Type: application/json" \
    -H "x-region-admin-token: ${REGION_ADMIN_TOKEN}" \
    -d "{\"region\":\"${REGION}\",\"status\":\"down\"}" >/dev/null
else
  log "Skipping backend registry update (REGION_ADMIN_TOKEN missing)"
fi

log "eu-central-1 outage simulation completed"









