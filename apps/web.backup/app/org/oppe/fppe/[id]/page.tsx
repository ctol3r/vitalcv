"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, User, Calendar, CheckCircle, XCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface FppeEvaluation {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  privilegeSetName: string;
  startDate: string;
  dueDate: string;
  status: "pending" | "in_progress" | "completed";
  checklistItems: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  category: string;
  criterion: string;
  result?: "pass" | "fail" | "not_applicable";
  comments?: string;
}

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

export default function FppeEvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<FppeEvaluation | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [overallRecommendation, setOverallRecommendation] = useState<"approve" | "conditional" | "deny" | "">("");
  const [summaryComments, setSummaryComments] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Simulate API call - replace with actual API
    const loadEvaluation = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/org/fppe-evaluations/${evaluationId}`);
        // const data = await response.json();

        // Mock data
        const mockEvaluation: FppeEvaluation = {
          id: evaluationId,
          clinicianName: "Dr. Sarah Johnson",
          clinicianNPI: "1234567890",
          department: "Cardiology",
          privilegeSetName: "Cardiology - Interventional",
          startDate: "2024-10-15",
          dueDate: "2024-11-15",
          status: "in_progress",
          checklistItems: INITIAL_CHECKLIST,
        };

        setEvaluation(mockEvaluation);
        setChecklist(mockEvaluation.checklistItems);
      } catch (error) {
        console.error("Failed to load FPPE evaluation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvaluation();
  }, [evaluationId]);

  const handleChecklistChange = (itemId: string, result: "pass" | "fail" | "not_applicable") => {
    setChecklist(
      checklist.map((item) =>
        item.id === itemId ? { ...item, result } : item
      )
    );
    // Clear error for this item
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[itemId];
      return newErrors;
    });
  };

  const handleCommentChange = (itemId: string, comments: string) => {
    setChecklist(
      checklist.map((item) =>
        item.id === itemId ? { ...item, comments } : item
      )
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Check if all checklist items have results
    checklist.forEach((item) => {
      if (!item.result) {
        newErrors[item.id] = "Please select a result";
      }
      // Require comments for failures
      if (item.result === "fail" && !item.comments?.trim()) {
        newErrors[`${item.id}-comment`] = "Comments required for failures";
      }
    });

    // Check overall recommendation
    if (!overallRecommendation) {
      newErrors.recommendation = "Please select an overall recommendation";
    }

    // Require summary comments
    if (!summaryComments.trim()) {
      newErrors.summary = "Summary comments are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/org/fppe-evaluations/${evaluationId}`, {
      //   method: "PUT",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     checklist,
      //     overallRecommendation,
      //     summaryComments,
      //   }),
      // });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Submitting FPPE evaluation:", {
        evaluationId,
        checklist,
        overallRecommendation,
        summaryComments,
      });

      router.push("/org/oppe");
    } catch (error) {
      console.error("Failed to submit evaluation:", error);
      setErrors({ submit: "Failed to submit evaluation. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-96 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Evaluation not found</h3>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group checklist by category
  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const passCount = checklist.filter((item) => item.result === "pass").length;
  const failCount = checklist.filter((item) => item.result === "fail").length;
  const completedCount = checklist.filter((item) => item.result).length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back to OPPE dashboard"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          FPPE Evaluation
        </h1>
        <p className="text-muted-foreground">
          Focused Professional Practice Evaluation - Initial Credentialing
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Clinician Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Clinician Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">{evaluation.clinicianName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">NPI</Label>
              <p className="font-mono text-sm">{evaluation.clinicianNPI}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Department</Label>
              <p>{evaluation.department}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Privilege Set</Label>
              <p className="font-medium">{evaluation.privilegeSetName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Evaluation Period</Label>
              <p className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {new Date(evaluation.startDate).toLocaleDateString()} -{" "}
                {new Date(evaluation.dueDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Progress</Label>
              <p>
                {completedCount} / {checklist.length} items completed
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Progress Alert */}
        {completedCount > 0 && completedCount < checklist.length && (
          <Alert>
            <AlertDescription>
              You have completed {completedCount} of {checklist.length} evaluation criteria.
              {failCount > 0 && (
                <span className="text-destructive font-medium ml-1">
                  ({failCount} failure{failCount !== 1 ? 's' : ''} noted)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Evaluation Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Criteria</CardTitle>
            <CardDescription>
              Assess each criterion based on observed performance during the FPPE period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedChecklist).map(([category, items]) => (
              <div key={category} className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{category}</h3>

                {items.map((item) => (
                  <div key={item.id} className="space-y-3 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label className="text-base">{item.criterion}</Label>

                      <RadioGroup
                        value={item.result || ""}
                        onValueChange={(value) =>
                          handleChecklistChange(item.id, value as "pass" | "fail" | "not_applicable")
                        }
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pass" id={`${item.id}-pass`} />
                          <Label
                            htmlFor={`${item.id}-pass`}
                            className="flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Pass
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fail" id={`${item.id}-fail`} />
                          <Label
                            htmlFor={`${item.id}-fail`}
                            className="flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                            Fail
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="not_applicable" id={`${item.id}-na`} />
                          <Label htmlFor={`${item.id}-na`} className="cursor-pointer">
                            N/A
                          </Label>
                        </div>
                      </RadioGroup>

                      {errors[item.id] && (
                        <p className="text-sm text-destructive" role="alert">
                          {errors[item.id]}
                        </p>
                      )}
                    </div>

                    {/* Comments (required for failures) */}
                    {(item.result === "fail" || item.comments) && (
                      <div className="space-y-2">
                        <Label htmlFor={`${item.id}-comments`}>
                          Comments {item.result === "fail" && <span className="text-destructive">*</span>}
                        </Label>
                        <Textarea
                          id={`${item.id}-comments`}
                          placeholder="Provide specific details..."
                          value={item.comments || ""}
                          onChange={(e) => handleCommentChange(item.id, e.target.value)}
                          rows={2}
                        />
                        {errors[`${item.id}-comment`] && (
                          <p className="text-sm text-destructive" role="alert">
                            {errors[`${item.id}-comment`]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Overall Recommendation */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Recommendation</CardTitle>
            <CardDescription>
              Based on your evaluation, what is your recommendation?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <RadioGroup
                value={overallRecommendation}
                onValueChange={(value) => {
                  setOverallRecommendation(value as typeof overallRecommendation);
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.recommendation;
                    return newErrors;
                  });
                }}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <RadioGroupItem value="approve" id="rec-approve" />
                  <Label htmlFor="rec-approve" className="flex-1 cursor-pointer">
                    <strong>Approve Full Privileges</strong>
                    <p className="text-sm text-muted-foreground">
                      Clinician demonstrates competence in all areas
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <RadioGroupItem value="conditional" id="rec-conditional" />
                  <Label htmlFor="rec-conditional" className="flex-1 cursor-pointer">
                    <strong>Approve with Conditions</strong>
                    <p className="text-sm text-muted-foreground">
                      Grant privileges with specific limitations or monitoring
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-md">
                  <RadioGroupItem value="deny" id="rec-deny" />
                  <Label htmlFor="rec-deny" className="flex-1 cursor-pointer">
                    <strong>Deny Privileges</strong>
                    <p className="text-sm text-muted-foreground">
                      Clinician does not meet required standards
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {errors.recommendation && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.recommendation}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">
                Summary Comments <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="summary"
                placeholder="Provide a summary of your evaluation and recommendation..."
                value={summaryComments}
                onChange={(e) => {
                  setSummaryComments(e.target.value);
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.summary;
                    return newErrors;
                  });
                }}
                rows={5}
              />
              {errors.summary && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.summary}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        {errors.submit && (
          <Alert variant="destructive">
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Evaluation"}
          </Button>
        </div>
      </form>
    </div>
  );
}

