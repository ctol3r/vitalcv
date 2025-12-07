"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Shield,
  FileCheck,
  Activity,
  CheckCircle2,
  Info,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SecurityBadge {
  id: string;
  label: string;
  status: "active" | "configured" | "pending";
  description: string;
  dataSource: string;
  docsUrl?: string;
  icon: React.ReactNode;
}

const SECURITY_BADGES: SecurityBadge[] = [
  {
    id: "dpop",
    label: "DPoP Enforced",
    status: "active",
    description: "Demonstrating Proof-of-Possession for OAuth 2.0 tokens is enforced across all API endpoints",
    dataSource: "API Gateway Configuration",
    docsUrl: "/docs/regulatory/dpop",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "ncqa",
    label: "NCQA Ready",
    status: "active",
    description: "Organization meets all NCQA credentialing standards (CR1-CR5) with complete evidence packages",
    dataSource: "Credentialing Database & Audit Logs",
    docsUrl: "/org/security/ncqa",
    icon: <FileCheck className="h-4 w-4" />,
  },
  {
    id: "logging",
    label: "Logging Normalized",
    status: "active",
    description: "All system logs follow standardized format for compliance monitoring and audit trail",
    dataSource: "Centralized Logging Pipeline",
    icon: <Activity className="h-4 w-4" />,
  },
];

function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "configured":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  if (status === "active") {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

export default function OrgSettingsPage() {
  const activeCount = SECURITY_BADGES.filter((b) => b.status === "active").length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Organization Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your organization's configuration and security posture
        </p>
      </div>

      {/* Security Posture Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Posture
              </CardTitle>
              <CardDescription className="mt-1">
                {activeCount} of {SECURITY_BADGES.length} security controls active
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/org/security" className="flex items-center gap-2">
                View All
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {SECURITY_BADGES.map((badge) => (
              <TooltipProvider key={badge.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-help">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 rounded-md bg-primary/10 text-primary">
                          {badge.icon}
                        </div>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(badge.status)}
                        </div>
                      </div>

                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        {badge.label}
                        <Badge
                          variant={getStatusBadgeVariant(badge.status)}
                          className="text-xs"
                        >
                          {badge.status === "active" ? "Active" :
                           badge.status === "configured" ? "Configured" : "Pending"}
                        </Badge>
                      </h3>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {badge.description}
                      </p>

                      {badge.docsUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 w-full justify-center"
                          asChild
                        >
                          <Link href={badge.docsUrl} className="flex items-center gap-1">
                            Learn More
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-2">
                      <p className="text-sm">{badge.description}</p>
                      <div className="text-xs text-muted-foreground border-t pt-2">
                        <strong>Data Source:</strong> {badge.dataSource}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Settings Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Organization profile and basic configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/profile">
                  Organization Profile
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/users">
                  User Management
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/roles">
                  Roles &amp; Permissions
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance &amp; Audit</CardTitle>
            <CardDescription>
              Compliance frameworks and audit tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/security">
                  Security &amp; Compliance
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/audit/timeline">
                  Audit Timeline
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/security/exports">
                  Export Center
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              EHR, payer, and third-party integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/ehr">
                  EHR Connections
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/payers">
                  Payer Networks
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/api">
                  API Configuration
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advanced</CardTitle>
            <CardDescription>
              System configuration and developer tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/notifications">
                  Notification Preferences
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/webhooks">
                  Webhooks
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/org/settings/billing">
                  Billing &amp; Usage
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

