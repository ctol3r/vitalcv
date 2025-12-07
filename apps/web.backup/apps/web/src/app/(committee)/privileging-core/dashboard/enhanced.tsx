/**
 * Enhanced Privileging Dashboard for Medical Staff Offices
 * Batch Bundle #28 - PRIV-006
 *
 * Features:
 * - Privilege status and expirations
 * - Pending tasks and required evidence
 * - PSV logs
 * - Compliance-risk indicators
 * - Exportable review packets
 * - Reappointment cycle tracking
 * - Procedure log summaries
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Calendar,
  Activity,
  BarChart3,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface PrivilegeStatus {
  providerId: string;
  name?: string;
  specialty: string;
  privileges: Array<{
    privilegeNodeId: string;
    privilegeName: string;
    status: 'ELIGIBLE' | 'ELIGIBLE_WITH_CONDITIONS' | 'NOT_ELIGIBLE' | 'PENDING_REVIEW';
    score?: number;
    expiresAt?: string;
    facilityId?: string;
  }>;
}

interface ReappointmentCycle {
  id: string;
  providerId: string;
  facilityId?: string;
  cycleStartDate: string;
  cycleEndDate: string;
  status: 'ACTIVE' | 'PENDING_REVIEW' | 'EXPIRED' | 'RENEWED' | 'TERMINATED';
  procedureVolumeMet: boolean;
  sanctionsCheckPassed: boolean;
  credentialsRenewed: boolean;
  autoRefreshEligible: boolean;
  committeeReviewRequired: boolean;
  nextReviewDate?: string;
}

interface PrivilegingPacket {
  id: string;
  providerId: string;
  facilityId?: string;
  packetType: 'INITIAL_APPLICATION' | 'REAPPOINTMENT' | 'ADDITIONAL_PRIVILEGES';
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PENDING_ADDITIONAL_INFO';
  generatedAt: string;
  submittedAt?: string;
}

interface DashboardStats {
  totalProviders: number;
  totalPrivileges: number;
  pendingReviews: number;
  expiringPrivileges: number;
  complianceRate: number;
  cyclesRequiringReview: number;
  pendingPackets: number;
}

export default function EnhancedPrivilegingDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [privilegeStatuses, setPrivilegeStatuses] = useState<PrivilegeStatus[]>([]);
  const [reappointmentCycles, setReappointmentCycles] = useState<ReappointmentCycle[]>([]);
  const [privilegingPackets, setPrivilegingPackets] = useState<PrivilegingPacket[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, [selectedFacility]);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // Load stats
      const statsRes = await fetch(
        `${API_BASE}/api/privileging/dashboard/stats?facilityId=${selectedFacility === 'all' ? '' : selectedFacility}`
      );
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Load privilege statuses
      const statusRes = await fetch(
        `${API_BASE}/api/privileging/status?facilityId=${selectedFacility === 'all' ? '' : selectedFacility}`
      );
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setPrivilegeStatuses(statusData.providers || []);
      }

      // Load reappointment cycles requiring review
      const cyclesRes = await fetch(
        `${API_BASE}/api/privileging/cycle/review?facilityId=${selectedFacility === 'all' ? '' : selectedFacility}`
      );
      if (cyclesRes.ok) {
        const cyclesData = await cyclesRes.json();
        setReappointmentCycles(cyclesData.cycles || []);
      }

      // Load pending packets
      const packetsRes = await fetch(
        `${API_BASE}/api/privileging/packet/pending?facilityId=${selectedFacility === 'all' ? '' : selectedFacility}`
      );
      if (packetsRes.ok) {
        const packetsData = await packetsRes.json();
        setPrivilegingPackets(packetsData.packets || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleExportPacket = async (packetId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/privileging/packet/${packetId}/export`, {
        method: 'POST',
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `privileging-packet-${packetId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export packet:', error);
      alert('Failed to export packet');
    }
  };

  const handleTriggerAutoRefresh = async (cycleId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/privileging/cycle/${cycleId}/refresh`, {
        method: 'POST',
      });
      if (response.ok) {
        await loadDashboardData();
        alert('Cycle auto-refreshed successfully');
      }
    } catch (error) {
      console.error('Failed to trigger auto-refresh:', error);
      alert('Failed to trigger auto-refresh');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="secondary">Medical Staff Office · Enhanced Privileging Dashboard</Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Privileging Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive view of privileges, reappointments, and compliance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFacility} onValueChange={setSelectedFacility}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facilities</SelectItem>
              <SelectItem value="facility-1">Main Hospital</SelectItem>
              <SelectItem value="facility-2">Outpatient Center</SelectItem>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Providers</p>
                  <p className="text-2xl font-bold">{stats.totalProviders}</p>
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
                  <p className="text-sm text-muted-foreground">Pending Reviews</p>
                  <p className="text-2xl font-bold">{stats.pendingReviews}</p>
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cycles Needing Review</p>
                  <p className="text-2xl font-bold">{stats.cyclesRequiringReview}</p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Packets</p>
                  <p className="text-2xl font-bold">{stats.pendingPackets}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reappointments">Reappointments</TabsTrigger>
          <TabsTrigger value="packets">Privileging Packets</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Privilege Status by Provider */}
          <Card>
            <CardHeader>
              <CardTitle>Privilege Status by Provider</CardTitle>
              <CardDescription>Current privilege eligibility and status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : privilegeStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No providers found</p>
              ) : (
                <div className="space-y-2">
                  {privilegeStatuses.map((provider) => (
                    <div
                      key={provider.providerId}
                      className="rounded-lg border p-3 hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {provider.name || provider.providerId.slice(0, 12)}...
                          </p>
                          <p className="text-xs text-muted-foreground">{provider.specialty}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {provider.privileges.map((priv) => {
                            const statusConfig = {
                              ELIGIBLE: { icon: CheckCircle2, color: 'text-green-600', label: 'Eligible' },
                              ELIGIBLE_WITH_CONDITIONS: { icon: AlertTriangle, color: 'text-amber-600', label: 'Conditional' },
                              NOT_ELIGIBLE: { icon: XCircle, color: 'text-red-600', label: 'Not Eligible' },
                              PENDING_REVIEW: { icon: Clock, color: 'text-blue-600', label: 'Pending' },
                            }[priv.status];
                            const Icon = statusConfig.icon;
                            return (
                              <div key={priv.privilegeNodeId} className="flex items-center gap-1" title={priv.privilegeName}>
                                <Icon className={`h-4 w-4 ${statusConfig.color}`} />
                                {priv.score !== undefined && (
                                  <span className="text-xs text-muted-foreground">{priv.score}%</span>
                                )}
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
        </TabsContent>

        <TabsContent value="reappointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reappointment Cycles Requiring Review</CardTitle>
              <CardDescription>2-year reappointment cycles needing attention</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : reappointmentCycles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cycles requiring review</p>
              ) : (
                <div className="space-y-2">
                  {reappointmentCycles.map((cycle) => (
                    <div key={cycle.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Provider: {cycle.providerId.slice(0, 12)}...</p>
                          <p className="text-xs text-muted-foreground">
                            Cycle: {new Date(cycle.cycleStartDate).toLocaleDateString()} - {new Date(cycle.cycleEndDate).toLocaleDateString()}
                          </p>
                          <div className="mt-2 flex gap-4">
                            <Badge variant={cycle.procedureVolumeMet ? 'default' : 'destructive'}>
                              Volume: {cycle.procedureVolumeMet ? 'Met' : 'Not Met'}
                            </Badge>
                            <Badge variant={cycle.sanctionsCheckPassed ? 'default' : 'destructive'}>
                              Sanctions: {cycle.sanctionsCheckPassed ? 'Clear' : 'Issues'}
                            </Badge>
                            <Badge variant={cycle.credentialsRenewed ? 'default' : 'destructive'}>
                              Credentials: {cycle.credentialsRenewed ? 'Renewed' : 'Expired'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {cycle.autoRefreshEligible ? (
                            <Button
                              size="sm"
                              onClick={() => handleTriggerAutoRefresh(cycle.id)}
                            >
                              Auto-Refresh
                            </Button>
                          ) : (
                            <Badge variant="outline">Review Required</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privileging Packets</CardTitle>
              <CardDescription>Review and export privileging packets</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : privilegingPackets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending packets</p>
              ) : (
                <div className="space-y-2">
                  {privilegingPackets.map((packet) => (
                    <div key={packet.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">Packet: {packet.id.slice(0, 12)}...</p>
                          <p className="text-xs text-muted-foreground">
                            Type: {packet.packetType} · Status: {packet.status}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Generated: {new Date(packet.generatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportPacket(packet.id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Risk Indicators</CardTitle>
              <CardDescription>Providers with compliance concerns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="font-medium text-amber-900">Expiring Privileges</p>
                  </div>
                  <p className="text-sm text-amber-700">
                    {stats?.expiringPrivileges || 0} privileges expiring within 45 days
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <p className="font-medium text-red-900">Non-Compliant Providers</p>
                  </div>
                  <p className="text-sm text-red-700">
                    {privilegeStatuses.filter(p =>
                      p.privileges.some(priv => priv.status === 'NOT_ELIGIBLE')
                    ).length} providers with non-eligible privileges
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

