/**
 * TriggerConfiguration UI
 *
 * Allows users to configure event/cron/webhook triggers: choose event types,
 * set cron schedules with helper; validates syntax; displays next run time estimate
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Webhook, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { TriggerConfig } from './types';

interface TriggerConfigProps {
  trigger: TriggerConfig | null;
  onSave: (trigger: TriggerConfig) => void;
  onClose: () => void;
}

export function TriggerConfig({ trigger, onSave, onClose }: TriggerConfigProps) {
  const [triggerType, setTriggerType] = useState<'event' | 'cron' | 'webhook'>(
    trigger?.type || 'event'
  );
  const [eventType, setEventType] = useState(trigger?.type === 'event' ? trigger.eventType : '');
  const [cronExpression, setCronExpression] = useState(trigger?.type === 'cron' ? trigger.expression : '0 0 * * *');
  const [timezone, setTimezone] = useState(trigger?.type === 'cron' ? trigger.timezone : 'UTC');
  const [webhookPath, setWebhookPath] = useState(trigger?.type === 'webhook' ? trigger.path : '/webhook');
  const [webhookMethod, setWebhookMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>(
    trigger?.type === 'webhook' ? trigger.method : 'POST'
  );
  const [webhookSecret, setWebhookSecret] = useState(trigger?.type === 'webhook' ? trigger.secret : '');
  const [eventFilters, setEventFilters] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [nextRunTime, setNextRunTime] = useState<string>('');

  // Common cron presets
  const cronPresets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every week (Monday)', value: '0 0 * * 1' },
    { label: 'Every month (1st)', value: '0 0 1 * *' },
  ];

  // Validate cron expression
  useEffect(() => {
    if (triggerType === 'cron' && cronExpression) {
      const cronParts = cronExpression.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        setValidationError('Cron expression must have 5 parts: minute hour day month weekday');
        setNextRunTime('');
        return;
      }

      // Basic validation
      const isValid = cronParts.every((part, index) => {
        if (part === '*') return true;
        const num = parseInt(part);
        const ranges = [
          { min: 0, max: 59 },   // minute
          { min: 0, max: 23 },   // hour
          { min: 1, max: 31 },   // day
          { min: 1, max: 12 },   // month
          { min: 0, max: 6 },    // weekday
        ];
        return !isNaN(num) && num >= ranges[index].min && num <= ranges[index].max;
      });

      if (!isValid) {
        setValidationError('Invalid cron expression format');
        setNextRunTime('');
        return;
      }

      setValidationError('');
      // Calculate next run time (simplified)
      const now = new Date();
      const nextRun = new Date(now.getTime() + 60000); // Simple: next minute
      setNextRunTime(`Estimated next run: ${nextRun.toLocaleString()}`);
    } else if (triggerType === 'cron') {
      setValidationError('');
      setNextRunTime('');
    }
  }, [cronExpression, triggerType]);

  const handleSave = () => {
    let newTrigger: TriggerConfig;

    if (triggerType === 'event') {
      if (!eventType.trim()) {
        setValidationError('Event type is required');
        return;
      }
      newTrigger = {
        type: 'event',
        eventType: eventType.trim(),
        filters: eventFilters ? JSON.parse(eventFilters) : undefined,
      };
    } else if (triggerType === 'cron') {
      if (!cronExpression.trim()) {
        setValidationError('Cron expression is required');
        return;
      }
      if (validationError) {
        return;
      }
      newTrigger = {
        type: 'cron',
        expression: cronExpression.trim(),
        timezone: timezone || undefined,
      };
    } else {
      if (!webhookPath.trim()) {
        setValidationError('Webhook path is required');
        return;
      }
      newTrigger = {
        type: 'webhook',
        path: webhookPath.trim(),
        method: webhookMethod,
        secret: webhookSecret || undefined,
      };
    }

    onSave(newTrigger);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Trigger</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trigger Type Selection */}
          <div>
            <Label>Trigger Type</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setTriggerType('event')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  triggerType === 'event' ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <Zap className="h-5 w-5 mb-2" />
                <div className="font-medium">Event</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Trigger on system events
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTriggerType('cron')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  triggerType === 'cron' ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <Clock className="h-5 w-5 mb-2" />
                <div className="font-medium">Cron</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Scheduled execution
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTriggerType('webhook')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  triggerType === 'webhook' ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <Webhook className="h-5 w-5 mb-2" />
                <div className="font-medium">Webhook</div>
                <div className="text-xs text-muted-foreground mt-1">
                  HTTP endpoint trigger
                </div>
              </button>
            </div>
          </div>

          {/* Event Trigger Configuration */}
          {triggerType === 'event' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-type">Event Type</Label>
                <Input
                  id="event-type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="e.g., user.created, credential.issued"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use dot notation: <code className="bg-muted px-1 rounded">category.action</code>
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="event-filters">Event Filters (Optional)</Label>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" title="JSON object to filter events by payload properties" />
                </div>
                <Textarea
                  id="event-filters"
                  value={eventFilters}
                  onChange={(e) => setEventFilters(e.target.value)}
                  placeholder='{"userId": "123", "orgId": "abc"}'
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JSON object. Event must match all specified properties.
                </p>
              </div>
            </div>
          )}

          {/* Cron Trigger Configuration */}
          {triggerType === 'cron' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cron-expression">Cron Expression</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="cron-expression"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 0 * * *"
                    className="font-mono"
                    aria-invalid={!!validationError}
                  />
                  <Select
                    value={cronExpression}
                    onValueChange={setCronExpression}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Presets" />
                    </SelectTrigger>
                    <SelectContent>
                      {cronPresets.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Format: <code className="bg-muted px-1 rounded">minute hour day month weekday</code>
                </p>
                {validationError && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationError}
                  </p>
                )}
                {nextRunTime && !validationError && (
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {nextRunTime}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="timezone">Timezone (Optional)</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  IANA timezone name (e.g., America/New_York)
                </p>
              </div>
            </div>
          )}

          {/* Webhook Trigger Configuration */}
          {triggerType === 'webhook' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="webhook-path">Webhook Path</Label>
                <Input
                  id="webhook-path"
                  value={webhookPath}
                  onChange={(e) => setWebhookPath(e.target.value)}
                  placeholder="/webhook/my-workflow"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL path for the webhook endpoint
                </p>
              </div>

              <div>
                <Label htmlFor="webhook-method">HTTP Method</Label>
                <Select value={webhookMethod} onValueChange={(value: any) => setWebhookMethod(value)}>
                  <SelectTrigger id="webhook-method" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="webhook-secret">Secret (Optional)</Label>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" title="Secret for webhook signature verification" />
                </div>
                <Input
                  id="webhook-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="webhook-secret-key"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to verify webhook authenticity
                </p>
              </div>
            </div>
          )}

          {validationError && triggerType !== 'cron' && (
            <div className="p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {validationError}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Trigger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
