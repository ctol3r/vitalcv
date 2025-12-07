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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  ArrowLeft,
  User,
  AlertTriangle,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface EvidenceItem {
  type: string;
  value: string;
  verified: boolean;
  verifiedDate?: string;
}

interface PrivilegeSnapshot {
  timestamp: string;
  evidence: EvidenceItem[];
  credentials: {
    type: string;
    issuer: string;
    issuedDate: string;
    expiryDate?: string;
  }[];
  certifications: string[];
  caseVolume?: number;
  complicationsRate?: number;
}

interface RenewalDetails {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetName: string;
  department: string;
  originalApprovalDate: string;
  renewalDue: string;
  status: "pending" | "overdue" | "under_review" | "renewed";
  daysOverdue?: number;
  previousSnapshot: PrivilegeSnapshot;
  currentSnapshot: PrivilegeSnapshot;
}

export default function RenewalReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [renewal, setRenewal] = useState<RenewalDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadRenewalDetails = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/org/privilege-renewals/${params.id}`);
        // const data = await response.json();

        // Mock data
        const mockData: RenewalDetails = {
          id: params.id as string,
          clinicianName: "Dr. Sarah Johnson",
          clinicianNPI: "1234567890",
          privilegeSetName: "Cardiology - Interventional",
          department: "Cardiology",
          originalApprovalDate: "2022-11-10",
          renewalDue: "2024-11-10",
          status: "pending",
          previousSnapshot: {
            timestamp: "2022-11-10T14:30:00Z",
            evidence: [
              {
                type: "Board Certification",
                value: "American Board of Internal Medicine - Cardiovascular Disease",
                verified: true,
                verifiedDate: "2022-11-05",
              },
              {
                type: "State License",
                value: "CA Medical License #A123456",
                verified: true,
                verifiedDate: "2022-11-01",
              },
              {
                type: "DEA Registration",
                value: "DEA #FJ1234567",
                verified: true,
                verifiedDate: "2022-10-28",
              },
            ],
            credentials: [
              {
                type: "Medical Degree",
                issuer: "Stanford University School of Medicine",
                issuedDate: "2010-06-15",
              },
              {
                type: "Residency Completion",
                issuer: "Johns Hopkins Hospital - Internal Medicine",
                issuedDate: "2013-06-30",
              },
              {
                type: "Fellowship Completion",
                issuer: "Cleveland Clinic - Interventional Cardiology",
                issuedDate: "2016-06-30",
              },
            ],
            certifications: [
              "ACLS Certification",
              "PALS Certification",
              "Interventional Cardiology Board Certification",
            ],
            caseVolume: 120,
            complicationsRate: 2.3,
          },
          currentSnapshot: {
            timestamp: "2024-11-08T10:15:00Z",
            evidence: [
              {
                type: "Board Certification",
                value: "American Board of Internal Medicine - Cardiovascular Disease (Renewed)",
                verified: true,
                verifiedDate: "2024-11-01",
              },
              {
                type: "State License",
                value: "CA Medical License #A123456",
                verified: true,
                verifiedDate: "2024-11-01",
              },
              {
                type: "DEA Registration",
                value: "DEA #FJ1234567",
                verified: true,
                verifiedDate: "2024-10-25",
              },
              {
                type: "Malpractice Insurance",
                value: "Policy #MP-2024-789456",
                verified: true,
                verifiedDate: "2024-11-05",
              },
            ],
            credentials: [
              {
                type: "Medical Degree",
                issuer: "Stanford University School of Medicine",
                issuedDate: "2010-06-15",
              },
              {
                type: "Residency Completion",
                issuer: "Johns Hopkins Hospital - Internal Medicine",
                issuedDate: "2013-06-30",
              },
              {
                type: "Fellowship Completion",
                issuer: "Cleveland Clinic - Interventional Cardiology",
                issuedDate: "2016-06-30",
              },
              {
                type: "Advanced Fellowship",
                issuer: "Mayo Clinic - Complex Coronary Interventions",
                issuedDate: "2024-06-30",
              },
            ],
            certifications: [
              "ACLS Certification (Renewed 2024)",
              "PALS Certification (Renewed 2024)",
              "Interventional Cardiology Board Certification (Renewed)",
              "Complex PCI Certification",
            ],
            caseVolume: 185,
            complicationsRate: 1.8,
          },
        };

        setRenewal(mockData);
      } catch (error) {
        console.error("Failed to load renewal details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRenewalDetails();
  }, [params.id]);

  const handleApprove = async () => {
    if (!reviewNotes.trim()) {
      alert("Please provide review notes before approving.");
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/org/privilege-renewals/${params.id}/approve`, {
      //   method: "POST",
      //   body: JSON.stringify({ notes: reviewNotes }),
      // });

      alert("Privilege renewal approved successfully");
      router.push("/org/privileges/renewals");
    } catch (error) {
      console.error("Failed to approve renewal:", error);
      alert("Failed to approve renewal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!reviewNotes.trim()) {
      alert("Comments are required when denying a renewal.");
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/org/privilege-renewals/${params.id}/deny`, {
      //   method: "POST",
      //   body: JSON.stringify({ notes: reviewNotes }),
      // });

      alert("Privilege renewal denied");
      router.push("/org/privileges/renewals");
    } catch (error) {
      console.error("Failed to deny renewal:", error);
      alert("Failed to deny renewal. Please try again.");
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

  if (!renewal) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>
            The requested renewal could not be found.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const calculateChanges = () => {
    const prevCount = renewal.previousSnapshot.credentials.length;
    const currentCount = renewal.currentSnapshot.credentials.length;
    const newCredentials = currentCount - prevCount;

    const caseVolumeChange =
      (renewal.currentSnapshot.caseVolume || 0) -
      (renewal.previousSnapshot.caseVolume || 0);

    const complicationsChange =
      (renewal.previousSnapshot.complicationsRate || 0) -
      (renewal.currentSnapshot.complicationsRate || 0);

    return { newCredentials, caseVolumeChange, complicationsChange };
  };

  const changes = calculateChanges();

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back to renewals list"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Renewals
        </Button>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Privilege Renewal Review
        </h1>
        <p className="text-muted-foreground">
          Compare previous approval snapshot with latest evidence
        </p>
      </div>

      {/* Overdue Alert */}
      {renewal.status === "overdue" && renewal.daysOverdue && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Renewal Overdue</AlertTitle>
          <AlertDescription>
            This renewal is {renewal.daysOverdue} days overdue. Immediate action
            required.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Clinician Info & Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* Clinician Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Clinician Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{renewal.clinicianName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NPI</p>
                <p className="font-mono text-sm">{renewal.clinicianNPI}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Privilege Set</p>
                <p className="font-medium">{renewal.privilegeSetName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <Badge variant="outline">{renewal.department}</Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">
                  Original Approval
                </p>
                <p className="text-sm flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {new Date(renewal.originalApprovalDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Renewal Due</p>
                <p
                  className={`text-sm flex items-center gap-2 ${
                    renewal.status === "overdue" ? "text-destructive font-medium" : ""
                  }`}
                >
                  <Calendar className="h-3 w-3" />
                  {new Date(renewal.renewalDue).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Change Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Change Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {changes.newCredentials > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    New Credentials
                  </span>
                  <Badge variant="default" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    +{changes.newCredentials}
                  </Badge>
                </div>
              )}
              {changes.caseVolumeChange !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Case Volume
                  </span>
                  <Badge
                    variant={changes.caseVolumeChange > 0 ? "default" : "secondary"}
                    className="gap-1"
                  >
                    {changes.caseVolumeChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {changes.caseVolumeChange > 0 ? "+" : ""}
                    {changes.caseVolumeChange}
                  </Badge>
                </div>
              )}
              {changes.complicationsChange !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Complications Rate
                  </span>
                  <Badge
                    variant={
                      changes.complicationsChange > 0 ? "default" : "destructive"
                    }
                    className="gap-1"
                  >
                    {changes.complicationsChange > 0 ? "↓" : "↑"}
                    {Math.abs(changes.complicationsChange).toFixed(1)}%
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Review Decision</CardTitle>
              <CardDescription>
                Required comments for approval or denial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reviewNotes">Review Notes *</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Enter your review comments..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={5}
                  className="mt-2"
                  aria-required="true"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Comments are required for all decisions
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleApprove}
                  disabled={submitting || !reviewNotes.trim()}
                  className="w-full gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Renewal
                </Button>
                <Button
                  onClick={handleDeny}
                  variant="destructive"
                  disabled={submitting || !reviewNotes.trim()}
                  className="w-full gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Deny Renewal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Evidence Comparison */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Evidence Comparison
              </CardTitle>
              <CardDescription>
                Side-by-side comparison of previous approval vs. current evidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="evidence" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  <TabsTrigger value="credentials">Credentials</TabsTrigger>
                  <TabsTrigger value="certifications">Certifications</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>

                {/* Evidence Tab */}
                <TabsContent value="evidence" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Previous Evidence */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Previous Approval (
                        {new Date(
                          renewal.previousSnapshot.timestamp
                        ).toLocaleDateString()}
                        )
                      </h3>
                      {renewal.previousSnapshot.evidence.map((item, idx) => (
                        <Card key={idx} className="bg-muted/30">
                          <CardContent className="pt-4 pb-3 space-y-1">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium">{item.type}</p>
                              {item.verified && (
                                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.value}
                            </p>
                            {item.verifiedDate && (
                              <p className="text-xs text-muted-foreground">
                                Verified:{" "}
                                {new Date(item.verifiedDate).toLocaleDateString()}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Current Evidence */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Current Evidence (
                        {new Date(
                          renewal.currentSnapshot.timestamp
                        ).toLocaleDateString()}
                        )
                      </h3>
                      {renewal.currentSnapshot.evidence.map((item, idx) => {
                        const isNew =
                          !renewal.previousSnapshot.evidence.find(
                            (prev) => prev.type === item.type
                          );
                        return (
                          <Card
                            key={idx}
                            className={
                              isNew ? "bg-green-50 dark:bg-green-950 border-green-200" : ""
                            }
                          >
                            <CardContent className="pt-4 pb-3 space-y-1">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  {item.type}
                                  {isNew && (
                                    <Badge variant="default" className="text-xs">
                                      NEW
                                    </Badge>
                                  )}
                                </p>
                                {item.verified && (
                                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {item.value}
                              </p>
                              {item.verifiedDate && (
                                <p className="text-xs text-muted-foreground">
                                  Verified:{" "}
                                  {new Date(item.verifiedDate).toLocaleDateString()}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* Credentials Tab */}
                <TabsContent value="credentials" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Previous ({renewal.previousSnapshot.credentials.length})
                      </h3>
                      {renewal.previousSnapshot.credentials.map((cred, idx) => (
                        <Card key={idx} className="bg-muted/30">
                          <CardContent className="pt-4 pb-3 space-y-1">
                            <p className="text-sm font-medium">{cred.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {cred.issuer}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Issued:{" "}
                              {new Date(cred.issuedDate).toLocaleDateString()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Current ({renewal.currentSnapshot.credentials.length})
                      </h3>
                      {renewal.currentSnapshot.credentials.map((cred, idx) => {
                        const isNew =
                          !renewal.previousSnapshot.credentials.find(
                            (prev) => prev.type === cred.type
                          );
                        return (
                          <Card
                            key={idx}
                            className={
                              isNew ? "bg-green-50 dark:bg-green-950 border-green-200" : ""
                            }
                          >
                            <CardContent className="pt-4 pb-3 space-y-1">
                              <p className="text-sm font-medium flex items-center gap-2">
                                {cred.type}
                                {isNew && (
                                  <Badge variant="default" className="text-xs">
                                    NEW
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {cred.issuer}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Issued:{" "}
                                {new Date(cred.issuedDate).toLocaleDateString()}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* Certifications Tab */}
                <TabsContent value="certifications" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Previous ({renewal.previousSnapshot.certifications.length})
                      </h3>
                      {renewal.previousSnapshot.certifications.map((cert, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 rounded-md bg-muted/30"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{cert}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Current ({renewal.currentSnapshot.certifications.length})
                      </h3>
                      {renewal.currentSnapshot.certifications.map((cert, idx) => {
                        const isNew =
                          !renewal.previousSnapshot.certifications.some((prev) =>
                            cert.includes(prev.split(" (")[0])
                          );
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 p-3 rounded-md ${
                              isNew
                                ? "bg-green-50 dark:bg-green-950 border border-green-200"
                                : "bg-muted/30"
                            }`}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm">{cert}</span>
                            {isNew && (
                              <Badge variant="default" className="text-xs ml-auto">
                                NEW
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* Performance Tab */}
                <TabsContent value="performance" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Previous Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Case Volume
                          </p>
                          <p className="text-2xl font-bold">
                            {renewal.previousSnapshot.caseVolume || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Complications Rate
                          </p>
                          <p className="text-2xl font-bold">
                            {renewal.previousSnapshot.complicationsRate?.toFixed(1) ||
                              "N/A"}
                            %
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                      <CardHeader>
                        <CardTitle>Current Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Case Volume
                          </p>
                          <p className="text-2xl font-bold flex items-center gap-2">
                            {renewal.currentSnapshot.caseVolume || "N/A"}
                            {changes.caseVolumeChange > 0 && (
                              <Badge variant="default" className="text-xs">
                                +{changes.caseVolumeChange}
                              </Badge>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Complications Rate
                          </p>
                          <p className="text-2xl font-bold flex items-center gap-2">
                            {renewal.currentSnapshot.complicationsRate?.toFixed(1) ||
                              "N/A"}
                            %
                            {changes.complicationsChange > 0 && (
                              <Badge variant="default" className="text-xs">
                                ↓ {changes.complicationsChange.toFixed(1)}%
                              </Badge>
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

