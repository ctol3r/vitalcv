"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileCheck,
  Download,
  Calendar,
  AlertCircle,
  Info,
  CheckCircle2,
  FileArchive
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { format } from "date-fns";

interface NCQAReport {
  criterion: string;
  description: string;
  recordCount: number;
}

const NCQA_REPORTS: NCQAReport[] = [
  {
    criterion: "CR1",
    description: "Verification of professional credentials and licenses",
    recordCount: 0,
  },
  {
    criterion: "CR2",
    description: "Primary source verification of board certification",
    recordCount: 0,
  },
  {
    criterion: "CR3",
    description: "Verification of malpractice insurance coverage",
    recordCount: 0,
  },
  {
    criterion: "CR4",
    description: "Verification of work history and references",
    recordCount: 0,
  },
  {
    criterion: "CR5",
    description: "Sanctions and disciplinary action verification",
    recordCount: 0,
  },
];

export default function NCQAEvidenceExportPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateExport = async () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "Missing dates",
        description: "Please select both start and end dates for the report period.",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      toast({
        variant: "destructive",
        title: "Invalid date range",
        description: "Start date must be before end date.",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Simulate API call to generate report
      // TODO: Replace with actual API endpoint
      // const response = await fetch("/api/org/ncqa/export", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ startDate, endDate }),
      // });

      // Simulate download delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Export generated successfully",
        description: `NCQA evidence package for ${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")} is ready.`,
      });

      // Simulate file download
      const filename = `ncqa-evidence-${startDate}-to-${endDate}.zip`;
      console.log(`Downloading: ${filename}`);

    } catch (error) {
      console.error("Failed to generate NCQA export:", error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Unable to generate NCQA evidence package. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/org/security"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Security &amp; Compliance
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">NCQA Evidence Export</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <FileCheck className="h-8 w-8 text-primary" />
          NCQA Evidence Export
        </h1>
        <p className="text-muted-foreground">
          Generate credentialing reports (CR1-CR5) for NCQA auditor submission
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>About NCQA Credentialing Standards</AlertTitle>
        <AlertDescription>
          The National Committee for Quality Assurance (NCQA) requires healthcare organizations to
          verify provider credentials through primary sources. This tool generates a comprehensive
          evidence package covering all CR1-CR5 criteria for your selected date range.
        </AlertDescription>
      </Alert>

      {/* Export Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Configuration
          </CardTitle>
          <CardDescription>
            Select the date range for credential verification activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">
                  Start Date
                  <span className="text-destructive ml-1" aria-label="required">*</span>
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  aria-required="true"
                  max={endDate || undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">
                  End Date
                  <span className="text-destructive ml-1" aria-label="required">*</span>
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  aria-required="true"
                  min={startDate || undefined}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerateExport}
              disabled={isGenerating || !startDate || !endDate}
              className="w-full sm:w-auto"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating Export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate &amp; Download ZIP
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Contents Preview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Evidence Package Contents
          </CardTitle>
          <CardDescription>
            Your ZIP file will include the following credentialing reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {NCQA_REPORTS.map((report) => (
              <div
                key={report.criterion}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
              >
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{report.criterion}</span>
                    <span className="text-xs text-muted-foreground">
                      ({report.recordCount} records)
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            How to Submit to NCQA Auditor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-decimal list-inside">
            <li className="text-sm">
              <strong>Generate the export</strong> — Select your reporting period and download the ZIP file
            </li>
            <li className="text-sm">
              <strong>Review the contents</strong> — Verify that all CR1-CR5 reports contain accurate data
            </li>
            <li className="text-sm">
              <strong>Submit to your auditor</strong> — Upload the ZIP file through your NCQA portal or email it to your assigned auditor
            </li>
            <li className="text-sm">
              <strong>Maintain records</strong> — Keep a copy of the export for your internal compliance documentation
            </li>
          </ol>

          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Screen reader users:</strong> All generated reports include accessible CSV formats
              with proper headers and semantic structure for compatibility with assistive technology.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

