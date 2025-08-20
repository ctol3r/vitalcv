# Credential Pallet

This Substrate pallet provides basic functionality for credential issuance, updates,
and revocation. Credentials are stored in chain storage and associated with the
account that created them.

## Features
- **issue_credential**: Create a new credential owned by the caller.
- **update_credential**: Modify an existing credential's data if you are the owner.
- **revoke_credential**: Mark a credential as revoked.

See the pallet's `lib.rs` for implementation details.
