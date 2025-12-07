/**
 * Facility Privileging Engine - Privileging Dashboard
 * Phase 4: Hospital Privileging Dashboard for MSO
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { PrivilegeRequest } from '@/lib/privileging/models';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface ClinicianPrivilegeStatus {
  clinicianId: string;
  name?: string;
  specialty: string;
  privileges: Array<{
    code: string;
    name: string;
    status: 'granted' | 'pending' | 'expiring' | 'expired';
    grantedAt?: string;
    expiresAt?: string;
    complianceScore: number;
  }>;
}

interface DashboardStats {
  totalClinicians: number;
  totalPrivileges: number;
  pendingRequests: number;
  expiringPrivileges: number;
  complianceRate: number;
}

export default function PrivilegingDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [clinicians, setClinicians] = useState<ClinicianPrivilegeStatus[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PrivilegeRequest[]>([]);
  const [expiringPrivileges, setExpiringPrivileges] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [selectedUnit]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [statsRes, cliniciansRes, requestsRes, expiringRes] = await Promise.all([
        fetch(`${API_BASE}/api/facility/privileges/dashboard/stats?unit=${selectedUnit}`),
        fetch(`${API_BASE}/api/facility/privileges/dashboard/clinicians?unit=${selectedUnit}`),
        fetch(`${API_BASE}/api/facility/privileges/requests?status=pending`),
        fetch(`${API_BASE}/api/facility/privileges/expiring`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (cliniciansRes.ok) {
        const cliniciansData = await cliniciansRes.json();
        setClinicians(cliniciansData.clinicians || []);
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setPendingRequests(requestsData.requests || []);
      }

      if (expiringRes.ok) {
        const expiringData = await expiringRes.json();
        setExpiringPrivileges(expiringData.privileges || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const units = ['all', 'Cardiology', 'ICU', 'OR', 'Psychiatry'];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="secondary">Medical Staff Office · Privileging Dashboard</Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Privileging Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive view of all clinician privileges and compliance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit === 'all' ? 'All Units' : unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDashboardData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clinicians</p>
                  <p className="text-2xl font-bold">{stats.totalClinicians}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Privileges</p>
                  <p className="text-2xl font-bold">{stats.totalPrivileges}</p>
                </div>
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Requests</p>
                  <p className="text-2xl font-bold">{stats.pendingRequests}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  <p className="text-2xl font-bold">{stats.expiringPrivileges}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Rate</p>
                  <p className="text-2xl font-bold">{stats.complianceRate}%</p>
                </div>
                {stats.complianceRate >= 90 ? (
                  <TrendingUp className="h-8 w-8 text-green-500" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clinician Roster */}
        <Card>
          <CardHeader>
            <CardTitle>Clinician Roster</CardTitle>
            <CardDescription>Privilege status by clinician</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : clinicians.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clinicians found</p>
            ) : (
              <div className="space-y-2">
                {clinicians.map((clinician) => (
                  <div
                    key={clinician.clinicianId}
                    className="rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {clinician.name || clinician.clinicianId.slice(0, 12)}...
                        </p>
                        <p className="text-xs text-muted-foreground">{clinician.specialty}</p>
                      </div>
                      <div className="flex gap-1">
                        {clinician.privileges.map((priv) => {
                          const statusIcon = {
                            granted: <CheckCircle2 className="h-4 w-4 text-green-600" />,
                            pending: <Clock className="h-4 w-4 text-amber-600" />,
                            expiring: <AlertTriangle className="h-4 w-4 text-amber-600" />,
                            expired: <XCircle className="h-4 w-4 text-red-600" />,
                          }[priv.status];
                          return (
                            <div key={priv.code} className="flex items-center gap-1" title={priv.name}>
                              {statusIcon}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Privileges Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Privileges Queue</CardTitle>
            <CardDescription>{pendingRequests.length} requests awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{request.privilegeCode}</p>
                        <p className="text-xs text-muted-foreground">
                          Clinician: {request.clinicianId.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={
                          request.readinessScore >= 80
                            ? 'default'
                            : request.readinessScore >= 60
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {request.readinessScore}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring Privileges Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Expiring Privileges Alerts</CardTitle>
          <CardDescription>
            Privileges expiring within the next 45 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : expiringPrivileges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expiring privileges</p>
          ) : (
            <div className="space-y-2">
              {expiringPrivileges.map((privilege) => (
                <div
                  key={privilege.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{privilege.privilegeCode}</p>
                    <p className="text-xs text-muted-foreground">
                      Clinician: {privilege.clinicianId.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-amber-700">
                      Expires: {new Date(privilege.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-amber-500 text-amber-700">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Expiring
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privilege by Unit Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Privilege by Unit Breakdown</CardTitle>
          <CardDescription>Distribution of privileges across facility units</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {['Cardiology', 'ICU', 'OR', 'Psychiatry'].map((unit) => (
              <div key={unit} className="rounded-lg border p-4">
                <p className="text-sm font-medium">{unit}</p>
                <p className="text-2xl font-bold mt-2">
                  {clinicians.filter((c) => c.specialty === unit).length}
                </p>
                <p className="text-xs text-muted-foreground">clinicians</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batch Verification - Phase 4 Task 31 */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Privilege Verification</CardTitle>
          <CardDescription>Verify privileges for multiple clinicians at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select multiple clinicians to verify their privileges in batch.
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                // TODO: Implement batch verification
                alert('Batch verification feature - backend integration needed');
              }}
            >
              Start Batch Verification
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log - Phase 4 Task 32 */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>History of all privileging decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              View complete audit trail of all privileging decisions, approvals, and denials.
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                // TODO: Load audit log
                const response = await fetch(`${API_BASE}/api/facility/privileges/audit`);
                if (response.ok) {
                  const data = await response.json();
                  console.log('Audit log:', data);
                  alert(`Loaded ${data.events?.length || 0} audit events`);
                } else {
                  alert('Failed to load audit log - backend integration needed');
                }
              }}
            >
              View Full Audit Log
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

