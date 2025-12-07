# Clinician Onboarding Guide

Welcome to VitalCV! This guide will walk you through setting up your profile and receiving your first verifiable credential.

## 1. NPI Lookup Steps

VitalCV integrates with the NPPES registry to verify your identity.

1.  Navigate to the **Profile** or **Onboarding** section.
2.  Enter your **National Provider Identifier (NPI)** number in the search box.
3.  Confirm your details (Name, Practice Address, Taxonomy) match the records found.
    *   *Note: If your NPI data is outdated, please update it on the NPPES website first.*

## 2. Document Upload Requirements

To support your credential claims, you may need to upload verification documents.

*   **Accepted Formats:** PDF, JPG, PNG.
*   **Max File Size:** 5MB per document.
*   **Required Documents:**
    *   State Medical License (current copy).
    *   Board Certification (if applicable).
    *   Government-issued ID (Driver's License or Passport) for identity proofing.

## 3. Linking Wallet (DID)

VitalCV uses Decentralized Identifiers (DIDs) to anchor your identity.

1.  You will be prompted to **Connect Wallet**.
2.  VitalCV supports standard Web Wallets and mobile wallets via WalletConnect.
3.  Once connected, a unique **DID** is generated/linked to your account. This DID will be the subject of your verifiable credentials.

## 4. Receiving Credential

Once your claims are approved by an Issuer:

1.  You will receive a notification in your dashboard.
2.  Click **"Accept Credential"**.
3.  The credential will be cryptographically signed and stored in your digital wallet.
4.  You can view the raw JSON-LD or JWT format in the credential details view.

## 5. Presenting via QR/OIDC4VP

To share your credentials with a Verifier (e.g., a hospital or recruiter):

1.  Click **"Share"** or **"Present"** on the credential card.
2.  A **QR Code** will be generated.
3.  The Verifier scans this QR code.
4.  VitalCV uses **OIDC4VP (OpenID Connect for Verifiable Presentations)** to securely transmit the credential data.
5.  You may be asked to approve the disclosure of specific fields (Selective Disclosure).

