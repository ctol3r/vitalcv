#!/usr/bin/env bash

set -euo pipefail

REGION="${1:-}"
NAMESPACE="${NAMESPACE:-vitalcv}"
MANIFEST_DIR="${MANIFEST_DIR:-infra/k8s/base}"
ROLLING_COMPONENTS=(${ROLLING_COMPONENTS:-api web worker})
CONFIG_COMPONENTS=(${CONFIG_COMPONENTS:-config jobs})
REGION_STATUS_ENDPOINT="${REGION_STATUS_ENDPOINT:-}"
REGION_ADMIN_TOKEN="${REGION_ADMIN_TOKEN:-}"

if [[ -z "${REGION}" ]]; then
  echo "Usage: $0 <aws-region>"
  echo "Example: $0 us-west-2"
  exit 1
fi

log() {
  echo "[multi-region-sync][${REGION}] $1"
}

log "Applying namespace ${NAMESPACE}"
kubectl apply -f "${MANIFEST_DIR}/namespace.yaml"
kubectl label namespace "${NAMESPACE}" vitalcv.io/region="${REGION}" --overwrite

apply_manifest() {
  local manifest="$1"
  if [[ -f "${MANIFEST_DIR}/${manifest}.yaml" ]]; then
    log "Deploying ${manifest}.yaml"
    kubectl -n "${NAMESPACE}" apply -f "${MANIFEST_DIR}/${manifest}.yaml"
  else
    log "Skipping ${manifest}.yaml (not found)"
  fi
}

for component in "${CONFIG_COMPONENTS[@]}"; do
  apply_manifest "${component}"
done

for component in "${ROLLING_COMPONENTS[@]}"; do
  apply_manifest "${component}"
  log "Waiting for rollout ${component}"
  kubectl -n "${NAMESPACE}" rollout status deployment "${component}" --timeout=180s
done

if [[ -n "${REGION_STATUS_ENDPOINT}" && -n "${REGION_ADMIN_TOKEN}" ]]; then
  log "Updating backend registry for ${REGION}"
  curl -sf -X POST "${REGION_STATUS_ENDPOINT}" \
    -H "Content-Type: application/json" \
    -H "x-region-admin-token: ${REGION_ADMIN_TOKEN}" \
    -d "{\"region\":\"${REGION}\",\"status\":\"healthy\"}" >/dev/null
else
  log "Skipping backend registry update (REGION_STATUS_ENDPOINT or REGION_ADMIN_TOKEN missing)"
fi

log "Deployment sync completed"









