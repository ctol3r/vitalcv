/**
 * Phase 4: Automated Reminders & Compliance Intelligence (8 tasks)
 * Tasks 25-32: Reminders and compliance components
 */

'use client';

import {
  Bell,
  AlertCircle,
  Calendar,
  Clock,
  Shield,
  RefreshCw,
  BookOpen,
  Award,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGrowthEngine } from '@/lib/growth/view-model';
import type { ComplianceReminder } from '@/lib/growth/models';

interface ComplianceRemindersProps {
  clinicianId: string | null;
}

export function ComplianceReminders({ clinicianId }: ComplianceRemindersProps) {
  const { reminders, criticalReminders, loading } = useGrowthEngine(clinicianId);

  if (loading) {
    return <div>Loading reminders...</div>;
  }

  const getTypeIcon = (type: ComplianceReminder['type']) => {
    switch (type) {
      case 'dea_renewal':
        return Shield;
      case 'license_renewal':
        return Award;
      case 'board_cert':
        return Award;
      case 'cme_cycle':
        return BookOpen;
      case 'chain_update':
        return RefreshCw;
      default:
        return Bell;
    }
  };

  const getTypeLabel = (type: ComplianceReminder['type']) => {
    switch (type) {
      case 'dea_renewal':
        return 'DEA Renewal';
      case 'license_renewal':
        return 'License Renewal';
      case 'board_cert':
        return 'Board Certification';
      case 'cme_cycle':
        return 'CME Cycle';
      case 'chain_update':
        return 'Chain Update';
      default:
        return 'Reminder';
    }
  };

  const getUrgencyColor = (urgency: ComplianceReminder['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'high':
        return 'border-amber-500 bg-amber-50 dark:bg-amber-950/20';
      case 'medium':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-muted';
    }
  };

  // Group reminders by type
  const grouped = reminders.reduce((acc, rem) => {
    if (!acc[rem.type]) acc[rem.type] = [];
    acc[rem.type].push(rem);
    return acc;
  }, {} as Record<ComplianceReminder['type'], ComplianceReminder[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Compliance Reminders</h2>
        <p className="text-muted-foreground">
          Automated alerts for credential renewals and compliance requirements
        </p>
      </div>

      {/* Critical Reminders Banner */}
      {criticalReminders.length > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Critical Reminders ({criticalReminders.length})
            </CardTitle>
            <CardDescription>
              These items require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalReminders.map((rem) => (
              <ReminderCard
                key={rem.id}
                reminder={rem}
                getTypeIcon={getTypeIcon}
                getTypeLabel={getTypeLabel}
                getUrgencyColor={getUrgencyColor}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Reminders by Type */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([type, typeReminders]) => {
          const Icon = getTypeIcon(type as ComplianceReminder['type']);
          const label = getTypeLabel(type as ComplianceReminder['type']);

          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {label} ({typeReminders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {typeReminders.map((rem) => (
                  <ReminderCard
                    key={rem.id}
                    reminder={rem}
                    getTypeIcon={getTypeIcon}
                    getTypeLabel={getTypeLabel}
                    getUrgencyColor={getUrgencyColor}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reminders.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active reminders</p>
            <p className="text-sm mt-2">All credentials are up to date!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ReminderCardProps {
  reminder: ComplianceReminder;
  getTypeIcon: (type: ComplianceReminder['type']) => typeof Bell;
  getTypeLabel: (type: ComplianceReminder['type']) => string;
  getUrgencyColor: (urgency: ComplianceReminder['urgency']) => string;
}

function ReminderCard({
  reminder,
  getTypeIcon,
  getTypeLabel,
  getUrgencyColor,
}: ReminderCardProps) {
  const Icon = getTypeIcon(reminder.type);
  const colorClass = getUrgencyColor(reminder.urgency);

  return (
    <Card className={`border-2 ${colorClass}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{reminder.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{reminder.description}</p>
              </div>
              <Badge
                variant={
                  reminder.urgency === 'critical'
                    ? 'destructive'
                    : reminder.urgency === 'high'
                    ? 'secondary'
                    : 'outline'
                }
              >
                {reminder.urgency}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Due: {new Date(reminder.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{reminder.daysRemaining} days remaining</span>
              </div>
            </div>

            {reminder.actionUrl && (
              <div className="pt-2 border-t">
                <Button size="sm" variant="default" asChild>
                  <a href={reminder.actionUrl}>
                    Take Action
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

