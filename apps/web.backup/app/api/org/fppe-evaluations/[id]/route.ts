import { NextRequest, NextResponse } from "next/server";
import {
  FppeEvaluation,
  GetFppeEvaluationResponse,
  SubmitFppeEvaluationRequest,
  ChecklistItem,
} from "@/lib/types/privileging";

const INITIAL_CHECKLIST: ChecklistItem[] = [
  {
    id: "tech-1",
    category: "Technical Competence",
    criterion: "Demonstrates appropriate technical skill for procedures",
  },
  {
    id: "tech-2",
    category: "Technical Competence",
    criterion: "Follows proper protocols and procedures",
  },
  {
    id: "tech-3",
    category: "Technical Competence",
    criterion: "Manages complications appropriately",
  },
  {
    id: "clin-1",
    category: "Clinical Judgment",
    criterion: "Makes appropriate clinical decisions",
  },
  {
    id: "clin-2",
    category: "Clinical Judgment",
    criterion: "Recognizes limitations and seeks consultation when needed",
  },
  {
    id: "comm-1",
    category: "Communication",
    criterion: "Communicates effectively with patients and families",
  },
  {
    id: "comm-2",
    category: "Communication",
    criterion: "Collaborates effectively with healthcare team",
  },
  {
    id: "prof-1",
    category: "Professionalism",
    criterion: "Maintains professional conduct and ethics",
  },
  {
    id: "prof-2",
    category: "Professionalism",
    criterion: "Documents care appropriately and timely",
  },
  {
    id: "safe-1",
    category: "Patient Safety",
    criterion: "Follows safety protocols and infection control",
  },
];

// Mock data
const mockEvaluations: Record<string, FppeEvaluation> = {
  "oppe-001": {
    id: "fppe-001",
    recordId: "oppe-001",
    clinicianId: "cli-001",
    clinicianName: "Dr. Sarah Johnson",
    clinicianNPI: "1234567890",
    department: "Cardiology",
    privilegeSetName: "Cardiology - Interventional",
    startDate: "2024-10-15T00:00:00Z",
    dueDate: "2024-11-15T00:00:00Z",
    status: "in_progress",
    checklistItems: INITIAL_CHECKLIST,
  },
};

/**
 * GET /api/org/fppe-evaluations/[id]
 * Get a specific FPPE evaluation by OPPE record ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Find evaluation by record ID
    const evaluation = mockEvaluations[id];

    if (!evaluation) {
      return NextResponse.json(
        {
          success: false,
          error: "FPPE evaluation not found",
        },
        { status: 404 }
      );
    }

    const response: GetFppeEvaluationResponse = {
      success: true,
      data: evaluation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching FPPE evaluation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch FPPE evaluation",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/fppe-evaluations/[id]
 * Update/submit a FPPE evaluation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body: SubmitFppeEvaluationRequest = await request.json();

    // Validate required fields
    if (!body.checklistItems || !body.overallRecommendation || !body.summaryComments) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // TODO: Implement actual database update
    // 1. Update evaluation with checklist results
    // 2. Set status to "completed"
    // 3. Update OPPE record status
    // 4. Trigger privilege grant/deny based on recommendation
    // 5. Send notifications

    console.log(`Submitting FPPE evaluation for record ${id}`, body);

    return NextResponse.json({
      success: true,
      message: "FPPE evaluation submitted successfully",
      data: {
        id,
        status: "completed",
        completedDate: new Date().toISOString(),
        ...body,
      },
    });
  } catch (error) {
    console.error("Error submitting FPPE evaluation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to submit FPPE evaluation",
      },
      { status: 500 }
    );
  }
}

