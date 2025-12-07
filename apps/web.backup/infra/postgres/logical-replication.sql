-- Usage:
-- psql "$DATABASE_URL" \
--   -v NODE_NAME="'us_west_2'" \
--   -v DSN="'host=pg-west.vitalcv.internal dbname=vitalcv user=repl_user password=***'" \
--   -v PROVIDER_ONE_DSN="'host=pg-east.vitalcv.internal dbname=vitalcv user=repl_user password=***'" \
--   -v PROVIDER_TWO_DSN="'host=pg-eu.vitalcv.internal dbname=vitalcv user=repl_user password=***'" \
--   -f infra/postgres/logical-replication.sql

CREATE EXTENSION IF NOT EXISTS pglogical;

-- Ensure publication exists for all application tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'vitalcv_publication'
  ) THEN
    EXECUTE 'CREATE PUBLICATION vitalcv_publication FOR ALL TABLES';
  END IF;
END $$;

-- Register the local node (idempotent).
SELECT pglogical.create_node(
  node_name := :NODE_NAME,
  dsn := :DSN
) ON CONFLICT DO NOTHING;

-- Subscribe to up to two peer regions (optional).
DO $$
BEGIN
  IF :'PROVIDER_ONE_DSN' IS NOT NULL THEN
    BEGIN
      PERFORM pglogical.create_subscription(
        subscription_name := format('%s_to_peer1', :NODE_NAME),
        provider_dsn := :'PROVIDER_ONE_DSN',
        replication_sets := ARRAY['default'],
        forward_origins := ARRAY['all'],
        synchronize_data := true,
        apply_delay := '0 seconds',
        synchronize_structure := true
      );
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Subscription to peer1 already exists';
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF :'PROVIDER_TWO_DSN' IS NOT NULL THEN
    BEGIN
      PERFORM pglogical.create_subscription(
        subscription_name := format('%s_to_peer2', :NODE_NAME),
        provider_dsn := :'PROVIDER_TWO_DSN',
        replication_sets := ARRAY['default'],
        forward_origins := ARRAY['all'],
        synchronize_data := true,
        apply_delay := '0 seconds',
        synchronize_structure := true
      );
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Subscription to peer2 already exists';
    END;
  END IF;
END $$;

