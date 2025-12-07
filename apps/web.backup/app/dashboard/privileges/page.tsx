"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Stethoscope,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Plus,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface ClinicianPrivilege {
  id: string;
  privilegeSetName: string;
  department: string;
  specialty: string;
  status: "active" | "pending" | "expired" | "suspended" | "hold";
  grantedDate: string;
  renewalDue: string;
  isOverdue: boolean;
  daysUntilRenewal: number;
  procedures: string[];
  restrictions?: string[];
  fppeStatus?: "required" | "in_progress" | "completed" | "not_required";
  oppeStatus?: "current" | "due_soon" | "overdue" | "not_applicable";
  oppeDueDate?: string;
}

const STATUS_CONFIG = {
  active: {
    icon: CheckCircle,
    label: "Active",
    variant: "default" as const,
    color: "text-green-600",
  },
  pending: {
    icon: Clock,
    label: "Pending Review",
    variant: "secondary" as const,
    color: "text-yellow-600",
  },
  expired: {
    icon: XCircle,
    label: "Expired",
    variant: "destructive" as const,
    color: "text-red-600",
  },
  suspended: {
    icon: AlertTriangle,
    label: "Suspended",
    variant: "destructive" as const,
    color: "text-orange-600",
  },
  hold: {
    icon: AlertTriangle,
    label: "On Hold",
    variant: "outline" as const,
    color: "text-gray-600",
  },
};

export default function MyPrivilegesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [privileges, setPrivileges] = useState<ClinicianPrivilege[]>([]);

  useEffect(() => {
    const loadPrivileges = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch("/api/dashboard/privileges");
        // const data = await response.json();

        // Mock data
        const today = new Date();
        const mockData: ClinicianPrivilege[] = [
          {
            id: "priv-001",
            privilegeSetName: "Cardiology - Interventional",
            department: "Cardiology",
            specialty: "Interventional Cardiology",
            status: "active",
            grantedDate: "2022-11-10",
            renewalDue: "2024-11-25",
            isOverdue: false,
            daysUntilRenewal: 12,
            procedures: [
              "Cardiac Catheterization",
              "PCI (Percutaneous Coronary Intervention)",
              "Coronary Angiography",
              "Stent Placement",
            ],
            fppeStatus: "completed",
            oppeStatus: "current",
            oppeDueDate: "2025-05-10",
          },
          {
            id: "priv-002",
            privilegeSetName: "General Internal Medicine",
            department: "Internal Medicine",
            specialty: "Internal Medicine",
            status: "active",
            grantedDate: "2020-01-15",
            renewalDue: "2024-01-15",
            isOverdue: true,
            daysUntilRenewal: -307,
            procedures: [
              "Patient Admissions",
              "Discharge Planning",
              "Consultation Services",
              "Code Blue Response",
            ],
            fppeStatus: "not_required",
            oppeStatus: "overdue",
            oppeDueDate: "2024-07-15",
          },
          {
            id: "priv-003",
            privilegeSetName: "Echocardiography",
            department: "Cardiology",
            specialty: "Cardiology",
            status: "active",
            grantedDate: "2023-03-20",
            renewalDue: "2025-03-20",
            isOverdue: false,
            daysUntilRenewal: 127,
            procedures: [
              "Transthoracic Echocardiography",
              "Transesophageal Echocardiography",
              "Stress Echocardiography",
            ],
            fppeStatus: "completed",
            oppeStatus: "current",
            oppeDueDate: "2025-09-20",
          },
          {
            id: "priv-004",
            privilegeSetName: "Critical Care",
            department: "Critical Care",
            specialty: "Critical Care Medicine",
            status: "pending",
            grantedDate: "2024-11-01",
            renewalDue: "2026-11-01",
            isOverdue: false,
            daysUntilRenewal: 719,
            procedures: [
              "ICU Admissions",
              "Central Line Placement",
              "Ventilator Management",
              "Arterial Line Placement",
            ],
            fppeStatus: "in_progress",
            oppeStatus: "not_applicable",
          },
        ];

        setPrivileges(mockData);
      } catch (error) {
        console.error("Failed to load privileges:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPrivileges();
  }, []);

  const handlePrivilegeClick = (id: string) => {
    router.push(`/dashboard/privileges/${id}`);
  };

  const handleRequestTemporary = () => {
    router.push("/dashboard/privileges/temp/new");
  };

  const overduePrivileges = privileges.filter((p) => p.isOverdue);
  const expiringPrivileges = privileges.filter(
    (p) => !p.isOverdue && p.daysUntilRenewal <= 30 && p.daysUntilRenewal > 0
  );

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

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            My Privileges
          </h1>
          <p className="text-muted-foreground">
            View and manage your clinical privileges
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRequestTemporary}>
            <Plus className="h-4 w-4 mr-2" />
            Request Temporary Privilege
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/privileges/print/all")}>
            <FileText className="h-4 w-4 mr-2" />
            Print Summary
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {overduePrivileges.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            You have {overduePrivileges.length} overdue privilege
            {overduePrivileges.length !== 1 ? "s" : ""} requiring renewal.
            Please submit updated credentials for review.
          </AlertDescription>
        </Alert>
      )}

      {expiringPrivileges.length > 0 && overduePrivileges.length === 0 && (
        <Alert className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950">
          <Clock className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-900 dark:text-orange-100">
            Renewals Due Soon
          </AlertTitle>
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            You have {expiringPrivileges.length} privilege
            {expiringPrivileges.length !== 1 ? "s" : ""} expiring within 30
            days. Plan ahead to maintain continuous privileges.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Privileges</CardDescription>
            <CardTitle className="text-3xl">{privileges.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {privileges.filter((p) => p.status === "active").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardDescription className="text-orange-600">
              Expiring Soon
            </CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {expiringPrivileges.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardDescription className="text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {overduePrivileges.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Privilege List */}
      <div className="space-y-4">
        {privileges.map((privilege) => {
          const statusConfig = STATUS_CONFIG[privilege.status];
          const StatusIcon = statusConfig.icon;

          return (
            <Card
              key={privilege.id}
              className={`transition-all hover:shadow-md cursor-pointer ${
                privilege.isOverdue
                  ? "border-destructive bg-destructive/5"
                  : privilege.daysUntilRenewal <= 30 &&
                    privilege.daysUntilRenewal > 0
                  ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20"
                  : ""
              }`}
              onClick={() => handlePrivilegeClick(privilege.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePrivilegeClick(privilege.id);
                }
              }}
              aria-label={`View details for ${privilege.privilegeSetName}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-xl">
                        {privilege.privilegeSetName}
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{privilege.department}</Badge>
                      <Badge variant="secondary">{privilege.specialty}</Badge>
                      <Badge variant={statusConfig.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {privilege.isOverdue && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Renewal Overdue
                      </Badge>
                    )}
                    {!privilege.isOverdue &&
                      privilege.daysUntilRenewal <= 30 &&
                      privilege.daysUntilRenewal > 0 && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-orange-300 text-orange-600"
                        >
                          <Clock className="h-3 w-3" />
                          Expires in {privilege.daysUntilRenewal} days
                        </Badge>
                      )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Procedures */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Authorized Procedures ({privilege.procedures.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {privilege.procedures.slice(0, 4).map((procedure, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {procedure}
                      </Badge>
                    ))}
                    {privilege.procedures.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{privilege.procedures.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Dates and Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Granted
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(privilege.grantedDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Renewal Due
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        privilege.isOverdue
                          ? "text-destructive"
                          : privilege.daysUntilRenewal <= 30
                          ? "text-orange-600"
                          : ""
                      }`}
                    >
                      {new Date(privilege.renewalDue).toLocaleDateString()}
                      {privilege.isOverdue && (
                        <span className="text-xs ml-2">
                          ({Math.abs(privilege.daysUntilRenewal)} days overdue)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Evaluation Status
                    </p>
                    <div className="flex gap-2">
                      {privilege.fppeStatus && privilege.fppeStatus !== "not_required" && (
                        <Badge
                          variant={
                            privilege.fppeStatus === "completed"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          FPPE:{" "}
                          {privilege.fppeStatus === "completed"
                            ? "✓"
                            : privilege.fppeStatus === "in_progress"
                            ? "In Progress"
                            : "Required"}
                        </Badge>
                      )}
                      {privilege.oppeStatus && privilege.oppeStatus !== "not_applicable" && (
                        <Badge
                          variant={
                            privilege.oppeStatus === "current"
                              ? "default"
                              : privilege.oppeStatus === "overdue"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          OPPE:{" "}
                          {privilege.oppeStatus === "current"
                            ? "Current"
                            : privilege.oppeStatus === "due_soon"
                            ? "Due Soon"
                            : "Overdue"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Restrictions */}
                {privilege.restrictions && privilege.restrictions.length > 0 && (
                  <Alert variant="default" className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-sm">Restrictions</AlertTitle>
                    <AlertDescription className="text-xs">
                      {privilege.restrictions.join(", ")}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {privileges.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Privileges</h3>
            <p className="text-muted-foreground mb-4">
              You don't have any privileges on record yet.
            </p>
            <Button onClick={() => router.push("/apply")}>
              Apply for Privileges
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

