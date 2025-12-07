"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Shield, Package, Lock, GitBranch } from "lucide-react";

interface SupplyChainPosture {
  sbom: {
    status: "pass" | "fail" | "warning";
    lastGenerated: string;
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
    };
  };
  ciGates: {
    status: "pass" | "fail" | "warning";
    dependencyReview: boolean;
    sbomUpload: boolean;
    cosignSigning: boolean;
    provenance: boolean;
  };
  signing: {
    status: "pass" | "fail" | "warning";
    imagesSigned: number;
    totalImages: number;
    keylessEnabled: boolean;
  };
  // B123B-FE-009: DPoP and PQ-TLS security metrics
  dpop: {
    status: "pass" | "fail" | "warning";
    enabled: boolean;
    defaultMode: boolean;
    coverage: number; // percentage
  };
  pqTls: {
    status: "pass" | "fail" | "warning";
    hybridMode: boolean;
    algorithm: string;
    coverage: number; // percentage
  };
}

export default function Security() {
  const [posture, setPosture] = useState<SupplyChainPosture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data - replace with actual API call
    const fetchPosture = async () => {
      try {
        // const response = await fetch('/api/security/supply-chain-posture');
        // const data = await response.json();
        // setPosture(data);

        // Mock data for now
        setTimeout(() => {
          setPosture({
            sbom: {
              status: "pass",
              lastGenerated: "2025-01-09T10:00:00Z",
              vulnerabilities: {
                critical: 0,
                high: 2,
                medium: 5,
              },
            },
            ciGates: {
              status: "pass",
              dependencyReview: true,
              sbomUpload: true,
              cosignSigning: true,
              provenance: true,
            },
            signing: {
              status: "pass",
              imagesSigned: 12,
              totalImages: 12,
              keylessEnabled: true,
            },
            // B123B-FE-009: DPoP default mode
            dpop: {
              status: "pass",
              enabled: true,
              defaultMode: true,
              coverage: 100,
            },
            // B123B-FE-009: PQ-TLS hybrid mode
            pqTls: {
              status: "pass",
              hybridMode: true,
              algorithm: "Kyber768-X25519",
              coverage: 95,
            },
          });
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error("Failed to fetch supply chain posture:", error);
        setLoading(false);
      }
    };

    fetchPosture();
  }, []);

  const getStatusIcon = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getStatusBadge = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Pass</Badge>;
      case "fail":
        return <Badge variant="destructive">Fail</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Warning</Badge>;
    }
  };

  return (
    <div className='max-w-6xl mx-auto py-8 px-4'>
      <div className="mb-8">
        <h1 className='text-3xl font-bold mb-2 flex items-center gap-2'>
          <Shield className="h-8 w-8" />
          Security & Supply Chain Posture
        </h1>
        <p className='text-muted-foreground'>
          Monitor supply chain security, SBOM status, and CI/CD security gates
        </p>
      </div>

      {/* Supply Chain Posture Tiles */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading supply chain posture...</div>
      ) : posture ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* SBOM Tile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  SBOM Status
                </CardTitle>
                {getStatusIcon(posture.sbom.status)}
              </div>
              <CardDescription>Software Bill of Materials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getStatusBadge(posture.sbom.status)}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Generated:</span>
                  <span>{new Date(posture.sbom.lastGenerated).toLocaleDateString()}</span>
                </div>
                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Critical:</span>
                    <Badge variant={posture.sbom.vulnerabilities.critical > 0 ? "destructive" : "secondary"}>
                      {posture.sbom.vulnerabilities.critical}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">High:</span>
                    <Badge variant={posture.sbom.vulnerabilities.high > 0 ? "destructive" : "secondary"}>
                      {posture.sbom.vulnerabilities.high}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Medium:</span>
                    <Badge variant="secondary">{posture.sbom.vulnerabilities.medium}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CI Gates Tile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  CI/CD Gates
                </CardTitle>
                {getStatusIcon(posture.ciGates.status)}
              </div>
              <CardDescription>Continuous Integration Security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getStatusBadge(posture.ciGates.status)}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dependency Review</span>
                  {posture.ciGates.dependencyReview ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SBOM Upload</span>
                  {posture.ciGates.sbomUpload ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cosign Signing</span>
                  {posture.ciGates.cosignSigning ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provenance</span>
                  {posture.ciGates.provenance ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signing Tile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Image Signing
                </CardTitle>
                {getStatusIcon(posture.signing.status)}
              </div>
              <CardDescription>Container Image Attestation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getStatusBadge(posture.signing.status)}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signed Images:</span>
                  <span className="font-medium">
                    {posture.signing.imagesSigned} / {posture.signing.totalImages}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Keyless Signing:</span>
                  {posture.signing.keylessEnabled ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* B123B-FE-009: DPoP Default Tile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  DPoP Authentication
                </CardTitle>
                {getStatusIcon(posture.dpop.status)}
              </div>
              <CardDescription>Demonstrating Proof-of-Possession</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getStatusBadge(posture.dpop.status)}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={posture.dpop.enabled ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}>
                    {posture.dpop.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Default Mode:</span>
                  {posture.dpop.defaultMode ? (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Default
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Optional</Badge>
                  )}
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Coverage:</span>
                  <span className="font-medium">{posture.dpop.coverage}%</span>
                </div>
                <div className="pt-2">
                  <a
                    href="/docs/security/dpop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View DPoP documentation →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* B123B-FE-009: PQ-TLS Hybrid Tile */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  PQ-TLS Hybrid
                </CardTitle>
                {getStatusIcon(posture.pqTls.status)}
              </div>
              <CardDescription>Post-Quantum TLS Security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getStatusBadge(posture.pqTls.status)}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mode:</span>
                  {posture.pqTls.hybridMode ? (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      Hybrid
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Classic</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Algorithm:</span>
                  <span className="font-mono text-xs">{posture.pqTls.algorithm}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Coverage:</span>
                  <span className="font-medium">{posture.pqTls.coverage}%</span>
                </div>
                <div className="pt-2">
                  <a
                    href="/docs/security/pq-tls"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View PQ-TLS documentation →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Existing Security Tools */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Security Tools</h2>
        <p className='text-sm text-muted-foreground mb-6'>
          Run security tests and generate compliance reports. These tools help maintain security posture
          and prepare for audits.
        </p>

        <div className='space-y-6'>
          {/* SBOM Generation */}
          <SecurityTool
            title="SBOM Generation"
            description="Generate Software Bill of Materials (CycloneDX format) and run dependency audit."
            command="./scripts/sbom.sh"
            output="Creates sbom.json and runs npm audit"
          />

          {/* ZAP Pen Test */}
          <SecurityTool
            title="OWASP ZAP Baseline Scan"
            description="Run automated penetration testing against your API endpoints."
            command="./scripts/zap_baseline.sh"
            output="Generates zap_report.html with security findings"
          />

          {/* Chaos Engineering */}
          <SecurityTool
            title="Chaos Latency Drill"
            description="Test system resilience by injecting 500ms latency for 60 seconds (requires toxiproxy)."
            command="./scripts/chaos_latency.sh"
            output="Runs latency injection and validates system behavior"
          />

          {/* Backup Verification */}
          <SecurityTool
            title="Backup & Restore Verification"
            description="Verify backup integrity and disaster recovery procedures."
            command="./scripts/backup_verify.sh"
            output="Runs DR backup and smoke tests"
          />
        </div>
      </div>

      <div className='mt-8 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded'>
        <h3 className='font-semibold text-sm mb-2'>🔒 Security Best Practices</h3>
        <ul className='text-xs space-y-1 list-disc ml-5 text-yellow-900 dark:text-yellow-100'>
          <li>Run SBOM generation weekly and track dependency vulnerabilities</li>
          <li>Schedule ZAP scans before each production deployment</li>
          <li>Test chaos scenarios monthly to validate resilience</li>
          <li>Verify backup restoration quarterly</li>
          <li>Review CSP violation reports at /csp/report</li>
        </ul>
      </div>
    </div>
  );
}

function SecurityTool({
  title,
  description,
  command,
  output
}: {
  title: string;
  description: string;
  command: string;
  output: string;
}) {
  return (
    <div className='border rounded p-4'>
      <h2 className='font-semibold mb-2'>{title}</h2>
      <p className='text-sm opacity-80 mb-3'>{description}</p>

      <div className='bg-gray-900 text-green-400 p-3 rounded mb-2 font-mono text-xs'>
        $ {command}
      </div>

      <p className='text-xs text-gray-600'>
        <strong>Output:</strong> {output}
      </p>
    </div>
  );
}

