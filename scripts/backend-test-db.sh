#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTAINER_NAME="vitalcv-backend-test-db"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
POSTGRES_USER="${POSTGRES_USER:-vitalcv_test}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-vitalcv_test}"
POSTGRES_DB="${POSTGRES_DB:-vitalcv_test}"
POSTGRES_BIN_DIR="${POSTGRES_BIN_DIR:-/Applications/Postgres.app/Contents/Versions/16/bin}"
JEST_ARGS=("$@")
USE_LOCAL_POSTGRES=0
LOCAL_DATA_DIR=""
LOCAL_SOCKET_DIR=""
LOCAL_PORT=""
LOCK_ROOT="${TMPDIR:-/tmp}/vitalcv-backend-test-locks"
LOCK_DIR="${LOCK_ROOT}/backend-suite"
LOCK_OWNER_FILE="${LOCK_DIR}/owner.pid"
LOCK_ACQUIRED=0

mkdir -p "${LOCK_ROOT}"

docker_available() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  docker info >/dev/null 2>&1 &
  local docker_info_pid=$!

  for _ in $(seq 1 50); do
    if ! kill -0 "${docker_info_pid}" >/dev/null 2>&1; then
      wait "${docker_info_pid}"
      return $?
    fi
    sleep 0.1
  done

  kill "${docker_info_pid}" >/dev/null 2>&1 || true
  wait "${docker_info_pid}" >/dev/null 2>&1 || true
  return 1
}

for _ in $(seq 1 1800); do
  if mkdir "${LOCK_DIR}" 2>/dev/null; then
    printf '%s\n' "$$" > "${LOCK_OWNER_FILE}"
    LOCK_ACQUIRED=1
    break
  fi

  if [[ -f "${LOCK_OWNER_FILE}" ]]; then
    LOCK_OWNER_PID="$(cat "${LOCK_OWNER_FILE}" 2>/dev/null || true)"
    if [[ -n "${LOCK_OWNER_PID}" ]] && ! kill -0 "${LOCK_OWNER_PID}" >/dev/null 2>&1; then
      rm -f "${LOCK_OWNER_FILE}" >/dev/null 2>&1 || true
      rmdir "${LOCK_DIR}" >/dev/null 2>&1 || true
      continue
    fi
  fi

  sleep 0.2
done

if [[ "${LOCK_ACQUIRED}" != "1" ]]; then
  echo "Timed out waiting for backend test lock" >&2
  exit 1
fi

cleanup() {
  if [[ "${USE_LOCAL_POSTGRES}" == "1" && -n "${LOCAL_DATA_DIR}" ]]; then
    "${POSTGRES_BIN_DIR}/pg_ctl" -D "${LOCAL_DATA_DIR}" -m immediate stop >/dev/null 2>&1 || true
  fi

  if [[ -n "${LOCAL_SOCKET_DIR}" && -d "${LOCAL_SOCKET_DIR}" ]]; then
    rm -rf "${LOCAL_SOCKET_DIR}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${LOCAL_DATA_DIR}" && -d "${LOCAL_DATA_DIR}" ]]; then
    rm -rf "${LOCAL_DATA_DIR}" >/dev/null 2>&1 || true
  fi

  if docker_available && docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi

  rm -f "${LOCK_OWNER_FILE}" >/dev/null 2>&1 || true
  rmdir "${LOCK_DIR}" >/dev/null 2>&1 || true

  return 0
}

cleanup_stale_container() {
  if docker_available && docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

# Do not call cleanup here: it also releases LOCK_DIR. The suite lock must
# remain held until the EXIT trap runs or parallel worktrees can mutate the
# shared Prisma client and test database at the same time.
cleanup_stale_container

if docker_available; then
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -p 127.0.0.1::5432 \
    "${POSTGRES_IMAGE}" >/dev/null

  HOST_PORT=""
  for _ in $(seq 1 30); do
    HOST_PORT="$(docker port "${CONTAINER_NAME}" 5432/tcp | awk -F: 'NR==1 {print $NF}')"
    if [[ -n "${HOST_PORT}" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "${HOST_PORT}" ]]; then
    echo "Failed to resolve host port for ${CONTAINER_NAME}" >&2
    exit 1
  fi

  for _ in $(seq 1 30); do
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! docker exec "${CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    echo "Postgres test container did not become ready" >&2
    exit 1
  fi

  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${HOST_PORT}/${POSTGRES_DB}"
else
  if [[ ! -x "${POSTGRES_BIN_DIR}/initdb" || ! -x "${POSTGRES_BIN_DIR}/pg_ctl" ]]; then
    echo "Docker is unavailable and Postgres.app binaries were not found in ${POSTGRES_BIN_DIR}" >&2
    exit 1
  fi

  USE_LOCAL_POSTGRES=1
  LOCAL_DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vitalcv-pgdata.XXXXXX")"
  LOCAL_SOCKET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vitalcv-pgsock.XXXXXX")"
  LOCAL_PORT="$(
    node -e "const net=require('node:net');const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string'){process.exit(1);}process.stdout.write(String(address.port));server.close();});"
  )"

  "${POSTGRES_BIN_DIR}/initdb" -D "${LOCAL_DATA_DIR}" -U "${POSTGRES_USER}" --auth=trust >/dev/null
  "${POSTGRES_BIN_DIR}/pg_ctl" \
    -D "${LOCAL_DATA_DIR}" \
    -o "-p ${LOCAL_PORT} -k ${LOCAL_SOCKET_DIR} -h 127.0.0.1" \
    -w start >/dev/null
  "${POSTGRES_BIN_DIR}/createdb" -h 127.0.0.1 -p "${LOCAL_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}"

  export DATABASE_URL="postgresql://${POSTGRES_USER}@127.0.0.1:${LOCAL_PORT}/${POSTGRES_DB}"
fi

export NODE_ENV="test"

cd "${REPO_ROOT}"
cd "${REPO_ROOT}/apps/api/backend"
bash ../../../scripts/prisma-generate-locked.sh --schema prisma/schema.prisma >/dev/null
pnpm exec prisma migrate deploy --schema prisma/schema.prisma >/dev/null
set +e
if [[ ${#JEST_ARGS[@]} -gt 0 ]]; then
  pnpm exec jest "${JEST_ARGS[@]}"
  TEST_EXIT=$?
else
  pnpm exec jest
  TEST_EXIT=$?
fi
set -e

exit "${TEST_EXIT}"
