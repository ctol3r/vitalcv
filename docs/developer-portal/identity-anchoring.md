# Identity Anchoring Best Practices

Identity anchoring ensures that credentials issued through the Chai VC Platform are reliably linked back to the real-world identity of an individual or organization. Robust identity anchoring protects against fraud and reduces the risk of misissued credentials.

## 1. Verify Source Documents

Always collect and verify authoritative source documents. Accept government-issued identification or other widely recognized proofs (e.g., professional licenses). Use automated systems or trained personnel to confirm document authenticity.

## 2. Link Issued Credentials to Verified Identities

Ensure that verifiable credentials reference the identity data that was verified during onboarding. This may include full legal name, licensing information, or other unique identifiers that help correlate the credential holder with the verified source documents.

## 3. Record Audit Trails

Maintain audit logs for every step of the identity verification and credential issuance processes. Audit trails should capture who performed the verification, the evidence used, and the time of issuance. These logs are essential for compliance reviews and resolving disputes.

## 4. Protect Sensitive Data

Store identity data using strong encryption at rest and in transit. Restrict access to sensitive data to only authorized personnel and systems. Follow the platform's data retention policies and purge data that is no longer needed.

## 5. Enable Revocation and Updates

Sometimes the underlying identity data changes (e.g., name changes or license status updates). The platform should allow credentials to be revoked or updated to reflect these changes, preventing stale or incorrect data from remaining in circulation.

## 6. Educate Credential Holders

Provide credential holders with guidance on how to keep their personal information secure, how to report discrepancies, and how the revocation process works. Well-informed users are better equipped to maintain the integrity of their credentials.

## 7. Follow Regulatory Requirements

Stay up to date with relevant data privacy and credentialing regulations in your jurisdiction. Ensure that your identity anchoring workflow complies with these regulations to minimize legal risks.

---

By implementing these best practices, developers using the Chai VC Platform can create trustworthy credentials that stand up to scrutiny and inspire confidence in verifiers.
