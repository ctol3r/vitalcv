# Active-Active Postgres Playbook

This playbook documents how we keep the VitalCV Postgres clusters synchronized across `us-west-2`, `us-east-1`, and `eu-central-1` using logical replication and an explicit conflict policy.

## 1. Prerequisites

- Helm release upgraded with the latest `infra/helm/postgres/values.yaml`.
- `pglogical` extension enabled (automatically via `02_enable_pglogical.sql`).
- Network connectivity between regional clusters over port `5432`.
- The replication service account (`repl_user`) rotated and stored in `postgres-app-credentials`.

Export the connection strings for each region (replace credentials as needed):

```bash
export DATABASE_URL_WEST="postgres://vitalcv:***@pg-west.vitalcv.internal:5432/vitalcv"
export DATABASE_URL_EAST="postgres://vitalcv:***@pg-east.vitalcv.internal:5432/vitalcv"
export DATABASE_URL_EU="postgres://vitalcv:***@pg-eu.vitalcv.internal:5432/vitalcv"
```

## 2. Create publications in every region

Apply `infra/postgres/logical-replication.sql` against each cluster, substituting the `NODE_NAME` and `DSN` placeholders:

```bash
psql "$DATABASE_URL_WEST" -v NODE_NAME="'us_west_2'" -v DSN="'host=pg-west.vitalcv.internal dbname=vitalcv user=repl_user password=***'" -f infra/postgres/logical-replication.sql
psql "$DATABASE_URL_EAST" -v NODE_NAME="'us_east_1'" -v DSN="'host=pg-east.vitalcv.internal dbname=vitalcv user=repl_user password=***'" -f infra/postgres/logical-replication.sql
psql "$DATABASE_URL_EU"   -v NODE_NAME="'eu_central_1'" -v DSN="'host=pg-eu.vitalcv.internal dbname=vitalcv user=repl_user password=***'" -f infra/postgres/logical-replication.sql
```

Each execution will:

1. Create (or refresh) the `vitalcv_publication` publication.
2. Register a `pglogical` node with `last_update_wins` conflict resolution.
3. Subscribe to the other regions with synchronous replication so lag is bounded.

## 3. Conflict resolution and monitoring

- `pglogical.conflict_resolution` is set to `last_update_wins`. Writes that arrive later win automatically.
- `track_commit_timestamp` is enabled, so clashing transactions carry precise timestamps.
- Use the `pglogical.show_subscription_status()` view to ensure `replication_lag` stays below 500ms. The Grafana dashboard `Multi-Region Postgres` already scrapes this metric.

## 4. Cutover and failback

1. Pause application writers in the failing region with `kubectl scale deploy/api --replicas=0`.
2. Promote the nearest healthy region by updating the backend registry:
   ```bash
   curl -X POST "$REGION_STATUS_ENDPOINT" \
     -H "Content-Type: application/json" \
     -H "x-region-admin-token: $REGION_ADMIN_TOKEN" \
     -d '{"region":"us-east-1","status":"healthy"}'
   ```
3. When the failed region recovers, re-run the SQL playbook to rejoin the replication mesh and then set its status back to `healthy`.

## 5. Rotation

Key steps:

- Rotate `repl_user` credentials quarterly using the `postgres-app-credentials` secret and restart Pods.
- Re-run the SQL playbook after every rotation to refresh the subscriptions.
- Document changes in the runbook and attach the latest `regionSnapshot` event ID for traceability.









