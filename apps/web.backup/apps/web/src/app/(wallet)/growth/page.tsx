/**
 * Career Growth Engine - Main Page
 * Integrates all 5 phases of the Career Growth Engine
 */

'use client';

import { useState, useEffect } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CareerGrowthDashboard } from './components/CareerGrowthDashboard';
import { RecommendationsView } from './components/RecommendationsView';
import { ComplianceReminders } from './components/ComplianceReminders';
import { CareerTimelineView } from './components/CareerTimelineView';
import { useGrowthEngine } from '@/lib/growth/view-model';

export default function GrowthPage() {
  // Get clinicianId from localStorage or context
  // In production, this would come from auth context
  const [clinicianId, setClinicianId] = useState<string | null>(null);

  useEffect(() => {
    // Try to get from localStorage (for demo)
    const storedId = localStorage.getItem('clinicianId');
    if (storedId) {
      setClinicianId(storedId);
    } else {
      // Try to get from session or API
      fetch('/api/profile/me')
        .then((res) => res.json())
        .then((data) => {
          if (data?.id || data?.clinicianId) {
            setClinicianId(data.id || data.clinicianId);
          }
        })
        .catch(() => {
          // Fallback: use demo ID
          setClinicianId('demo-clinician-001');
        });
    }
  }, []);

  const { profile, milestones, trustHistory } = useGrowthEngine(clinicianId);

  // Convert profile milestones to CareerMilestone format
  const careerMilestones = milestones || [];

  const handleExport = async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`/api/growth/export/${clinicianId}`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `career-growth-${clinicianId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Career Growth Engine
          </h1>
          <p className="text-muted-foreground mt-2">
            Intelligent, predictive, and trust-driven career development for clinicians
          </p>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={!clinicianId}>
          <Download className="h-4 w-4 mr-2" />
          Export Growth Data
        </Button>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Task 9-16: Career Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <CareerGrowthDashboard clinicianId={clinicianId} />
        </TabsContent>

        {/* Task 17-24: Personalized Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <RecommendationsView clinicianId={clinicianId} />
        </TabsContent>

        {/* Task 25-32: Automated Reminders & Compliance */}
        <TabsContent value="reminders" className="space-y-4">
          <ComplianceReminders clinicianId={clinicianId} />
        </TabsContent>

        {/* Task 33-40: Career Timeline & Inspiration */}
        <TabsContent value="timeline" className="space-y-4">
          <CareerTimelineView
            milestones={careerMilestones}
            trustHistory={trustHistory || []}
            currentTrustScore={profile?.trustScore || 0}
          />
        </TabsContent>
      </Tabs>

      {/* Deep Link Support - Task 32 */}
      <div className="text-xs text-muted-foreground text-center pt-4 border-t">
        <p>
          Access this page directly via:{' '}
          <code className="bg-muted px-2 py-1 rounded">vitalcv://growth</code>
        </p>
      </div>
    </div>
  );
}
