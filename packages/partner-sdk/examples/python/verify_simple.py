"""
Simple Credential Verification Example (Python)
Tagged: run: next-batch-20251031-2

Demonstrates basic usage of the VitalCV Partner SDK
"""

from vitalcv_partner_sdk import verify_credential, check_revocation
from datetime import datetime, timedelta

# Example credential proof from VitalCV holder
proof = {
    "credentialId": "vc:med-license:abc123",
    "holderDid": "did:vitalcv:holder-456",
    "signature": "a1b2c3d4e5f6...",  # Ed25519 signature (hex)
    "issuedAt": "2025-10-15T10:30:00Z",
    "expiresAt": "2026-10-15T10:30:00Z",
    "claims": {
        "type": "MedicalLicense",
        "npi": "1801921148",
        "licenseNumber": "MD-12345",
        "name": "Dr. Jane Smith",
        "specialty": "Internal Medicine",
        "state": "CA",
    },
}

def main():
    print("🔍 Verifying credential...\n")

    try:
        # Verify the credential
        result = verify_credential(proof, options={
            "check_revocation": True,
            "verifier_did": "did:vitalcv:partner-acme",
        })

        print(f"Result: {result}")

        if result["valid"]:
            print("\n✅ Credential is VALID")
            print("\n📋 Verified Claims:")
            claims = result["claims"]
            print(f"   Type: {claims['type']}")
            print(f"   NPI: {claims['npi']}")
            print(f"   Name: {claims['name']}")
            print(f"   License: {claims['licenseNumber']}")
            print(f"   Specialty: {claims['specialty']}")

            print("\n🔐 Verification Details:")
            print(f"   Holder DID: {result['holder_did']}")
            print(f"   Issued: {result['issued_at']}")
            print(f"   Audit Ref: {result['audit_ref']}")

            # Check if revoked
            if result.get("revoked"):
                print("\n⚠️  WARNING: Credential has been REVOKED")
                print(f"   Revoked At: {result.get('revoked_at')}")
                print(f"   Reason: {result.get('revocation_reason')}")
            else:
                print("\n✅ Revocation Status: ACTIVE")

            # Age check
            issued_at = datetime.fromisoformat(result["issued_at"].replace("Z", "+00:00"))
            age = datetime.now(issued_at.tzinfo) - issued_at
            days_old = age.days
            print(f"\n📅 Credential Age: {days_old} days")

            if days_old > 90:
                print("   ⚠️  Credential is older than 90 days - consider requesting refresh")

        else:
            print("\n❌ Credential is INVALID")
            print(f"   Error: {result.get('error')}")
            print(f"   Error Code: {result.get('error_code')}")

    except Exception as error:
        print(f"\n💥 Verification error: {str(error)}")
        exit(1)

if __name__ == "__main__":
    main()

