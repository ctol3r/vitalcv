import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { subjectId, type } = await request.json()

    if (!subjectId || !type) {
      return NextResponse.json({ error: "subjectId and type are required" }, { status: 400 })
    }

    // TODO: Replace with actual backend call
    // For now, simulate credential issuance
    const credentialId = `cred-${Date.now()}`
    const mockVC = {
      "@context": ["https://www.w3.org/2018/credentials/v1", "https://vitalcv.com/contexts/v1"],
      id: `https://vitalcv.com/credentials/${credentialId}`,
      type: ["VerifiableCredential", type],
      issuer: {
        id: "did:web:vitalcv.com",
        name: "VitalCV Issuer",
      },
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      credentialSubject: {
        id: subjectId,
        type: type,
        issuedBy: "VitalCV Platform",
        status: "active",
      },
      proof: {
        type: "Ed25519Signature2020",
        created: new Date().toISOString(),
        verificationMethod: "did:web:vitalcv.com#key-1",
        proofPurpose: "assertionMethod",
        proofValue: "mock-signature-value",
      },
    }

    return NextResponse.json(
      {
        message: "Credential issued successfully",
        id: credentialId,
        vc: mockVC,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Credential issuance error:", error)
    return NextResponse.json({ error: "Failed to issue credential" }, { status: 500 })
  }
}
