'use client';

/**
 * B141B-FE-006: Org audit export UI (select range & event types)
 *
 * Provides an interface for exporting audit logs with:
 * - Date range picker for selecting time period
 * - Multi-select checkboxes for event types
 * - Download options: CSV or NDJSON format
 * - PHI warning banner to remind users about data sensitivity
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, AlertTriangle, Calendar } from 'lucide-react';

interface EventType {
  id: string;
  name: string;
  description: string;
  category: string;
  includesPHI: boolean;
}

export default function AuditExportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'ndjson'>('csv');
  const [exporting, setExporting] = useState(false);

  const eventTypes: EventType[] = [
    {
      id: 'auth.login',
      name: 'User Login',
      description: 'User authentication events',
      category: 'Authentication',
      includesPHI: false,
    },
    {
      id: 'auth.logout',
      name: 'User Logout',
      description: 'User session termination events',
      category: 'Authentication',
      includesPHI: false,
    },
    {
      id: 'auth.failed',
      name: 'Failed Login Attempts',
      description: 'Unsuccessful authentication attempts',
      category: 'Authentication',
      includesPHI: false,
    },
    {
      id: 'role.assigned',
      name: 'Role Assignment',
      description: 'When roles are assigned to members',
      category: 'Access Control',
      includesPHI: false,
    },
    {
      id: 'role.removed',
      name: 'Role Removal',
      description: 'When roles are removed from members',
      category: 'Access Control',
      includesPHI: false,
    },
    {
      id: 'permission.changed',
      name: 'Permission Changes',
      description: 'Modifications to role permissions',
      category: 'Access Control',
      includesPHI: false,
    },
    {
      id: 'credential.viewed',
      name: 'Credential Viewed',
      description: 'Provider credentials accessed',
      category: 'Data Access',
      includesPHI: true,
    },
    {
      id: 'credential.verified',
      name: 'Credential Verified',
      description: 'Credential verification performed',
      category: 'Data Access',
      includesPHI: true,
    },
    {
      id: 'phi.accessed',
      name: 'PHI Accessed',
      description: 'Protected Health Information accessed',
      category: 'Data Access',
      includesPHI: true,
    },
    {
      id: 'config.changed',
      name: 'Configuration Changes',
      description: 'Organization settings modified',
      category: 'Configuration',
      includesPHI: false,
    },
    {
      id: 'policy.accepted',
      name: 'Policy Acceptance',
      description: 'Policy documents accepted by users',
      category: 'Compliance',
      includesPHI: false,
    },
    {
      id: 'export.created',
      name: 'Audit Export',
      description: 'Audit logs exported',
      category: 'Audit',
      includesPHI: false,
    },
  ];

  function toggleEventType(eventTypeId: string) {
    const newSelected = new Set(selectedEventTypes);
    if (newSelected.has(eventTypeId)) {
      newSelected.delete(eventTypeId);
    } else {
      newSelected.add(eventTypeId);
    }
    setSelectedEventTypes(newSelected);
  }

  function selectAllInCategory(category: string) {
    const categoryEvents = eventTypes.filter(et => et.category === category);
    const newSelected = new Set(selectedEventTypes);
    categoryEvents.forEach(et => newSelected.add(et.id));
    setSelectedEventTypes(newSelected);
  }

  function deselectAllInCategory(category: string) {
    const categoryEvents = eventTypes.filter(et => et.category === category);
    const newSelected = new Set(selectedEventTypes);
    categoryEvents.forEach(et => newSelected.delete(et.id));
    setSelectedEventTypes(newSelected);
  }

  async function handleExport() {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (selectedEventTypes.size === 0) {
      alert('Please select at least one event type');
      return;
    }

    try {
      setExporting(true);

      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/org/audit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          eventTypes: Array.from(selectedEventTypes),
          format: exportFormat,
        }),
      });

      if (!response.ok) throw new Error('Failed to export audit logs');

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-export-${startDate}-to-${endDate}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      alert('Failed to export audit logs. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // Check if any selected event types include PHI
  const selectedTypesIncludePHI = Array.from(selectedEventTypes).some(id => {
    const eventType = eventTypes.find(et => et.id === id);
    return eventType?.includesPHI;
  });

  // Group event types by category
  const eventsByCategory = eventTypes.reduce((acc, et) => {
    if (!acc[et.category]) {
      acc[et.category] = [];
    }
    acc[et.category].push(et);
    return acc;
  }, {} as Record<string, EventType[]>);

  const categories = Object.keys(eventsByCategory).sort();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Export Audit Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          Export audit events for compliance reporting and security analysis
        </p>
      </div>

      {/* PHI Warning */}
      {selectedTypesIncludePHI && (
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">
                  Protected Health Information (PHI) Warning
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">
                  Your export includes event types that may contain PHI. Please handle the exported data
                  in accordance with HIPAA regulations and your organization's data protection policies.
                  Ensure the export file is stored securely and access is limited to authorized personnel.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
          <CardDescription>
            Select the time period for your audit log export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="start-date" className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                aria-label="Start date for export"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end-date" className="text-sm font-medium">
                End Date
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                aria-label="End date for export"
              />
            </div>
          </div>
          {startDate && endDate && (
            <p className="text-sm text-muted-foreground mt-3">
              Exporting events from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Event Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
          <CardDescription>
            Select which event types to include in your export ({selectedEventTypes.size} selected)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((category) => {
            const categoryEvents = eventsByCategory[category];
            const allSelected = categoryEvents.every(et => selectedEventTypes.has(et.id));
            const someSelected = categoryEvents.some(et => selectedEventTypes.has(et.id));

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{category}</h3>
                  <div className="flex gap-2">
                    {!allSelected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectAllInCategory(category)}
                        className="h-7 text-xs"
                      >
                        Select All
                      </Button>
                    )}
                    {someSelected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deselectAllInCategory(category)}
                        className="h-7 text-xs"
                      >
                        Deselect All
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 pl-2 border-l-2 border-muted">
                  {categoryEvents.map((eventType) => (
                    <div
                      key={eventType.id}
                      className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`event-${eventType.id}`}
                        checked={selectedEventTypes.has(eventType.id)}
                        onCheckedChange={() => toggleEventType(eventType.id)}
                        aria-label={`Include ${eventType.name} events`}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`event-${eventType.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {eventType.name}
                          </label>
                          {eventType.includesPHI && (
                            <Badge variant="destructive" className="text-xs">
                              PHI
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {eventType.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Export Format */}
      <Card>
        <CardHeader>
          <CardTitle>Export Format</CardTitle>
          <CardDescription>
            Choose the file format for your export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div
              className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                exportFormat === 'csv'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => setExportFormat('csv')}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={exportFormat === 'csv'}
                  onCheckedChange={() => setExportFormat('csv')}
                  aria-label="Export as CSV"
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">CSV (Comma-Separated Values)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Best for viewing in spreadsheet applications like Excel. Easy to filter and analyze.
                  </p>
                </div>
              </div>
            </div>
            <div
              className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                exportFormat === 'ndjson'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => setExportFormat('ndjson')}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={exportFormat === 'ndjson'}
                  onCheckedChange={() => setExportFormat('ndjson')}
                  aria-label="Export as NDJSON"
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">NDJSON (Newline Delimited JSON)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Best for programmatic processing and log analysis tools. Preserves full event structure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Ready to Export</p>
              <p className="text-sm text-muted-foreground">
                {selectedEventTypes.size} event type{selectedEventTypes.size !== 1 ? 's' : ''} selected •
                {startDate && endDate ? ` ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` : ' No date range selected'} •
                {exportFormat.toUpperCase()} format
              </p>
            </div>
            <Button
              onClick={handleExport}
              disabled={!startDate || !endDate || selectedEventTypes.size === 0 || exporting}
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export Audit Logs'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

