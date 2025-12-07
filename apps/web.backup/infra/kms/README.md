# Multi-Region KMS Policy

`multi-region-key-policy.json` is a templated AWS KMS policy that keeps the signing keys accessible in every deployment region.

## Usage

1. Replace `{{ACCOUNT_ID}}` with the AWS account ID.
2. Update the role names if your IAM roles differ from `VitalCV*`.
3. Attach the policy to the multi-region KMS key and enable automatic rotation (`EnableKeyRotation` is granted to the replication role).
4. Replicate the key to `us-west-2`, `us-east-1`, and `eu-central-1` using `kms:ReplicateKey`.
5. Store the resulting key ARN in `REGION_SIGNING_KEY_ARN` for each cluster to guarantee signing parity.









