import { NextRequest, NextResponse } from "next/server";
import {
  OppeEvaluation,
  GetOppeEvaluationResponse,
  SubmitOppeEvaluationRequest,
  MetricItem,
} from "@/lib/types/privileging";

const OPPE_METRICS: MetricItem[] = [
  {
    id: "qoc-1",
    category: "Quality of Care",
    metric: "Clinical Outcomes",
    description: "Patient outcomes and complication rates within acceptable range",
  },
  {
    id: "qoc-2",
    category: "Quality of Care",
    metric: "Evidence-Based Practice",
    description: "Adherence to clinical guidelines and best practices",
  },
  {
    id: "qoc-3",
    category: "Quality of Care",
    metric: "Diagnostic Accuracy",
    description: "Appropriate diagnosis and treatment planning",
  },
  {
    id: "pat-1",
    category: "Patient Safety",
    metric: "Adverse Events",
    description: "Minimal adverse events and appropriate management when they occur",
  },
  {
    id: "pat-2",
    category: "Patient Safety",
    metric: "Safety Protocols",
    description: "Consistent adherence to safety protocols and infection control",
  },
  {
    id: "comm-1",
    category: "Communication",
    metric: "Documentation Quality",
    description: "Complete, accurate, and timely medical documentation",
  },
  {
    id: "comm-2",
    category: "Communication",
    metric: "Team Collaboration",
    description: "Effective communication with healthcare team members",
  },
  {
    id: "prof-1",
    category: "Professionalism",
    metric: "Professional Conduct",
    description: "Maintains professional behavior and ethical standards",
  },
  {
    id: "prof-2",
    category: "Professionalism",
    metric: "Response to Feedback",
    description: "Receptive to feedback and demonstrates continuous improvement",
  },
  {
    id: "eff-1",
    category: "Efficiency",
    metric: "Resource Utilization",
    description: "Appropriate use of resources and cost-effective care",
  },
];

// Mock data
const mockEvaluations: Record<string, OppeEvaluation> = {
  "oppe-002": {
    id: "oppe-eval-002",
    recordId: "oppe-002",
    clinicianId: "cli-002",
    clinicianName: "Dr. Michael Chen",
    clinicianNPI: "2345678901",
    department: "Surgery",
    privilegeSetName: "General Surgery - Advanced",
    evaluationPeriod: "January 2024 - June 2024",
    startDate: "2024-06-01T00:00:00Z",
    dueDate: "2024-12-01T00:00:00Z",
    status: "in_progress",
    metrics: OPPE_METRICS,
  },
};

/**
 * GET /api/org/oppe-evaluations/[id]
 * Get a specific OPPE evaluation by OPPE record ID
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
          error: "OPPE evaluation not found",
        },
        { status: 404 }
      );
    }

    const response: GetOppeEvaluationResponse = {
      success: true,
      data: evaluation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching OPPE evaluation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch OPPE evaluation",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/org/oppe-evaluations/[id]
 * Update/submit an OPPE evaluation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body: SubmitOppeEvaluationRequest = await request.json();

    // Validate required fields for completed status
    if (body.status === "completed") {
      if (!body.metrics || !body.overallAssessment) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required fields for submission",
          },
          { status: 400 }
        );
      }

      if (body.overallAssessment === "fail" && !body.summaryComments?.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Summary comments required when assessment is FAIL",
          },
          { status: 400 }
        );
      }
    }

    // TODO: Implement actual database update
    // 1. Update evaluation with metrics
    // 2. Set status (in_progress or completed)
    // 3. Update OPPE record
    // 4. If FAIL, trigger review process
    // 5. Send notifications

    console.log(`Updating OPPE evaluation for record ${id}`, body);

    return NextResponse.json({
      success: true,
      message: body.status === "completed"
        ? "OPPE evaluation submitted successfully"
        : "OPPE evaluation draft saved",
      data: {
        id,
        status: body.status || "completed",
        completedDate: body.status === "completed" ? new Date().toISOString() : undefined,
        ...body,
      },
    });
  } catch (error) {
    console.error("Error updating OPPE evaluation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update OPPE evaluation",
      },
      { status: 500 }
    );
  }
}

