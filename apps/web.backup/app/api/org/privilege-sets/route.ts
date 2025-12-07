import { NextRequest, NextResponse } from "next/server";
import {
  PrivilegeSet,
  CreatePrivilegeSetRequest,
  ListPrivilegeSetsResponse,
  CreatePrivilegeSetResponse,
  Procedure,
} from "@/lib/types/privileging";

// In-memory storage (replace with database in production)
let privilegeSets: PrivilegeSet[] = [
  {
    id: "ps-001",
    name: "Cardiology - Interventional",
    department: "Cardiology",
    specialty: "Interventional Cardiology",
    description: "Advanced interventional cardiology procedures",
    procedureCount: 15,
    procedures: [
      { id: "p1", name: "Coronary Angiography", code: "CPT-93454" },
      { id: "p2", name: "PCI (Percutaneous Coronary Intervention)", code: "CPT-92920" },
      { id: "p3", name: "Cardiac Catheterization", code: "CPT-93458" },
    ],
    status: "active",
    minimumCaseVolume: "50",
    yearsExperienceRequired: "5",
    boardCertificationRequired: true,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
    createdBy: "admin",
  },
  {
    id: "ps-002",
    name: "General Surgery - Advanced",
    department: "Surgery",
    specialty: "General Surgery",
    procedureCount: 22,
    procedures: [
      { id: "p4", name: "Appendectomy", code: "CPT-44970" },
      { id: "p5", name: "Cholecystectomy", code: "CPT-47562" },
    ],
    status: "active",
    createdAt: "2024-02-20T00:00:00Z",
    updatedAt: "2024-02-20T00:00:00Z",
  },
  {
    id: "ps-003",
    name: "Emergency Medicine - Level I",
    department: "Emergency Medicine",
    specialty: "Emergency Medicine",
    procedureCount: 18,
    procedures: [
      { id: "p6", name: "Central Line Insertion", code: "CPT-36556" },
      { id: "p7", name: "Endotracheal Intubation", code: "CPT-31500" },
    ],
    status: "active",
    createdAt: "2024-03-10T00:00:00Z",
    updatedAt: "2024-03-10T00:00:00Z",
  },
];

/**
 * GET /api/org/privilege-sets
 * List all privilege sets with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const search = searchParams.get("search");

    let filtered = [...privilegeSets];

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((ps) => ps.status === status);
    }

    // Filter by department
    if (department) {
      filtered = filtered.filter((ps) => ps.department === department);
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (ps) =>
          ps.name.toLowerCase().includes(query) ||
          ps.department.toLowerCase().includes(query) ||
          ps.specialty?.toLowerCase().includes(query)
      );
    }

    const response: ListPrivilegeSetsResponse = {
      success: true,
      data: filtered,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching privilege sets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch privilege sets",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/org/privilege-sets
 * Create a new privilege set
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreatePrivilegeSetRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.department || !body.procedures || body.procedures.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Generate procedures with IDs
    const procedures: Procedure[] = body.procedures.map((proc, idx) => ({
      id: `proc-${Date.now()}-${idx}`,
      name: proc.name,
      code: proc.code,
    }));

    // Create new privilege set
    const newPrivilegeSet: PrivilegeSet = {
      id: `ps-${Date.now()}`,
      name: body.name,
      department: body.department,
      specialty: body.specialty,
      description: body.description,
      procedureCount: procedures.length,
      procedures,
      status: "active",
      minimumCaseVolume: body.minimumCaseVolume,
      yearsExperienceRequired: body.yearsExperienceRequired,
      boardCertificationRequired: body.boardCertificationRequired,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "current-user", // Replace with actual user from session
    };

    // Add to storage
    privilegeSets.push(newPrivilegeSet);

    const response: CreatePrivilegeSetResponse = {
      success: true,
      data: newPrivilegeSet,
      message: "Privilege set created successfully",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating privilege set:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create privilege set",
      },
      { status: 500 }
    );
  }
}

