'use client';

import { PaneProvider, usePanes } from '@/components/panes/PaneManager';
import { ClaimWizardPane } from '@/components/claim/ClaimWizardPane';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Shield, UserCheck } from 'lucide-react';

function DemoContent() {
  const { push } = usePanes();

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">VitalCV Workspace</h1>
        <p className="text-muted-foreground mt-2">
          Craft-style sliding panes with Framer Motion for smooth, contextual workflows
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </div>
            <CardDescription>Common NPI and credential operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() =>
                push({
                  title: 'Credential • MD12345',
                  content: (
                    <div className="p-6 space-y-4">
                      <h3 className="font-semibold">Medical License Details</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>License Number:</strong> MD12345
                        </div>
                        <div>
                          <strong>Issued By:</strong> California Medical Board
                        </div>
                        <div>
                          <strong>Status:</strong>{' '}
                          <span className="text-green-600">Active</span>
                        </div>
                        <div>
                          <strong>Expires:</strong> 2025-12-31
                        </div>
                      </div>
                    </div>
                  ),
                })
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              View Credential
            </Button>

            <Button
              className="w-full justify-start"
              onClick={() =>
                push({
                  title: 'Claim NPI • 1234567890',
                  content: <ClaimWizardPane npi="1234567890" />,
                  width: 700,
                })
              }
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Start Claim Wizard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Your latest interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>NPI Lookup</span>
                <span className="text-muted-foreground">2 min ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Credential Issued</span>
                <span className="text-muted-foreground">1 hour ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Verification Request</span>
                <span className="text-muted-foreground">3 hours ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tips</CardTitle>
            <CardDescription>Get the most out of VitalCV</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• Use panes to work on multiple tasks simultaneously</li>
              <li>• Click outside a pane to close it</li>
              <li>• Stack multiple panes for context</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Sliding Panes</CardTitle>
          <CardDescription>A modern approach to multitasking</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p>
            VitalCV uses sliding panes for contextual workflows. Unlike traditional tabs or
            modals, panes allow you to:
          </p>
          <ul>
            <li>Stack multiple contexts side-by-side</li>
            <li>Maintain visual hierarchy with animated transitions</li>
            <li>Quick close with backdrop click or X button</li>
            <li>Smooth Framer Motion animations</li>
          </ul>
          <p>
            Try opening multiple claims or credentials to see how panes stack and animate!
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function WorkspacePage() {
  return (
    <PaneProvider>
      <DemoContent />
    </PaneProvider>
  );
}

