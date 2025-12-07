'use client';

import { UserSearchResult } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Link2,
  AlertCircle,
  CheckCircle,
  Mail,
  RefreshCw,
  Ban,
  UserCheck,
  X,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserDetailPanelProps {
  user: UserSearchResult;
  onAction: (action: string, userId: string, ...args: any[]) => Promise<void>;
  onClose: () => void;
}

export function UserDetailPanel({ user, onAction }: UserDetailPanelProps) {
  const [blockReason, setBlockReason] = useState('');

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{user.email}</CardTitle>
            <CardDescription>
              {user.name || 'No name provided'} {user.npi && `• NPI: ${user.npi}`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trust Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Trust Score</span>
            {user.trustScore !== undefined && (
              <Badge variant={user.trustScore >= 80 ? 'default' : user.trustScore >= 60 ? 'secondary' : 'destructive'}>
                {user.trustScore}
              </Badge>
            )}
          </div>
          {user.trustScore === undefined && (
            <p className="text-sm text-muted-foreground">Not calculated</p>
          )}
        </div>

        {/* Credential Count */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Credentials
            </span>
            <span className="text-sm font-semibold">{user.credentialCount}</span>
          </div>
        </div>

        {/* Chain Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Chain Status
            </span>
            <Badge
              variant={
                user.chainStatus === 'synced'
                  ? 'default'
                  : user.chainStatus === 'pending'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {user.chainStatus === 'synced' && <CheckCircle className="h-3 w-3 mr-1" />}
              {user.chainStatus === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
              {user.chainStatus}
            </Badge>
          </div>
        </div>

        {/* Compliance Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Compliance Status</span>
            <Badge
              variant={
                user.complianceStatus === 'compliant'
                  ? 'default'
                  : user.complianceStatus === 'warning'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {user.complianceStatus}
            </Badge>
          </div>
        </div>

        {/* Claim Level */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Claim Level</span>
            <Badge variant="outline">Level {user.claimLevel}</Badge>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Support Actions</h3>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAction('resendInvite', user.id)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Resend Invite
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAction('clearTasks', user.id)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Stuck Tasks
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAction('renewAnchors', user.id)}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Renew Chain Anchors
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAction('refreshCredentials', user.id)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Credentials
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAction('forceVerification', user.id)}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Force Verification Rerun
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              // Impersonation-safe "View as User" mode
              window.open(`/wallet?impersonate=${user.id}`, '_blank');
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            View as User (Safe Mode)
          </Button>
        </div>

        <Separator />

        {/* Security Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-destructive">Security Actions</h3>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start">
                <Ban className="h-4 w-4 mr-2" />
                Block User
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Block User</AlertDialogTitle>
                <AlertDialogDescription>
                  This will prevent the user from accessing the platform. Provide a reason for
                  blocking (fraud, abuse, etc.).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g., Fraud detected, Terms violation"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (blockReason.trim()) {
                      onAction('block', user.id, blockReason);
                      setBlockReason('');
                    }
                  }}
                  disabled={!blockReason.trim()}
                >
                  Block User
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
          <p>Created: {new Date(user.createdAt).toLocaleString()}</p>
          <p>User ID: {user.id}</p>
        </div>
      </CardContent>
    </Card>
  );
}

