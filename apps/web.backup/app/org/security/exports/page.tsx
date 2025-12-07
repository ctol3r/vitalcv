"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileArchive,
  Download,
  FileCheck,
  Shield,
  ClipboardCheck,
  Activity,
  Clock,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface ExportType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "ready" | "generating" | "requires_config";
  detailsPath?: string;
  actionLabel: string;
  fileFormat: string;
  estimatedSize: string;
  lastGenerated?: string;
}

const EXPORT_TYPES: ExportType[] = [
  {
    id: "audit",
    name: "Audit Log Export",
    description: "Complete audit trail of all system activities including user access, configuration changes, and data modifications",
    icon: <Activity className="h-5 w-5" />,
    status: "ready",
    detailsPath: "/org/audit/timeline",
    actionLabel: "Download",
    fileFormat: "ZIP (CSV + JSON)",
    estimatedSize: "~2.5 MB",
    lastGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ncqa",
    name: "NCQA CR1-CR5 Reports",
    description: "Credentialing evidence packages for NCQA auditor submission covering all verification criteria",
    icon: <FileCheck className="h-5 w-5" />,
    status: "requires_config",
    detailsPath: "/org/security/ncqa",
    actionLabel: "Configure & Generate",
    fileFormat: "ZIP (PDF + CSV)",
    estimatedSize: "~1.8 MB",
  },
  {
    id: "soc2",
    name: "SOC 2 Evidence Snapshots",
    description: "Access and change logs for the last 30 days, formatted for SOC 2 Type II audit requirements",
    icon: <Shield className="h-5 w-5" />,
    status: "ready",
    detailsPath: "/org/security/soc2",
    actionLabel: "Download",
    fileFormat: "ZIP (CSV)",
    estimatedSize: "~850 KB",
    lastGenerated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "fppe",
    name: "FPPE Reports",
    description: "Focused Professional Practice Evaluation reports for new privilege applicants",
    icon: <ClipboardCheck className="h-5 w-5" />,
    status: "ready",
    actionLabel: "Generate",
    fileFormat: "PDF",
    estimatedSize: "~500 KB",
  },
  {
    id: "oppe",
    name: "OPPE Reports",
    description: "Ongoing Professional Practice Evaluation reports for existing credentialed providers",
    icon: <ClipboardCheck className="h-5 w-5" />,
    status: "ready",
    actionLabel: "Generate",
    fileFormat: "PDF",
    estimatedSize: "~750 KB",
  },
];

export default function ExportCenterPage() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  const handleExport = async (exportType: ExportType) => {
    if (exportType.status === "requires_config" && exportType.detailsPath) {
      // Redirect to configuration page
      window.location.href = exportType.detailsPath;
      return;
    }

    setGenerating(exportType.id);

    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`/api/org/exports/${exportType.id}`, {
      //   method: "POST",
      // });

      // Simulate export delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Export generated",
        description: `${exportType.name} is ready for download.`,
      });

      // Simulate file download
      const filename = `${exportType.id}-export-${new Date().toISOString().split('T')[0]}.zip`;
      console.log(`Downloading: ${filename}`);

    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: `Unable to generate ${exportType.name}. Please try again.`,
      });
    } finally {
      setGenerating(null);
    }
  };

  const formatTimeSince = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    }
    if (diffHrs < 24) {
      return `${diffHrs} hour${diffHrs !== 1 ? "s" : ""} ago`;
    }
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  };

  const readyCount = EXPORT_TYPES.filter((e) => e.status === "ready").length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/org/security"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Security &amp; Compliance
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">Export Center</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <FileArchive className="h-8 w-8 text-primary" />
          Export Center
        </h1>
        <p className="text-muted-foreground">
          Generate and download compliance reports, audit logs, and evaluation packages
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Export Types</CardDescription>
            <CardTitle className="text-3xl">{EXPORT_TYPES.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              Ready to Export
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{readyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Requires Configuration</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {EXPORT_TYPES.filter((e) => e.status === "requires_config").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Export Types */}
      <div className="space-y-4">
        {EXPORT_TYPES.map((exportType) => (
          <Card key={exportType.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="p-3 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  {exportType.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                        {exportType.name}
                        {exportType.status === "ready" && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
                        )}
                        {exportType.status === "requires_config" && (
                          <Badge variant="outline" className="text-xs">
                            Configure Required
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {exportType.description}
                      </p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <FileArchive className="h-3 w-3" />
                      {exportType.fileFormat}
                    </span>
                    <span>Est. size: {exportType.estimatedSize}</span>
                    {exportType.lastGenerated && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last generated {formatTimeSince(exportType.lastGenerated)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleExport(exportType)}
                      disabled={generating === exportType.id}
                      size="sm"
                    >
                      {generating === exportType.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          {exportType.actionLabel}
                        </>
                      )}
                    </Button>
                    {exportType.detailsPath && exportType.status !== "requires_config" && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={exportType.detailsPath}>
                          View Details
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Help Text */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Accessibility Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All export files include accessible formats (CSV with proper headers, tagged PDFs)
            for compatibility with screen readers and assistive technology. Keyboard navigation
            is fully supported throughout the export process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

