# Wave 199 Rollback

Rollback this migration only if no deployed code depends on persisted SD-JWT issuer keys or issued credential records.

## SQL rollback steps

```sql
DROP INDEX IF EXISTS "IssuedCredentialRecord_revokedAt_idx";
DROP INDEX IF EXISTS "IssuedCredentialRecord_status_idx";
DROP INDEX IF EXISTS "IssuedCredentialRecord_kid_idx";
DROP INDEX IF EXISTS "IssuedCredentialRecord_holderDid_createdAt_idx";
DROP INDEX IF EXISTS "IssuedCredentialRecord_issuerDid_createdAt_idx";
DROP TABLE IF EXISTS "IssuedCredentialRecord";

DROP INDEX IF EXISTS "IssuerSigningKey_rotatedFromKid_idx";
DROP INDEX IF EXISTS "IssuerSigningKey_graceUntil_idx";
DROP INDEX IF EXISTS "IssuerSigningKey_issuerDid_activatesAt_idx";
DROP INDEX IF EXISTS "IssuerSigningKey_issuerDid_state_idx";
DROP TABLE IF EXISTS "IssuerSigningKey";

DROP TYPE IF EXISTS "IssuerSigningKeyState";
```

## Notes

- This rollback deletes persisted issuer signing-key lineage and issued SD-JWT credential receipts/links.
- Roll back the application release first so no running code expects these tables.
- The migration is additive only; if application rollback is enough, leave the schema in place and clean up later.
