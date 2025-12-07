# Issuer Operations Manual

This guide outlines the operational workflows for Issuers using the VitalCV platform to verify and issue credentials.

## 1. Approving Credential Claims

Incoming claims from Clinicians appear in the **Issuer Dashboard**.

1.  Navigate to the **"Pending Claims"** tab.
2.  Review the claim details (NPI, License Number, uploaded documents).
3.  Cross-reference with external registries if automated checks are flagged.
4.  Click **"Approve"** to initiate issuance or **"Reject"** with a reason code.

## 2. Reviewing Documents

For claims requiring manual review:

1.  Click the **"View Documents"** icon next to the claim.
2.  Use the built-in viewer to inspect PDFs or images.
3.  Verify:
    *   Document is legible.
    *   Names match the NPI record.
    *   Dates are valid (not expired).
4.  Mark documents as **"Verified"** to proceed.

## 3. Issuing VC (OIDC4VCI Flow)

Upon approval, the issuance process triggers automatically via OIDC4VCI (OpenID Connect for Verifiable Credential Issuance).

1.  The system generates the Verifiable Credential (VC) payload.
2.  The Issuer's **Private Key** signs the VC.
3.  The VC is offered to the Clinician's wallet.
4.  Status changes to **"Issued"** once the Clinician accepts.

## 4. Revocation Process

If a credential needs to be revoked (e.g., license suspension, error in issuance):

1.  Go to the **"Issued Credentials"** log.
2.  Search for the specific credential ID or Clinician NPI.
3.  Select **"Revoke"**.
4.  Choose a **Revocation Reason** (e.g., "Privilege Suspended", "Issued in Error").
5.  The status is updated in the **Status List** (Bitstring or list-based revocation), ensuring verifiers see it as invalid immediately.

## 5. Audit Log Reference

All actions are logged for compliance.

*   **Access:** `/admin/audit` or the "Audit Log" tab.
*   **Logged Events:**
    *   Claim Submission
    *   Document View
    *   Approval/Rejection
    *   Issuance (Signature generation)
    *   Revocation
*   **Retention:** Logs are immutable and retained according to system policy (default: 7 years).

