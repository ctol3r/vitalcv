"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  FileCheck,
  Building2,
  Network,
  Activity,
  ExternalLink,
  CheckCircle2,
  Clock
} from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ComplianceStatus = "READY" | "IN_PROGRESS";

interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  status: ComplianceStatus;
  icon: React.ReactNode;
  docsUrl: string;
  detailsPath?: string;
  badges: string[];
}

const frameworks: ComplianceFramework[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    description: "Service Organization Control 2 compliance for data security, availability, processing integrity, confidentiality, and privacy.",
    status: "READY",
    icon: <Shield className="h-6 w-6" />,
    docsUrl: "/docs/regulatory/soc2",
    detailsPath: "/org/security/soc2",
    badges: ["Security", "Availability", "Confidentiality"],
  },
  {
    id: "hitrust",
    name: "HITRUST CSF",
    description: "Health Information Trust Alliance Common Security Framework for healthcare data protection and risk management.",
    status: "IN_PROGRESS",
    icon: <Building2 className="h-6 w-6" />,
    docsUrl: "/docs/regulatory/hitrust",
    badges: ["Healthcare", "Risk Management"],
  },
  {
    id: "ncqa",
    name: "NCQA CR1-CR5",
    description: "National Committee for Quality Assurance credentialing standards for provider directory accuracy and verification.",
    status: "READY",
    icon: <FileCheck className="h-6 w-6" />,
    docsUrl: "/docs/regulatory/ncqa",
    detailsPath: "/org/security/ncqa",
    badges: ["Credentialing", "Directory", "Verification"],
  },
  {
    id: "tefca",
    name: "TEFCA",
    description: "Trusted Exchange Framework and Common Agreement for nationwide health information exchange.",
    status: "READY",
    icon: <Network className="h-6 w-6" />,
    docsUrl: "/docs/regulatory/tefca",
    badges: ["Interoperability", "HIE"],
  },
  {
    id: "tefca-fhir",
    name: "TEFCA/FHIR",
    description: "Fast Healthcare Interoperability Resources implementation for TEFCA-compliant data exchange.",
    status: "IN_PROGRESS",
    icon: <Activity className="h-6 w-6" />,
    docsUrl: "/docs/regulatory/tefca-fhir",
    badges: ["FHIR", "HL7", "APIs"],
  },
];

function getStatusVariant(status: ComplianceStatus): "default" | "secondary" {
  return status === "READY" ? "default" : "secondary";
}

function getStatusIcon(status: ComplianceStatus) {
  return status === "READY" ? (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  ) : (
    <Clock className="h-4 w-4 text-orange-600" />
  );
}

export default function SecurityCompliancePage() {
  const readyCount = frameworks.filter((f) => f.status === "READY").length;
  const inProgressCount = frameworks.filter((f) => f.status === "IN_PROGRESS").length;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <Shield className="h-8 w-8" />
          Security &amp; Compliance
        </h1>
        <p className="text-muted-foreground">
          Monitor your organization's compliance status across healthcare security frameworks
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Frameworks</CardDescription>
            <CardTitle className="text-3xl">{frameworks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              Ready for Audit
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{readyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-orange-600" />
              In Progress
            </CardDescription>
            <CardTitle className="text-3xl text-orange-600">{inProgressCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Framework Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {frameworks.map((framework) => (
          <Card
            key={framework.id}
            className="flex flex-col transition-shadow hover:shadow-md"
          >
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {framework.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{framework.name}</CardTitle>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(framework.status)}
                        <Badge variant={getStatusVariant(framework.status)}>
                          {framework.status === "READY" ? "Ready" : "In Progress"}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {framework.status === "READY"
                          ? "This framework is audit-ready with all evidence collected"
                          : "This framework is being implemented"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription className="leading-relaxed">
                {framework.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {framework.badges.map((badge) => (
                    <Badge key={badge} variant="outline" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="flex-1"
                >
                  <Link
                    href={framework.docsUrl}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Documentation
                  </Link>
                </Button>
                {framework.detailsPath && (
                  <Button
                    size="sm"
                    asChild
                    className="flex-1"
                  >
                    <Link
                      href={framework.detailsPath}
                      className="flex items-center gap-2"
                    >
                      View Evidence
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Access compliance tools and reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Button variant="outline" asChild className="justify-start">
              <Link href="/org/security/exports" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Export Center
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/org/audit/timeline" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Audit Timeline
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/admin/compliance" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance Admin
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

