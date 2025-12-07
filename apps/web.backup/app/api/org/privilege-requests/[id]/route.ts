import { NextRequest, NextResponse } from "next/server";
import { GetPrivilegeRequestResponse } from "@/lib/types/privileging";

// Mock data - in production, fetch from database
const mockRequests = [
  {
    id: "pr-001",
    clinicianId: "cli-001",
    clinicianName: "Dr. Sarah Johnson",
    clinicianNPI: "1234567890",
    privilegeSetId: "ps-001",
    privilegeSetName: "Cardiology - Interventional",
    department: "Cardiology",
    status: "pending" as const,
    requestDate: "2024-11-10T14:30:00Z",
    verifiableCredential: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "MedicalLicenseCredential"],
      issuer: "did:example:california-medical-board",
      issuanceDate: "2023-01-15T00:00:00Z",
      expirationDate: "2025-01-15T00:00:00Z",
      credentialSubject: {
        id: "did:example:clinician-123",
        name: "Dr. Sarah Johnson",
        npi: "1234567890",
        licenseNumber: "A123456",
        licenseState: "CA",
        specialty: "Cardiology",
        boardCertification: ["American Board of Internal Medicine - Cardiology"],
        yearsExperience: 12,
        procedures: [
          { name: "Coronary Angiography", caseCount: 450 },
          { name: "PCI", caseCount: 320 },
          { name: "Cardiac Catheterization", caseCount: 500 },
        ],
      },
    },
    passReasons: [
      "Board certified in Cardiology",
      "12 years of clinical experience exceeds 5-year requirement",
      "450+ coronary angiography cases exceed minimum of 50/year",
      "Valid CA medical license through 2025",
      "Active NPI registration verified",
    ],
    failReasons: [],
  },
];

/**
 * GET /api/org/privilege-requests/[id]
 * Get a specific privilege request by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Find request
    const privilegeRequest = mockRequests.find((req) => req.id === id);

    if (!privilegeRequest) {
      return NextResponse.json(
        {
          success: false,
          error: "Privilege request not found",
        },
        { status: 404 }
      );
    }

    const response: GetPrivilegeRequestResponse = {
      success: true,
      data: privilegeRequest,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching privilege request:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch privilege request",
      },
      { status: 500 }
    );
  }
}

