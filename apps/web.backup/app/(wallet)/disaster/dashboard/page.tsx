'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Users, MapPin, Clock, Shield, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface EmergencyDeclaration {
  id: string;
  type: string;
  jurisdiction: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  source: string;
}

interface StaffingGap {
  specialty: string;
  needed: number;
  current: number;
}

interface EmergencyDashboard {
  activeDeclarations: EmergencyDeclaration[];
  activeOverrides: Array<{
    id: string;
    ruleType: string;
    expiresAt?: string;
  }>;
  staffingGaps: Record<string, number>;
  deploymentQueue: Array<{
    clinicianId: string;
    readinessScore: number;
  }>;
  provisionalPrivileges: Array<{
    id: string;
    clinicianId: string;
    facilityId: string;
    expiresAt: string;
    status: string;
  }>;
  timeline: Array<{
    event: string;
    timestamp: string;
    status: string;
  }>;
}

export default function EmergencyCommandCenterPage() {
  const [dashboard, setDashboard] = useState<EmergencyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [jurisdiction, setJurisdiction] = useState('CA');

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [jurisdiction]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/disaster/dashboard/${jurisdiction}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const data = await res.json();
      setDashboard(data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Emergency Data</AlertTitle>
          <AlertDescription>No active emergency declarations found for {jurisdiction}.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalGaps = Object.values(dashboard.staffingGaps).reduce((sum, count) => sum + count, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Emergency Command Center</h1>
          <p className="text-muted-foreground">Real-time disaster deployment monitoring</p>
        </div>
        <Badge variant={dashboard.activeDeclarations.length > 0 ? 'destructive' : 'secondary'}>
          {dashboard.activeDeclarations.length > 0 ? 'ACTIVE EMERGENCY' : 'STANDBY'}
        </Badge>
      </div>

      {/* Active Declarations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Active Emergency Declarations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.activeDeclarations.length === 0 ? (
            <p className="text-muted-foreground">No active declarations</p>
          ) : (
            <div className="space-y-2">
              {dashboard.activeDeclarations.map((declaration) => (
                <div key={declaration.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-semibold capitalize">{declaration.type}</div>
                    <div className="text-sm text-muted-foreground">
                      {declaration.jurisdiction} • {declaration.source}
                    </div>
                  </div>
                  <Badge variant="destructive">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staffing Gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Critical Staffing Gaps
          </CardTitle>
          <CardDescription>Total gaps: {totalGaps}</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(dashboard.staffingGaps).length === 0 ? (
            <p className="text-muted-foreground">No staffing gaps identified</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(dashboard.staffingGaps).map(([specialty, count]) => (
                <div key={specialty} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{specialty}</span>
                  <Badge variant="destructive">{count} needed</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Deployment Queue
          </CardTitle>
          <CardDescription>{dashboard.deploymentQueue.length} clinicians ready</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard.deploymentQueue.length === 0 ? (
            <p className="text-muted-foreground">No clinicians in deployment queue</p>
          ) : (
            <div className="space-y-2">
              {dashboard.deploymentQueue.slice(0, 10).map((candidate) => (
                <div key={candidate.clinicianId} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-mono text-sm">{candidate.clinicianId}</span>
                  <Badge>{Math.round(candidate.readinessScore)}% ready</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provisional Privileges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Provisional Privileges
          </CardTitle>
          <CardDescription>{dashboard.provisionalPrivileges.length} active</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard.provisionalPrivileges.length === 0 ? (
            <p className="text-muted-foreground">No provisional privileges issued</p>
          ) : (
            <div className="space-y-2">
              {dashboard.provisionalPrivileges.map((privilege) => (
                <div key={privilege.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-mono text-sm">{privilege.clinicianId}</div>
                    <div className="text-sm text-muted-foreground">
                      Expires: {new Date(privilege.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={privilege.status === 'active' ? 'default' : 'secondary'}>
                    {privilege.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dashboard.timeline.map((event, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <div className="font-medium">{event.event}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                </div>
                <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                  {event.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

