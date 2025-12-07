"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TimelineEvent {
  id: string;
  type: "FPPE" | "OPPE" | "PRIVILEGE_GRANT" | "RENEWAL" | "INCIDENT";
  title: string;
  date: string;
  status: "completed" | "in_progress" | "scheduled" | "overdue";
  description: string;
  reviewer?: string;
  outcome?: "pass" | "fail" | "conditional";
  details?: string;
}

interface UpcomingReview {
  type: "FPPE" | "OPPE";
  privilegeSetName: string;
  dueDate: string;
  daysUntil: number;
  assignedReviewer?: string;
}

interface ClinicianProfile {
  id: string;
  name: string;
  npi: string;
  department: string;
  specialties: string[];
  activePrivileges: number;
  joinDate: string;
  timeline: TimelineEvent[];
  upcomingReviews: UpcomingReview[];
  complianceStatus: "current" | "needs_attention" | "overdue";
}

export default function ClinicianOppePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clinician, setClinician] = useState<ClinicianProfile | null>(null);

  useEffect(() => {
    const loadClinicianData = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/org/oppe/clinicians/${params.id}`);
        // const data = await response.json();

        // Mock data
        const mockData: ClinicianProfile = {
          id: params.id as string,
          name: "Dr. Sarah Johnson",
          npi: "1234567890",
          department: "Cardiology",
          specialties: ["Interventional Cardiology", "General Cardiology"],
          activePrivileges: 3,
          joinDate: "2022-11-10",
          complianceStatus: "needs_attention",
          timeline: [
            {
              id: "evt-001",
              type: "PRIVILEGE_GRANT",
              title: "Cardiology - Interventional Privileges Granted",
              date: "2022-11-10",
              status: "completed",
              description: "Initial privilege grant approved",
              reviewer: "Dr. Emily Davis",
              outcome: "pass",
            },
            {
              id: "evt-002",
              type: "FPPE",
              title: "FPPE - Interventional Cardiology (Initial)",
              date: "2023-01-15",
              status: "completed",
              description: "Focused evaluation of 10 cases completed",
              reviewer: "Dr. Robert Wilson",
              outcome: "pass",
              details: "All criteria met. Excellent technical skills.",
            },
            {
              id: "evt-003",
              type: "OPPE",
              title: "OPPE - Q1 2023",
              date: "2023-04-01",
              status: "completed",
              description: "Quarterly ongoing evaluation",
              reviewer: "Dr. Emily Davis",
              outcome: "pass",
            },
            {
              id: "evt-004",
              type: "OPPE",
              title: "OPPE - Q2 2023",
              date: "2023-07-01",
              status: "completed",
              description: "Quarterly ongoing evaluation",
              reviewer: "Dr. Emily Davis",
              outcome: "pass",
            },
            {
              id: "evt-005",
              type: "OPPE",
              title: "OPPE - Q3 2023",
              date: "2023-10-01",
              status: "completed",
              description: "Quarterly ongoing evaluation",
              reviewer: "Dr. Robert Wilson",
              outcome: "pass",
            },
            {
              id: "evt-006",
              type: "INCIDENT",
              title: "Peer Review - Case Discussion",
              date: "2023-12-15",
              status: "completed",
              description: "Routine peer review of complex case",
              reviewer: "Peer Review Committee",
              details: "No concerns identified. Educational discussion.",
            },
            {
              id: "evt-007",
              type: "OPPE",
              title: "OPPE - Q4 2023",
              date: "2024-01-15",
              status: "completed",
              description: "Quarterly ongoing evaluation",
              reviewer: "Dr. Emily Davis",
              outcome: "pass",
            },
            {
              id: "evt-008",
              type: "PRIVILEGE_GRANT",
              title: "Echocardiography Privileges Added",
              date: "2024-03-20",
              status: "completed",
              description: "Additional privileges granted",
              reviewer: "Dr. James Thompson",
              outcome: "pass",
            },
            {
              id: "evt-009",
              type: "FPPE",
              title: "FPPE - Echocardiography (Initial)",
              date: "2024-05-10",
              status: "completed",
              description: "Focused evaluation for new privilege",
              reviewer: "Dr. Robert Wilson",
              outcome: "pass",
            },
            {
              id: "evt-010",
              type: "OPPE",
              title: "OPPE - Q2 2024",
              date: "2024-07-15",
              status: "completed",
              description: "Quarterly ongoing evaluation",
              reviewer: "Dr. Emily Davis",
              outcome: "pass",
            },
            {
              id: "evt-011",
              type: "OPPE",
              title: "OPPE - Q3 2024",
              date: "2024-10-15",
              status: "overdue",
              description: "Quarterly ongoing evaluation - OVERDUE",
              reviewer: "Dr. Emily Davis",
            },
            {
              id: "evt-012",
              type: "RENEWAL",
              title: "Privilege Renewal Due",
              date: "2024-11-25",
              status: "scheduled",
              description: "Annual privilege renewal required",
            },
            {
              id: "evt-013",
              type: "OPPE",
              title: "OPPE - Q4 2024",
              date: "2025-01-15",
              status: "scheduled",
              description: "Quarterly ongoing evaluation",
              reviewer: "Dr. Emily Davis",
            },
          ],
          upcomingReviews: [
            {
              type: "OPPE",
              privilegeSetName: "Cardiology - Interventional",
              dueDate: "2024-10-15",
              daysUntil: -29,
              assignedReviewer: "Dr. Emily Davis",
            },
            {
              type: "OPPE",
              privilegeSetName: "Echocardiography",
              dueDate: "2025-01-15",
              daysUntil: 63,
              assignedReviewer: "Dr. Emily Davis",
            },
          ],
        };

        setClinician(mockData);
      } catch (error) {
        console.error("Failed to load clinician data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadClinicianData();
  }, [params.id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "overdue":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "scheduled":
        return <Calendar className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "FPPE":
        return "bg-blue-500";
      case "OPPE":
        return "bg-green-500";
      case "PRIVILEGE_GRANT":
        return "bg-purple-500";
      case "RENEWAL":
        return "bg-orange-500";
      case "INCIDENT":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return null;

    switch (outcome) {
      case "pass":
        return <Badge variant="default" className="ml-2">Pass</Badge>;
      case "fail":
        return <Badge variant="destructive" className="ml-2">Fail</Badge>;
      case "conditional":
        return <Badge variant="secondary" className="ml-2">Conditional</Badge>;
      default:
        return null;
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

  if (!clinician) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>
            The requested clinician profile could not be found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const overdueReviews = clinician.upcomingReviews.filter((r) => r.daysUntil < 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to OPPE Dashboard
        </Button>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          FPPE/OPPE Timeline
        </h1>
        <p className="text-muted-foreground">
          Professional practice evaluation history and upcoming reviews
        </p>
      </div>

      {/* Alert for overdue */}
      {overdueReviews.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Evaluations</AlertTitle>
          <AlertDescription>
            This clinician has {overdueReviews.length} overdue evaluation
            {overdueReviews.length !== 1 ? "s" : ""} requiring immediate attention.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Clinician Info & Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Clinician Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Clinician Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold text-lg">{clinician.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NPI</p>
                <p className="font-mono text-sm">{clinician.npi}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <Badge variant="outline">{clinician.department}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Specialties</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {clinician.specialties.map((specialty, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Join Date</p>
                <p className="text-sm">
                  {new Date(clinician.joinDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Privileges</p>
                <p className="text-2xl font-bold">{clinician.activePrivileges}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Compliance Status</p>
                <Badge
                  variant={
                    clinician.complianceStatus === "current"
                      ? "default"
                      : clinician.complianceStatus === "needs_attention"
                      ? "secondary"
                      : "destructive"
                  }
                  className="mt-1"
                >
                  {clinician.complianceStatus === "current" && "Current"}
                  {clinician.complianceStatus === "needs_attention" && "Needs Attention"}
                  {clinician.complianceStatus === "overdue" && "Overdue"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Reviews
              </CardTitle>
              <CardDescription>
                {clinician.upcomingReviews.length} scheduled evaluation
                {clinician.upcomingReviews.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {clinician.upcomingReviews.map((review, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border-2 ${
                    review.daysUntil < 0
                      ? "border-destructive bg-destructive/5"
                      : review.daysUntil <= 30
                      ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant={review.type === "FPPE" ? "default" : "secondary"}>
                      {review.type}
                    </Badge>
                    {review.daysUntil < 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {Math.abs(review.daysUntil)} days overdue
                      </Badge>
                    ) : review.daysUntil <= 30 ? (
                      <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600">
                        <Clock className="h-3 w-3" />
                        {review.daysUntil} days
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        in {review.daysUntil} days
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-sm">{review.privilegeSetName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(review.dueDate).toLocaleDateString()}
                  </p>
                  {review.assignedReviewer && (
                    <p className="text-xs text-muted-foreground">
                      Reviewer: {review.assignedReviewer}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full gap-2" onClick={() => router.push("/org/oppe")}>
                <Calendar className="h-4 w-4" />
                Schedule Evaluation
              </Button>
              <Button variant="outline" className="w-full gap-2">
                <FileText className="h-4 w-4" />
                View Reports
              </Button>
              <Button variant="outline" className="w-full gap-2">
                <TrendingUp className="h-4 w-4" />
                Performance Metrics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Professional Practice Timeline
              </CardTitle>
              <CardDescription>
                Complete history of evaluations and privilege events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-border" />

                {/* Timeline items */}
                <div className="space-y-6">
                  {clinician.timeline
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((event, idx) => (
                      <div key={event.id} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div className="relative flex items-center justify-center">
                          <div
                            className={`w-14 h-14 rounded-full ${getTypeColor(
                              event.type
                            )} flex items-center justify-center z-10 border-4 border-background`}
                          >
                            {getStatusIcon(event.status)}
                          </div>
                        </div>

                        {/* Event content */}
                        <div className="flex-1 pb-6">
                          <div
                            className={`p-4 rounded-lg border-2 ${
                              event.status === "overdue"
                                ? "border-destructive bg-destructive/5"
                                : event.status === "scheduled"
                                ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <Badge variant="outline" className="mb-2">
                                  {event.type}
                                </Badge>
                                <h3 className="font-semibold flex items-center">
                                  {event.title}
                                  {getOutcomeBadge(event.outcome)}
                                </h3>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {new Date(event.date).toLocaleDateString()}
                                </p>
                                <Badge
                                  variant={
                                    event.status === "completed"
                                      ? "default"
                                      : event.status === "overdue"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="mt-1"
                                >
                                  {event.status.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-2">
                              {event.description}
                            </p>

                            {event.details && (
                              <p className="text-sm bg-muted p-2 rounded mt-2">
                                {event.details}
                              </p>
                            )}

                            {event.reviewer && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Reviewer: {event.reviewer}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

