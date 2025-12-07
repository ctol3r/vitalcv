# Vault Audit Logging Configuration

## Overview

All reads and writes to signing-key paths must be captured in Vault's audit log so we can detect anomalous activity and prove compliance (SOC2 CC6.6 / CC7.2). This document describes the standard configuration for dev, staging, and production clusters. It also documents the runbook for reviewing logs during key rotation.

## Enabling the Audit Device

| Environment | Backend | Command |
|-------------|---------|---------|
| Development | File (JSON) | `vault audit enable -path=file file file_path=/tmp/vault_audit.log log_raw=false` |
| Staging     | File + Syslog | `vault audit enable file file_path=/var/log/vault/vault_audit.log` and `vault audit enable syslog tag=vault` |
| Production  | Socket (Vector) | `vault audit enable socket address=unix:///var/run/vault/audit.sock mode=640` (Vector forwards to SIEM) |

**Important:** Never disable the production audit device. Vault will refuse to start if the last enabled audit device is removed; treat this as a break-glass event requiring security approval.

## Paths to Monitor

```
secret/*/crypto/signing/*
secret/*/secrets/*
transit/signing/*
sys/leases/renew
auth/kubernetes/login
```

The default policy ships every request/response body. When enabling audit logging, we redact high-risk fields via `log_raw=false` and `hmac_accessor=true`. This ensures values are hashed with a per-device salt so we can correlate activity without leaking plaintext secrets.

## Shipping Logs

1. **Vector Agent** on every Vault node tails `/var/log/vault/vault_audit.log`.
2. Logs flow to the `vault-audit` Kafka topic (retained 30 days).
3. A tiny Go service (`ops/vault-audit-tail`) pushes suspicious events to Slack `#sec-ops`.

### Slack Alerts

We alert on:
- Multiple reads of the same signing key within a 15-minute window.
- Any delete/destroy operation on `secret/*/signing/*`.
- Authentication failures from unknown Kubernetes service accounts.

Alert payload example:

```json
{
  "service": "vault",
  "event": "signing-key-access",
  "path": "secret/prod/crypto/signing/issuer",
  "entity": "k8s:issuer-api",
  "count_15m": 4,
  "threshold": 3,
  "window": "2025-11-14T20:00Z"
}
```

## Rotation Runbook

1. **Before rotation** set `rotation_window = now() + interval '2 hours'` in PagerDuty change record.
2. Run `vault list sys/audit-hash/file` to snapshot recent requests.
3. Execute signing-key rotation (see `scripts/rotate-signing-keys.ts`).
4. Grep audit logs for the new `kid`:
   ```
   vault audit hash file secret/prod/crypto/signing/issuer | jq '.hash'
   ```
5. Record `kid`, operator, and audit hash in `docs/security/rotation-log.md`.
6. SIEM rule automatically downgrades alerts for the new key while `rotation_window` is active (default 2 hours).

## Incident Response

- **Unexpected Delete:** Immediately revoke Vault token, rotate key, and open SEC-INC ticket.
- **Excessive Reads:** Quarantine responsible Kubernetes service account, pull pod logs, rotate key.
- **Audit Device Failure:** Vault emits `audit-degraded` metric. Treat as Sev-1; system must fail-closed (entries in `sys/audit` should show at least one enabled backend).

## Verification Checklist

- [ ] `vault audit list` shows at least one enabled backend.
- [ ] `vault audit enable` commands stored in `ops/vault/bootstrap.sh`.
- [ ] Daily cron `ops/vault/verify_audit.sh` confirms log file growth.
- [ ] SIEM dashboard `VAULT-AUDIT-01` has < 5% parsing errors.
- [ ] Security team notified when `rotation_window` expires.

