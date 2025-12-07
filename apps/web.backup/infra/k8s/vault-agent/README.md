# Vault Agent Injector Profiles

This directory contains the baseline configuration for mounting secrets into Kubernetes pods via the HashiCorp Vault Agent Injector. The goal is to keep all application pods free of long-lived environment variables while still giving them seamless access to JWT signing keys, database passwords, and API tokens.

## Prerequisites

1. Vault namespace `platform/` with Kubernetes auth enabled.
2. `vault-auth` service account and corresponding ClusterRoleBinding installed in the cluster.
3. Helm release `vault-agent-injector` (see `infra/helm/vault-agent/values.yaml`).

## Layout

```
infra/k8s/vault-agent/
├── README.md
├── issuer-api-patch.yaml        # Strategic merge patch for issuer-api Deployment
├── web-api-patch.yaml           # Strategic merge patch for web API pods
└── templates/
    ├── issuer-api.env.tpl       # Template rendered into /vault/secrets/issuer-api.env
    └── web-api.env.tpl
```

Each template emits an `env` file that gets sourced by the container entrypoint. Secrets are never persisted to disk beyond the tmpfs that Vault Agent manages, and leases are auto-renewed.

## Usage

1. Apply the Vault Agent injector Helm chart (once per cluster).
2. Patch the deployment:
   ```bash
   kubectl patch deployment issuer-api -n platform --patch-file infra/k8s/vault-agent/issuer-api-patch.yaml
   ```
3. Restart the Deployment so pods get mutated.
4. Confirm that `/vault/secrets/issuer-api.env` exists inside the container and contains the exported variables.

### Dummy Secret Smoke Test

The patch files point at `secret/dev/api/dummy` by default. Populate it with:

```bash
vault kv put secret/dev/api/dummy SIGNING_KEY=dev-placeholder DATABASE_URL=postgres://vault:secret@postgres/dev
```

After the pod restarts:

```bash
kubectl -n platform exec deploy/issuer-api -- bash -c 'source /vault/secrets/issuer-api.env && env | grep SIGNING_KEY'
```

You should see the injected value and the log `agent: lease renewed` every ~20 minutes.

## Annotation Reference

Key annotations used:

| Annotation | Purpose |
|------------|---------|
| `vault.hashicorp.com/agent-inject` | Enables the injector webhook. |
| `vault.hashicorp.com/role` | Vault role bound to the Kubernetes service account. |
| `vault.hashicorp.com/agent-inject-secret-<name>` | Secret path to render. |
| `vault.hashicorp.com/agent-inject-template-<name>` | Go template rendered to file. |
| `vault.hashicorp.com/agent-pre-populate` | Ensures secret is written before the container starts. |

## Rotation / Lease Renewal

The agent handles lease renewal automatically. For signing keys, set `ttl = "30m"` and `max_ttl = "24h"` on the Vault role so pods refresh often but retain access during outages. When rotating a secret:

1. `vault kv put secret/prod/crypto/signing/issuer ...`
2. `kubectl rollout restart deployment issuer-api`
3. Confirm audit log entry (see `services/security/vaultAuditConfig.md`).

