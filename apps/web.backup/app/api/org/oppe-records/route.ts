import { NextRequest, NextResponse } from "next/server";
import {
  OppeRecord,
  ListOppeRecordsResponse,
} from "@/lib/types/privileging";

// Mock data storage
const mockRecords: OppeRecord[] = [
  {
    id: "oppe-001",
    clinicianId: "cli-001",
    clinicianName: "Dr. Sarah Johnson",
    clinicianNPI: "1234567890",
    department: "Cardiology",
    evaluationType: "FPPE",
    privilegeId: "priv-001",
    privilegeSetName: "Cardiology - Interventional",
    startDate: "2024-10-15T00:00:00Z",
    dueDate: "2024-11-15T00:00:00Z",
    status: "overdue",
    assignedReviewerId: "rev-001",
    assignedReviewer: "Dr. Emily Davis",
  },
  {
    id: "oppe-002",
    clinicianId: "cli-002",
    clinicianName: "Dr. Michael Chen",
    clinicianNPI: "2345678901",
    department: "Surgery",
    evaluationType: "OPPE",
    privilegeId: "priv-002",
    privilegeSetName: "General Surgery - Advanced",
    startDate: "2024-06-01T00:00:00Z",
    dueDate: "2024-12-01T00:00:00Z",
    lastEvaluationDate: "2024-06-01T00:00:00Z",
    status: "due_soon",
    assignedReviewerId: "rev-002",
    assignedReviewer: "Dr. Robert Wilson",
  },
  {
    id: "oppe-003",
    clinicianId: "cli-003",
    clinicianName: "Dr. Jennifer Martinez",
    clinicianNPI: "3456789012",
    department: "Emergency Medicine",
    evaluationType: "OPPE",
    privilegeId: "priv-003",
    privilegeSetName: "Emergency Medicine - Level I",
    startDate: "2024-07-15T00:00:00Z",
    dueDate: "2025-01-15T00:00:00Z",
    lastEvaluationDate: "2024-07-15T00:00:00Z",
    status: "upcoming",
  },
  {
    id: "oppe-004",
    clinicianId: "cli-004",
    clinicianName: "Dr. David Lee",
    clinicianNPI: "4567890123",
    department: "Anesthesiology",
    evaluationType: "FPPE",
    privilegeId: "priv-004",
    privilegeSetName: "Anesthesiology - Cardiac",
    startDate: "2024-10-20T00:00:00Z",
    dueDate: "2024-11-20T00:00:00Z",
    status: "due_soon",
  },
  {
    id: "oppe-005",
    clinicianId: "cli-005",
    clinicianName: "Dr. Lisa Anderson",
    clinicianNPI: "5678901234",
    department: "Radiology",
    evaluationType: "OPPE",
    privilegeId: "priv-005",
    privilegeSetName: "Interventional Radiology",
    startDate: "2024-04-01T00:00:00Z",
    dueDate: "2024-10-01T00:00:00Z",
    completedDate: "2024-09-28T00:00:00Z",
    lastEvaluationDate: "2024-04-01T00:00:00Z",
    status: "completed",
    assignedReviewerId: "rev-003",
    assignedReviewer: "Dr. James Thompson",
  },
];

/**
 * GET /api/org/oppe-records
 * List all FPPE/OPPE evaluation records with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const search = searchParams.get("search");

    let filtered = [...mockRecords];

    // Filter by evaluation type
    if (type && (type === "FPPE" || type === "OPPE")) {
      filtered = filtered.filter((rec) => rec.evaluationType === type);
    }

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((rec) => rec.status === status);
    }

    // Filter by department
    if (department) {
      filtered = filtered.filter((rec) => rec.department === department);
    }

    // Search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (rec) =>
          rec.clinicianName.toLowerCase().includes(query) ||
          rec.clinicianNPI.includes(query) ||
          rec.department.toLowerCase().includes(query) ||
          rec.privilegeSetName.toLowerCase().includes(query)
      );
    }

    const response: ListOppeRecordsResponse = {
      success: true,
      data: filtered,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching OPPE records:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch OPPE records",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/org/oppe-records
 * Create a new OPPE record (usually triggered by granting privileges)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO: Implement record creation logic
    // This would typically be triggered automatically when privileges are granted

    return NextResponse.json(
      {
        success: true,
        message: "OPPE record created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating OPPE record:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create OPPE record",
      },
      { status: 500 }
    );
  }
}

