# Wave 198 Rollback

Rollback this migration only if no dependent code is using `npi_did_binding`.

## SQL rollback steps

```sql
DROP INDEX IF EXISTS "npi_did_binding_did_idx";
DROP INDEX IF EXISTS "npi_did_binding_npi_idx";
DROP TABLE IF EXISTS "npi_did_binding";
DROP TYPE IF EXISTS "NpiDidBindingStatus";
```

## Notes

- This rollback deletes all persisted NPI-to-DID binding records.
- Run the rollback before deploying application code that depends on `NpiDidBinding`.
