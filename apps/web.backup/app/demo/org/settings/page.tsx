"use client";

/**
 * S72-D3-A-006: Org settings: simple OrgAdmin home screen
 * Shows 'You are OrgAdmin' tag, link to policy, 'Invite another admin' button
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PolicyModal from "@/components/demo/PolicyModal";

export default function DemoOrgSettingsPage() {
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState('demo-org-001'); // In real app, get from context/session
  const [isInviting, setIsInviting] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const { toast } = useToast();

  const handleInviteAdmin = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/demo/org/invite-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite admin');
      }

      toast({
        title: 'Invite sent',
        description: `Admin invite sent to ${email}`,
      });
      setEmail('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite admin',
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
          <Badge variant="default" className="bg-blue-600">
            <Shield className="h-3 w-3 mr-1" />
            You are OrgAdmin
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Manage your organization's settings and administrators
        </p>
      </div>

      {/* Policy Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Platform Policy
          </CardTitle>
          <CardDescription>
            Review and accept the platform terms of service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setShowPolicyModal(true)}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            Review & Accept Policy
          </Button>
        </CardContent>
      </Card>

      {/* Invite Admin Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Another Admin
          </CardTitle>
          <CardDescription>
            Send an invitation to add another organization administrator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleInviteAdmin();
                  }
                }}
                aria-label="Email address for admin invite"
              />
            </div>
            <Button
              onClick={handleInviteAdmin}
              disabled={isInviting || !email}
              className="w-full sm:w-auto"
            >
              {isInviting ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Policy Modal */}
      {showPolicyModal && (
        <PolicyModal
          orgId={orgId}
          onClose={() => setShowPolicyModal(false)}
        />
      )}
    </div>
  );
}

