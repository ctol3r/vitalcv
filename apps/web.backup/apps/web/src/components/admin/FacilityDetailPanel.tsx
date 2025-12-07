'use client';

import { FacilitySearchResult } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Link2,
  CheckCircle,
  XCircle,
  Users,
  Settings,
  Snowflake,
  AlertCircle,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { adminFacilityApi } from '@/lib/admin/api';
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

interface FacilityDetailPanelProps {
  facility: FacilitySearchResult;
  onClose: () => void;
}

export function FacilityDetailPanel({ facility, onClose }: FacilityDetailPanelProps) {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      try {
        const data = await adminFacilityApi.getFacilityHealth(facility.id);
        setHealth(data);
      } catch (error) {
        console.error('Failed to fetch facility health:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, [facility.id]);

  const handleFreeze = async () => {
    if (!freezeReason.trim()) return;
    try {
      await adminFacilityApi.freezeFacility(facility.id, freezeReason);
      onClose();
    } catch (error) {
      console.error('Failed to freeze facility:', error);
    }
  };

  const handleUnfreeze = async () => {
    try {
      await adminFacilityApi.unfreezeFacility(facility.id);
      onClose();
    } catch (error) {
      console.error('Failed to unfreeze facility:', error);
    }
  };

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {facility.name}
            </CardTitle>
            <CardDescription className="capitalize">{facility.type}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Status</span>
            <Badge
              variant={
                facility.status === 'active'
                  ? 'default'
                  : facility.status === 'onboarding'
                  ? 'secondary'
                  : facility.status === 'frozen'
                  ? 'destructive'
                  : 'outline'
              }
            >
              {facility.status}
            </Badge>
          </div>
        </div>

        {/* Integration Health */}
        {health && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Integration Health</h3>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">API Uptime</span>
                <span className="text-sm font-medium">
                  {health.apiUptime?.toFixed(1) || 'N/A'}%
                </span>
              </div>
              {health.apiUptime !== undefined && (
                <Progress value={health.apiUptime} className="h-2" />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Chain Sync
                </span>
                <Badge
                  variant={
                    health.chainSync === 'synced'
                      ? 'default'
                      : health.chainSync === 'pending'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {health.chainSync === 'synced' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {health.chainSync === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                  {health.chainSync}
                </Badge>
              </div>
              {health.lastSyncAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last sync: {new Date(health.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  OIDC Configured
                </span>
                {health.oidcConfigured ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline">Not Configured</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Usage Stats */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Usage Statistics</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Users
              </span>
              <span className="text-sm font-medium">
                {facility.activeUsers} / {facility.seatCount}
              </span>
            </div>
            <Progress
              value={(facility.activeUsers / facility.seatCount) * 100}
              className="h-2"
            />
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Management Actions</h3>

          <Button variant="outline" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Edit Configuration
          </Button>

          <Button variant="outline" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Edit Requirements
          </Button>

          <Button variant="outline" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Edit Privilege Sets
          </Button>

          <Button variant="outline" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Manage Certificates
          </Button>
        </div>

        <Separator />

        {/* Security Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-destructive">Security Actions</h3>

          {facility.status === 'frozen' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Snowflake className="h-4 w-4 mr-2" />
                  Unfreeze Facility
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unfreeze Facility</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore access to the facility. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnfreeze}>Unfreeze</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start">
                  <Snowflake className="h-4 w-4 mr-2" />
                  Freeze Facility
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Freeze Facility</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will temporarily suspend access to the facility. Provide a reason.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="freeze-reason">Reason</Label>
                    <Input
                      id="freeze-reason"
                      value={freezeReason}
                      onChange={(e) => setFreezeReason(e.target.value)}
                      placeholder="e.g., Contract violation, security issue"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleFreeze}
                    disabled={!freezeReason.trim()}
                  >
                    Freeze Facility
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
          <p>Created: {new Date(facility.createdAt).toLocaleString()}</p>
          <p>Facility ID: {facility.id}</p>
        </div>
      </CardContent>
    </Card>
  );
}

