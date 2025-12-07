import { NextRequest, NextResponse } from "next/server";
import {
  PrivilegeRequest,
  ListPrivilegeRequestsResponse,
} from "@/lib/types/privileging";

// Mock data storage
const mockRequests: PrivilegeRequest[] = [
  {
    id: "pr-001",
    clinicianId: "cli-001",
    clinicianName: "Dr. Sarah Johnson",
    clinicianNPI: "1234567890",
    privilegeSetId: "ps-001",
    privilegeSetName: "Cardiology - Interventional",
    department: "Cardiology",
    status: "pending",
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
  {
    id: "pr-002",
    clinicianId: "cli-002",
    clinicianName: "Dr. Michael Chen",
    clinicianNPI: "2345678901",
    privilegeSetId: "ps-002",
    privilegeSetName: "General Surgery - Advanced",
    department: "Surgery",
    status: "under_review",
    requestDate: "2024-11-08T09:15:00Z",
    reviewerName: "Dr. Emily Davis",
    reviewerId: "rev-001",
    verifiableCredential: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "MedicalLicenseCredential"],
      issuer: "did:example:california-medical-board",
      issuanceDate: "2023-01-15T00:00:00Z",
      expirationDate: "2025-01-15T00:00:00Z",
      credentialSubject: {
        id: "did:example:clinician-456",
        name: "Dr. Michael Chen",
        npi: "2345678901",
        licenseNumber: "B234567",
        licenseState: "CA",
        specialty: "General Surgery",
        yearsExperience: 8,
      },
    },
    passReasons: [
      "Board certified in General Surgery",
      "8 years surgical experience",
      "Valid license and credentials",
    ],
    failReasons: [],
  },
  {
    id: "pr-003",
    clinicianId: "cli-003",
    clinicianName: "Dr. Jennifer Martinez",
    clinicianNPI: "3456789012",
    privilegeSetId: "ps-003",
    privilegeSetName: "Emergency Medicine - Level I",
    department: "Emergency Medicine",
    status: "approved",
    requestDate: "2024-11-05T16:45:00Z",
    reviewedDate: "2024-11-06T10:00:00Z",
    reviewerName: "Dr. Robert Wilson",
    reviewerId: "rev-002",
    reviewNotes: "Excellent qualifications and experience. Approved for full privileges.",
    verifiableCredential: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "MedicalLicenseCredential"],
      issuer: "did:example:california-medical-board",
      issuanceDate: "2023-01-15T00:00:00Z",
      credentialSubject: {
        id: "did:example:clinician-789",
        name: "Dr. Jennifer Martinez",
        npi: "3456789012",
        licenseState: "CA",
        specialty: "Emergency Medicine",
      },
    },
    passReasons: [
      "Board certified in Emergency Medicine",
      "10+ years EM experience",
      "Extensive trauma experience",
    ],
    failReasons: [],
  },
  {
    id: "pr-004",
    clinicianId: "cli-004",
    clinicianName: "Dr. David Lee",
    clinicianNPI: "4567890123",
    privilegeSetId: "ps-004",
    privilegeSetName: "Anesthesiology - Cardiac",
    department: "Anesthesiology",
    status: "pending",
    requestDate: "2024-11-12T11:20:00Z",
    verifiableCredential: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "MedicalLicenseCredential"],
      issuer: "did:example:california-medical-board",
      issuanceDate: "2023-01-15T00:00:00Z",
      credentialSubject: {
        id: "did:example:clinician-012",
        name: "Dr. David Lee",
        npi: "4567890123",
        specialty: "Anesthesiology",
      },
    },
    passReasons: [],
    failReasons: [],
  },
  {
    id: "pr-005",
    clinicianId: "cli-005",
    clinicianName: "Dr. Lisa Anderson",
    clinicianNPI: "5678901234",
    privilegeSetId: "ps-001",
    privilegeSetName: "Cardiology - Interventional",
    department: "Cardiology",
    status: "denied",
    requestDate: "2024-11-01T08:00:00Z",
    reviewedDate: "2024-11-02T14:30:00Z",
    reviewerName: "Dr. James Thompson",
    reviewerId: "rev-003",
    reviewNotes: "Insufficient case volume for interventional procedures. Recommend additional training.",
    verifiableCredential: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "MedicalLicenseCredential"],
      issuer: "did:example:california-medical-board",
      issuanceDate: "2023-01-15T00:00:00Z",
      credentialSubject: {
        id: "did:example:clinician-345",
        name: "Dr. Lisa Anderson",
        npi: "5678901234",
        specialty: "Cardiology",
        yearsExperience: 3,
      },
    },
    passReasons: [
      "Board certified in Cardiology",
      "Valid license",
    ],
    failReasons: [
      "Only 3 years experience (requires 5+)",
      "Insufficient case volume for interventional procedures",
      "No fellowship in interventional cardiology",
    ],
  },
];

/**
 * GET /api/org/privilege-requests
 * List all privilege requests with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const search = searchParams.get("search");

    let filtered = [...mockRequests];

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((req) => req.status === status);
    }

    // Filter by department
    if (department) {
      filtered = filtered.filter((req) => req.department === department);
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.clinicianName.toLowerCase().includes(query) ||
          req.clinicianNPI.includes(query) ||
          req.privilegeSetName.toLowerCase().includes(query) ||
          req.department.toLowerCase().includes(query)
      );
    }

    const response: ListPrivilegeRequestsResponse = {
      success: true,
      data: filtered,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching privilege requests:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch privilege requests",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/org/privilege-requests
 * Create a new privilege request (submitted by clinician)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Implement request creation logic
    // This would typically be called by a clinician applying for privileges

    return NextResponse.json(
      {
        success: true,
        message: "Privilege request submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating privilege request:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create privilege request",
      },
      { status: 500 }
    );
  }
}

