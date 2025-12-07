# Verifier Quick-Start Guide

Learn how to verify VitalCV credentials instantly and securely.

## 1. Scanning QR

To verify a clinician's credentials:

1.  Open the **VitalCV Verifier App** or use the web-based **Verifier Portal**.
2.  Select **"Scan Credential"**.
3.  Point your camera at the Clinician's presented QR code.
4.  The system will perform a handshake via OIDC4VP.

## 2. Interpreting Disclosure Level

Credentials may contain sensitive data. VitalCV supports **Selective Disclosure**.

*   **Full Disclosure:** You receive all fields in the credential (e.g., Home Address, SSN if present).
*   **Minimal Disclosure:** The Clinician has chosen to share only specific fields (e.g., "License Active: Yes", "Name").
*   **Review:** Ensure the disclosed fields meet your verification requirements.

## 3. Verifying Expiration/Revocation

The verifier engine automatically checks validity.

*   **Signature Check:** Verifies the Issuer's cryptographic signature (DID).
*   **Expiration:** Checks if `validUntil` date has passed.
*   **Revocation:** Queries the Issuer's **Status List** to ensure the credential has not been revoked.
*   **Result:**
    *   ✅ **Valid:** Green checkmark. Trustworthy.
    *   ⚠️ **Expired/Revoked:** Red warning. Do not accept.
    *   ❌ **Invalid Signature:** Tampered credential.

## 4. Resolving Errors

Common verification errors and fixes:

*   **"Network Error":** Ensure you have an active internet connection to check revocation lists.
*   **"Unsupported Format":** Ensure the credential is a supported VC format (e.g., SD-JWT, JWT-VC).
*   **"Request Timed Out":** The QR code may have expired. Ask the Clinician to regenerate it.

