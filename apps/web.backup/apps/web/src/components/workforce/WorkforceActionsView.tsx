/**
 * Workforce Actions View Component
 * Phase 5: Operational Actions & Administration
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Send,
  Users,
  FileText,
  Download,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import { AssignShiftShortcut } from './AssignShiftShortcut';
import { PushTasksToClinicians } from './PushTasksToClinicians';
import { RecruiterIntegration } from './RecruiterIntegration';
import { CredentialUpdateRequest } from './CredentialUpdateRequest';
import { ComplianceAuditExport } from './ComplianceAuditExport';
import { GlobalChainRecheck } from './GlobalChainRecheck';

export function WorkforceActionsView() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workforce Actions</h1>
        <p className="text-muted-foreground mt-1">
          Real tools for the people who make hospitals function
        </p>
      </div>

      {/* Assign Shift Shortcut */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Assign Shift from Command Center
          </CardTitle>
          <CardDescription>Quick shift assignment with credential verification</CardDescription>
        </CardHeader>
        <CardContent>
          <AssignShiftShortcut />
        </CardContent>
      </Card>

      {/* Push Tasks to Clinicians */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Push Tasks to Clinicians
          </CardTitle>
          <CardDescription>Send task requests directly to clinicians</CardDescription>
        </CardHeader>
        <CardContent>
          <PushTasksToClinicians />
        </CardContent>
      </Card>

      {/* Recruiter Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recruiter Integration
          </CardTitle>
          <CardDescription>Find candidates for staffing gaps</CardDescription>
        </CardHeader>
        <CardContent>
          <RecruiterIntegration />
        </CardContent>
      </Card>

      {/* Credential Update Request */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Credential Update Request
          </CardTitle>
          <CardDescription>Request credential updates at the unit level</CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialUpdateRequest />
        </CardContent>
      </Card>

      {/* Compliance Audit Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Compliance Audit Export
          </CardTitle>
          <CardDescription>Export compliance audits as PDF with chain hashes</CardDescription>
        </CardHeader>
        <CardContent>
          <ComplianceAuditExport />
        </CardContent>
      </Card>

      {/* Global Chain Recheck */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Global Chain Recheck
          </CardTitle>
          <CardDescription>Run compliance surveys with chain verification</CardDescription>
        </CardHeader>
        <CardContent>
          <GlobalChainRecheck />
        </CardContent>
      </Card>
    </div>
  );
}








