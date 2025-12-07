"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Printer,
  Download,
  FileText,
  Calendar,
  CheckCircle,
  Stethoscope,
  User,
  Building,
  Shield,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PrivilegeSummary {
  clinicianName: string;
  clinicianNPI: string;
  clinicianDegree: string;
  department: string;
  specialties: string[];
  privileges: {
    id: string;
    privilegeSetName: string;
    department: string;
    status: string;
    grantedDate: string;
    renewalDue: string;
    procedures: string[];
    restrictions?: string[];
  }[];
  organizationName: string;
  organizationAddress?: string;
  organizationPhone?: string;
  generatedDate: string;
  generatedBy?: string;
}

export default function PrintPrivilegeSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PrivilegeSummary | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/dashboard/privileges/print/${params.id}`);
        // const data = await response.json();

        // Mock data
        const mockData: PrivilegeSummary = {
          clinicianName: "Dr. Sarah Johnson",
          clinicianNPI: "1234567890",
          clinicianDegree: "MD, FACC",
          department: "Cardiology",
          specialties: ["Interventional Cardiology", "General Cardiology"],
          privileges: [
            {
              id: "priv-001",
              privilegeSetName: "Cardiology - Interventional",
              department: "Cardiology",
              status: "active",
              grantedDate: "2022-11-10",
              renewalDue: "2024-11-25",
              procedures: [
                "Cardiac Catheterization",
                "PCI (Percutaneous Coronary Intervention)",
                "Coronary Angiography",
                "Stent Placement",
                "IVUS (Intravascular Ultrasound)",
                "FFR (Fractional Flow Reserve)",
              ],
            },
            {
              id: "priv-002",
              privilegeSetName: "General Internal Medicine",
              department: "Internal Medicine",
              status: "active",
              grantedDate: "2020-01-15",
              renewalDue: "2025-01-15",
              procedures: [
                "Patient Admissions",
                "Discharge Planning",
                "Consultation Services",
                "Code Blue Response",
              ],
            },
            {
              id: "priv-003",
              privilegeSetName: "Echocardiography",
              department: "Cardiology",
              status: "active",
              grantedDate: "2023-03-20",
              renewalDue: "2025-03-20",
              procedures: [
                "Transthoracic Echocardiography",
                "Transesophageal Echocardiography",
                "Stress Echocardiography",
              ],
              restrictions: ["Must have sonographer present for TEE procedures"],
            },
          ],
          organizationName: "Memorial Healthcare System",
          organizationAddress: "123 Medical Center Drive, San Francisco, CA 94110",
          organizationPhone: "(415) 555-0100",
          generatedDate: new Date().toISOString(),
          generatedBy: "Credentialing System",
        };

        setSummary(mockData);
      } catch (error) {
        console.error("Failed to load privilege summary:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [params.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // In a real implementation, this would generate a PDF
    alert("PDF download functionality would be implemented here using a library like jsPDF or react-pdf");
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

  if (!summary) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Summary Not Found</h3>
          <p className="text-muted-foreground">
            The requested privilege summary could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden container mx-auto py-4 px-4 bg-muted/50 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Page wrapper for print styling */}
        <div className="bg-white print:bg-white print:shadow-none shadow-lg rounded-lg overflow-hidden">
          {/* Header with Logo Area */}
          <div className="bg-primary text-primary-foreground p-8 print:p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Building className="h-8 w-8" />
                  <div>
                    <h1 className="text-2xl font-bold">
                      {summary.organizationName}
                    </h1>
                    {summary.organizationAddress && (
                      <p className="text-sm opacity-90">{summary.organizationAddress}</p>
                    )}
                    {summary.organizationPhone && (
                      <p className="text-sm opacity-90">{summary.organizationPhone}</p>
                    )}
                  </div>
                </div>
              </div>
              {/* Logo placeholder */}
              <div className="w-24 h-24 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield className="h-12 w-12" />
              </div>
            </div>
          </div>

          {/* Document Title */}
          <div className="p-8 print:p-6 border-b">
            <h2 className="text-3xl font-bold text-center mb-2">
              Clinical Privileges Summary
            </h2>
            <p className="text-center text-muted-foreground">
              Official verification of clinical privileges and authorizations
            </p>
          </div>

          {/* Clinician Information */}
          <div className="p-8 print:p-6 border-b">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Clinician Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold text-lg">{summary.clinicianName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credentials</p>
                <p className="font-medium">{summary.clinicianDegree}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">National Provider Identifier (NPI)</p>
                <p className="font-mono">{summary.clinicianNPI}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Primary Department</p>
                <p className="font-medium">{summary.department}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground mb-2">Specialties</p>
                <div className="flex flex-wrap gap-2">
                  {summary.specialties.map((specialty, idx) => (
                    <Badge key={idx} variant="secondary">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Privileges List */}
          <div className="p-8 print:p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Active Clinical Privileges ({summary.privileges.length})
            </h3>

            <div className="space-y-6">
              {summary.privileges.map((privilege, idx) => (
                <Card key={privilege.id} className="print:border print:break-inside-avoid">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        {privilege.privilegeSetName}
                      </CardTitle>
                      <Badge
                        variant="default"
                        className="gap-1 print:border print:border-green-600"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Granted: {new Date(privilege.grantedDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Renewal Due: {new Date(privilege.renewalDue).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Authorized Procedures & Services:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {privilege.procedures.map((procedure, pidx) => (
                          <li key={pidx}>{procedure}</li>
                        ))}
                      </ul>
                    </div>

                    {privilege.restrictions && privilege.restrictions.length > 0 && (
                      <div className="border-l-4 border-yellow-500 bg-yellow-50 p-3 print:border print:border-yellow-300">
                        <p className="text-sm font-medium text-yellow-900 mb-1">
                          Restrictions:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                          {privilege.restrictions.map((restriction, ridx) => (
                            <li key={ridx}>{restriction}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Footer / Signature Area */}
          <div className="p-8 print:p-6 bg-muted/30 print:bg-gray-50">
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                <p>
                  This document certifies that the above-named clinician has been
                  granted the clinical privileges listed herein by {summary.organizationName}.
                  These privileges are subject to the policies, procedures, and bylaws of the
                  medical staff and the organization.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6">
                <div className="border-t-2 border-gray-400 pt-2">
                  <p className="text-sm font-medium">Authorized Signature</p>
                  <p className="text-xs text-muted-foreground">
                    Medical Staff Services / Credentialing Department
                  </p>
                </div>
                <div className="border-t-2 border-gray-400 pt-2">
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(summary.generatedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>
                    Document generated: {new Date(summary.generatedDate).toLocaleString()}
                  </span>
                  <span>
                    Generated by: {summary.generatedBy || "Credentialing System"}
                  </span>
                </div>
                <p className="mt-2">
                  <strong>Important:</strong> This document is for verification purposes
                  only and does not constitute a contract or guarantee of employment.
                  Privileges may be modified or revoked at any time in accordance with
                  medical staff bylaws.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Print instructions - Hidden when printing */}
        <div className="print:hidden mt-8 text-center text-sm text-muted-foreground">
          <p>
            This page is optimized for printing. Use your browser's print function
            or click the Print button above.
          </p>
          <p className="mt-2">
            For best results, print in portrait orientation with margins set to
            "Default" or "Normal".
          </p>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          @page {
            size: letter portrait;
            margin: 0.5in;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print\\:p-6 {
            padding: 1.5rem !important;
          }

          .print\\:shadow-none {
            box-shadow: none !important;
          }

          .print\\:bg-white {
            background-color: white !important;
          }

          .print\\:bg-gray-50 {
            background-color: #f9fafb !important;
          }

          .print\\:border {
            border-width: 1px !important;
          }

          .print\\:border-green-600 {
            border-color: #16a34a !important;
          }

          .print\\:border-yellow-300 {
            border-color: #fde047 !important;
          }
        }
      `}</style>
    </div>
  );
}

