"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Shield,
  Download,
  FileText,
  Clock,
  Users,
  Activity,
  Info,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

interface EvidenceSnapshot {
  id: string;
  type: "access" | "change";
  count: number;
  lastUpdated: string;
  sizeKB: number;
}

export default function SOC2EvidencePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call to fetch snapshot metadata
    const loadSnapshots = async () => {
      try {
        // TODO: Replace with actual API endpoint
        // const response = await fetch("/api/org/security/soc2/snapshots");
        // const data = await response.json();

        // Mock data
        const mockData: EvidenceSnapshot[] = [
          {
            id: "access-snapshot-001",
            type: "access",
            count: 1247,
            lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            sizeKB: 342,
          },
          {
            id: "change-snapshot-001",
            type: "change",
            count: 856,
            lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
            sizeKB: 521,
          },
        ];

        setSnapshots(mockData);
      } catch (error) {
        console.error("Failed to load SOC2 snapshots:", error);
        toast({
          variant: "destructive",
          title: "Failed to load snapshots",
          description: "Unable to retrieve evidence snapshots. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadSnapshots();
  }, [toast]);

  const handleDownload = async (snapshot: EvidenceSnapshot) => {
    setDownloading(snapshot.id);

    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`/api/org/security/soc2/download/${snapshot.id}`);
      // const blob = await response.blob();
      // const url = URL.createObjectURL(blob);

      // Simulate download delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "Download started",
        description: `${snapshot.type === "access" ? "Access" : "Change"} logs snapshot is downloading.`,
      });

      // Simulate file download
      const filename = `soc2-${snapshot.type}-logs-${snapshot.id}.zip`;
      console.log(`Downloading: ${filename}`);

    } catch (error) {
      console.error("Download failed:", error);
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Unable to download evidence snapshot. Please try again.",
      });
    } finally {
      setDownloading(null);
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

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const accessSnapshot = snapshots.find((s) => s.type === "access");
  const changeSnapshot = snapshots.find((s) => s.type === "change");

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

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
          <span className="font-semibold">SOC 2 Evidence</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          SOC 2 Evidence Snapshots
        </h1>
        <p className="text-muted-foreground">
          Access and change logs for the last 30 days (rolling window)
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>About SOC 2 Evidence Collection</AlertTitle>
        <AlertDescription>
          SOC 2 Type II audits require comprehensive evidence of access controls and change management.
          These snapshots capture all system access events and configuration changes over a 30-day
          rolling period, providing auditors with the necessary evidence for compliance verification.
        </AlertDescription>
      </Alert>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Events (30 days)</CardDescription>
            <CardTitle className="text-3xl">
              {(accessSnapshot?.count || 0) + (changeSnapshot?.count || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Access Events
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {accessSnapshot?.count || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Change Events
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {changeSnapshot?.count || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Evidence Snapshots */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Access Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Access Logs
              </CardTitle>
              <Badge variant="default">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
            <CardDescription>
              All authentication attempts, session starts, privilege escalations, and access grants
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accessSnapshot ? (
              <div className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total records:</span>
                    <span className="font-semibold">{accessSnapshot.count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last updated:</span>
                    <span className="font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeSince(accessSnapshot.lastUpdated)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">File size:</span>
                    <span className="font-semibold">{formatSize(accessSnapshot.sizeKB)}</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleDownload(accessSnapshot)}
                  disabled={downloading === accessSnapshot.id}
                  className="w-full"
                >
                  {downloading === accessSnapshot.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Access Logs
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No access logs available</p>
            )}
          </CardContent>
        </Card>

        {/* Change Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Change Logs
              </CardTitle>
              <Badge variant="default">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
            <CardDescription>
              System configuration changes, privilege modifications, policy updates, and infrastructure changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {changeSnapshot ? (
              <div className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total records:</span>
                    <span className="font-semibold">{changeSnapshot.count.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last updated:</span>
                    <span className="font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeSince(changeSnapshot.lastUpdated)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">File size:</span>
                    <span className="font-semibold">{formatSize(changeSnapshot.sizeKB)}</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleDownload(changeSnapshot)}
                  disabled={downloading === changeSnapshot.id}
                  className="w-full"
                >
                  {downloading === changeSnapshot.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Change Logs
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No change logs available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* What's Inside */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            What's Inside Each Snapshot
          </CardTitle>
          <CardDescription>
            Detailed breakdown of evidence contents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-3 text-sm">Access Logs Include:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  User authentication events (success & failure)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Session creation and termination
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Privilege escalation requests
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Resource access attempts
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  API token usage and rotation
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-sm">Change Logs Include:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  System configuration modifications
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  User role and permission updates
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Security policy changes
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Infrastructure and deployment events
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Data retention policy updates
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

