"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  FileText,
  Shield
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface PrivilegeRequest {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetName: string;
  department: string;
  status: "pending" | "under_review" | "approved" | "denied";
  requestDate: string;
  reviewerName?: string;
  verifiableCredential: any;
  passReasons: string[];
  failReasons: string[];
}

export default function PrivilegeReviewPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<PrivilegeRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showVCJson, setShowVCJson] = useState(false);

  useEffect(() => {
    // Simulate API call - replace with actual API
    const loadRequest = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/org/privilege-requests/${requestId}`);
        // const data = await response.json();

        // Mock data
        const mockRequest: PrivilegeRequest = {
          id: requestId,
          clinicianName: "Dr. Sarah Johnson",
          clinicianNPI: "1234567890",
          privilegeSetName: "Cardiology - Interventional",
          department: "Cardiology",
          status: "under_review",
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
                { name: "Cardiac Catheterization", caseCount: 500 }
              ]
            }
          },
          passReasons: [
            "Board certified in Cardiology",
            "12 years of clinical experience exceeds 5-year requirement",
            "450+ coronary angiography cases exceed minimum of 50/year",
            "Valid CA medical license through 2025",
            "Active NPI registration verified"
          ],
          failReasons: []
        };

        setRequest(mockRequest);
      } catch (error) {
        console.error("Failed to load privilege request:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [requestId]);

  const handleApprove = async () => {
    if (!request) return;

    setSubmitting(true);
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/org/privilege-requests/${requestId}/approve`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ notes: reviewNotes }),
      // });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Approving request:", { requestId, notes: reviewNotes });

      router.push("/org/privileges");
    } catch (error) {
      console.error("Failed to approve request:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!request || !reviewNotes.trim()) {
      alert("Please provide a reason for denial");
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/org/privilege-requests/${requestId}/deny`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ notes: reviewNotes }),
      // });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Denying request:", { requestId, notes: reviewNotes });

      router.push("/org/privileges");
    } catch (error) {
      console.error("Failed to deny request:", error);
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

  if (!request) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Request not found</h3>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPassReasons = request.passReasons.length > 0;
  const hasFailReasons = request.failReasons.length > 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back to privilege requests"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Review Privilege Request
        </h1>
        <p className="text-muted-foreground">
          Request ID: {request.id}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Request Details & VC */}
        <div className="space-y-6">
          {/* Clinician Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Clinician Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium">{request.clinicianName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">NPI</Label>
                <p className="font-mono text-sm">{request.clinicianNPI}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Privilege Set</Label>
                <p className="font-medium">{request.privilegeSetName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Department</Label>
                <p>{request.department}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Request Date</Label>
                <p>{new Date(request.requestDate).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Verifiable Credential */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Verifiable Credential
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVCJson(!showVCJson)}
                >
                  {showVCJson ? "Show Summary" : "Show JSON"}
                </Button>
              </div>
              <CardDescription>
                Cryptographically signed credential snapshot
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showVCJson ? (
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                    {JSON.stringify(request.verifiableCredential, null, 2)}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(request.verifiableCredential, null, 2)
                      );
                    }}
                  >
                    Copy
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Credential Type</Label>
                    <p className="font-medium">
                      {request.verifiableCredential.type.join(", ")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Issuer</Label>
                    <p className="text-sm break-all">
                      {request.verifiableCredential.issuer}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Issued</Label>
                    <p>
                      {new Date(
                        request.verifiableCredential.issuanceDate
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Expires</Label>
                    <p>
                      {new Date(
                        request.verifiableCredential.expirationDate
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="pt-3 border-t">
                    <Label className="text-muted-foreground mb-2 block">
                      Credential Subject Data
                    </Label>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License State:</span>
                        <Badge variant="outline">
                          {request.verifiableCredential.credentialSubject.licenseState}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Years Experience:</span>
                        <Badge variant="outline">
                          {request.verifiableCredential.credentialSubject.yearsExperience}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Specialty:</span>
                        <span className="font-medium">
                          {request.verifiableCredential.credentialSubject.specialty}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Analysis & Actions */}
        <div className="space-y-6">
          {/* PASS Reasons */}
          {hasPassReasons && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-900 dark:text-green-100">
                Meets Requirements
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {request.passReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* FAIL Reasons */}
          {hasFailReasons && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Does Not Meet Requirements</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {request.failReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Review Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Review Decision
              </CardTitle>
              <CardDescription>
                Provide your decision and notes for this request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reviewNotes">
                  Review Notes {hasFailReasons && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Enter your review notes here..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={5}
                  aria-describedby="notes-hint"
                />
                <p id="notes-hint" className="text-xs text-muted-foreground">
                  {hasFailReasons
                    ? "Notes are required when denying a request"
                    : "Optional: Add context or conditions for approval"}
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleApprove}
                  disabled={submitting || request.status === "approved"}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {submitting ? "Processing..." : "Approve"}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeny}
                  disabled={submitting || request.status === "denied"}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {submitting ? "Processing..." : "Deny"}
                </Button>
              </div>

              {request.status !== "pending" && request.status !== "under_review" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This request has already been{" "}
                    <strong>{request.status}</strong>
                    {request.reviewerName && ` by ${request.reviewerName}`}.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

