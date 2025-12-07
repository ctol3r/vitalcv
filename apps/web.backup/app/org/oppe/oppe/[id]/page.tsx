"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, User, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface OppeEvaluation {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  privilegeSetName: string;
  evaluationPeriod: string;
  dueDate: string;
  status: "pending" | "in_progress" | "completed";
  metrics: MetricItem[];
}

interface MetricItem {
  id: string;
  category: string;
  metric: string;
  description: string;
  rating?: "excellent" | "satisfactory" | "needs_improvement" | "unsatisfactory";
  comments?: string;
}

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

export default function OppeEvaluationPage() {
  const params = useParams();
  const router = useRouter();
  const evaluationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<OppeEvaluation | null>(null);
  const [metrics, setMetrics] = useState<MetricItem[]>(OPPE_METRICS);
  const [overallAssessment, setOverallAssessment] = useState<"pass" | "fail" | "">("");
  const [summaryComments, setSummaryComments] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Simulate API call - replace with actual API
    const loadEvaluation = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/org/oppe-evaluations/${evaluationId}`);
        // const data = await response.json();

        // Mock data
        const mockEvaluation: OppeEvaluation = {
          id: evaluationId,
          clinicianName: "Dr. Michael Chen",
          clinicianNPI: "2345678901",
          department: "Surgery",
          privilegeSetName: "General Surgery - Advanced",
          evaluationPeriod: "January 2024 - June 2024",
          dueDate: "2024-12-01",
          status: "in_progress",
          metrics: OPPE_METRICS,
        };

        setEvaluation(mockEvaluation);
        setMetrics(mockEvaluation.metrics);
      } catch (error) {
        console.error("Failed to load OPPE evaluation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvaluation();
  }, [evaluationId]);

  const handleMetricChange = (
    metricId: string,
    rating: "excellent" | "satisfactory" | "needs_improvement" | "unsatisfactory"
  ) => {
    setMetrics(
      metrics.map((item) =>
        item.id === metricId ? { ...item, rating } : item
      )
    );
    // Clear error for this item
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[metricId];
      return newErrors;
    });
  };

  const handleCommentChange = (metricId: string, comments: string) => {
    setMetrics(
      metrics.map((item) =>
        item.id === metricId ? { ...item, comments } : item
      )
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Check if all metrics have ratings
    metrics.forEach((item) => {
      if (!item.rating) {
        newErrors[item.id] = "Please select a rating";
      }
      // Require comments for needs_improvement or unsatisfactory
      if (
        (item.rating === "needs_improvement" || item.rating === "unsatisfactory") &&
        !item.comments?.trim()
      ) {
        newErrors[`${item.id}-comment`] = "Comments required for this rating";
      }
    });

    // Check overall assessment
    if (!overallAssessment) {
      newErrors.assessment = "Please select an overall assessment";
    }

    // Require summary comments if assessment is fail
    if (overallAssessment === "fail" && !summaryComments.trim()) {
      newErrors.summary = "Summary comments are required when marking as FAIL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (isDraft: boolean = false) => {
    // For draft saves, don't validate
    if (!isDraft && !validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/org/oppe-evaluations/${evaluationId}`, {
      //   method: "PUT",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     metrics,
      //     overallAssessment,
      //     summaryComments,
      //     status: isDraft ? "in_progress" : "completed",
      //   }),
      // });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Saving OPPE evaluation:", {
        evaluationId,
        metrics,
        overallAssessment,
        summaryComments,
        isDraft,
      });

      if (!isDraft) {
        router.push("/org/oppe");
      }
    } catch (error) {
      console.error("Failed to save evaluation:", error);
      setErrors({ submit: "Failed to save evaluation. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false);
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

  // Group metrics by category
  const groupedMetrics = metrics.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MetricItem[]>);

  const completedCount = metrics.filter((item) => item.rating).length;
  const needsImprovementCount = metrics.filter(
    (item) => item.rating === "needs_improvement" || item.rating === "unsatisfactory"
  ).length;

  const getRatingLabel = (rating: string) => {
    return rating.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

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
          OPPE Evaluation
        </h1>
        <p className="text-muted-foreground">
          Ongoing Professional Practice Evaluation - Periodic Review
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
                {evaluation.evaluationPeriod}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Progress</Label>
              <p>
                {completedCount} / {metrics.length} metrics rated
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Progress Alert */}
        {needsImprovementCount > 0 && (
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertTitle className="text-orange-900 dark:text-orange-100">
              Areas Requiring Attention
            </AlertTitle>
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              {needsImprovementCount} metric{needsImprovementCount !== 1 ? 's' : ''} rated as needing
              improvement or unsatisfactory. Comments are required for these ratings.
            </AlertDescription>
          </Alert>
        )}

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              Rate each metric based on observed performance during the evaluation period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedMetrics).map(([category, items]) => (
              <div key={category} className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">{category}</h3>

                {items.map((item) => (
                  <div key={item.id} className="space-y-3 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label className="text-base font-medium">{item.metric}</Label>
                      <p className="text-sm text-muted-foreground">{item.description}</p>

                      <RadioGroup
                        value={item.rating || ""}
                        onValueChange={(value) =>
                          handleMetricChange(
                            item.id,
                            value as "excellent" | "satisfactory" | "needs_improvement" | "unsatisfactory"
                          )
                        }
                        className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"
                      >
                        <div className="flex items-center space-x-2 p-2 border rounded-md">
                          <RadioGroupItem value="excellent" id={`${item.id}-excellent`} />
                          <Label
                            htmlFor={`${item.id}-excellent`}
                            className="text-sm cursor-pointer text-green-700 dark:text-green-400 font-medium"
                          >
                            Excellent
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 border rounded-md">
                          <RadioGroupItem value="satisfactory" id={`${item.id}-satisfactory`} />
                          <Label
                            htmlFor={`${item.id}-satisfactory`}
                            className="text-sm cursor-pointer"
                          >
                            Satisfactory
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 border rounded-md">
                          <RadioGroupItem value="needs_improvement" id={`${item.id}-needs`} />
                          <Label
                            htmlFor={`${item.id}-needs`}
                            className="text-sm cursor-pointer text-orange-600 dark:text-orange-400"
                          >
                            Needs Improvement
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 border rounded-md">
                          <RadioGroupItem value="unsatisfactory" id={`${item.id}-unsatisfactory`} />
                          <Label
                            htmlFor={`${item.id}-unsatisfactory`}
                            className="text-sm cursor-pointer text-red-700 dark:text-red-400 font-medium"
                          >
                            Unsatisfactory
                          </Label>
                        </div>
                      </RadioGroup>

                      {errors[item.id] && (
                        <p className="text-sm text-destructive" role="alert">
                          {errors[item.id]}
                        </p>
                      )}
                    </div>

                    {/* Comments (required for needs_improvement/unsatisfactory) */}
                    {((item.rating === "needs_improvement" || item.rating === "unsatisfactory") ||
                      item.comments) && (
                      <div className="space-y-2">
                        <Label htmlFor={`${item.id}-comments`}>
                          Comments{" "}
                          {(item.rating === "needs_improvement" || item.rating === "unsatisfactory") && (
                            <span className="text-destructive">*</span>
                          )}
                        </Label>
                        <Textarea
                          id={`${item.id}-comments`}
                          placeholder="Provide specific details and examples..."
                          value={item.comments || ""}
                          onChange={(e) => handleCommentChange(item.id, e.target.value)}
                          rows={3}
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

        {/* Overall Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Assessment</CardTitle>
            <CardDescription>
              Based on your evaluation, does the clinician meet standards for continued privileges?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <RadioGroup
                value={overallAssessment}
                onValueChange={(value) => {
                  setOverallAssessment(value as typeof overallAssessment);
                  setErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.assessment;
                    return newErrors;
                  });
                }}
              >
                <div className="flex items-center space-x-2 p-4 border rounded-md">
                  <RadioGroupItem value="pass" id="assessment-pass" />
                  <Label htmlFor="assessment-pass" className="flex-1 cursor-pointer">
                    <strong className="text-green-700 dark:text-green-400">PASS</strong>
                    <p className="text-sm text-muted-foreground">
                      Clinician demonstrates satisfactory performance and meets standards
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-md">
                  <RadioGroupItem value="fail" id="assessment-fail" />
                  <Label htmlFor="assessment-fail" className="flex-1 cursor-pointer">
                    <strong className="text-red-700 dark:text-red-400">FAIL</strong>
                    <p className="text-sm text-muted-foreground">
                      Clinician does not meet required standards; action required
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {errors.assessment && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.assessment}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">
                Summary Comments{" "}
                {overallAssessment === "fail" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="summary"
                placeholder="Provide a summary of the evaluation period and any recommendations..."
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

        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSave(true)}
              disabled={submitting}
            >
              Save Draft
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Evaluation"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

