/**
 * WorkflowStepEditor component
 *
 * Component to configure a single step: select action type, define parameters
 * (with JSON editor), set conditions; includes validation and helper docs
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { ActionConfig } from './ActionConfig';
import type { WorkflowStep, ActionConfig as ActionConfigType } from './types';
import { cn } from '@/lib/utils';

interface WorkflowStepEditorProps {
  step: WorkflowStep;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onClose?: () => void;
}

export function WorkflowStepEditor({ step, onUpdate, onClose }: WorkflowStepEditorProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (!step.name?.trim()) {
      errors.name = 'Step name is required';
    }

    if (!step.action) {
      errors.action = 'Action configuration is required';
    }

    if (step.onError === 'goto' && !step.gotoStep) {
      errors.gotoStep = 'Target step ID is required when using goto';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdate = (updates: Partial<WorkflowStep>) => {
    onUpdate(updates);
    // Re-validate after update
    setTimeout(() => validateStep(), 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Step: {step.name}</CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Name */}
        <div>
          <Label htmlFor="step-name">Step Name</Label>
          <Input
            id="step-name"
            value={step.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            placeholder="e.g., Send Notification"
            className="mt-1"
            aria-invalid={!!validationErrors.name}
          />
          {validationErrors.name && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validationErrors.name}
            </p>
          )}
        </div>

        {/* Action Configuration */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Label>Action Type</Label>
            <HelpCircle className="h-4 w-4 text-muted-foreground" title="Select the type of action this step will perform" />
          </div>
          <Select
            value={step.action?.type || 'external_api'}
            onValueChange={(value) => {
              let newAction: ActionConfigType;
              switch (value) {
                case 'external_api':
                  newAction = {
                    type: 'external_api',
                    method: 'POST',
                    url: '',
                  };
                  break;
                case 'notification':
                  newAction = {
                    type: 'notification',
                    channel: 'email',
                    template: '',
                    recipients: [],
                  };
                  break;
                case 'data_transform':
                  newAction = {
                    type: 'data_transform',
                    template: '',
                    source: {},
                    target: '',
                  };
                  break;
                default:
                  return;
              }
              handleUpdate({ action: newAction });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="external_api">External API Call</SelectItem>
              <SelectItem value="notification">Notification</SelectItem>
              <SelectItem value="data_transform">Data Transform</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.action && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validationErrors.action}
            </p>
          )}
        </div>

        {/* Action-Specific Configuration */}
        {step.action && (
          <ActionConfig
            action={step.action}
            onChange={(action) => handleUpdate({ action })}
          />
        )}

        {/* Condition */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Label htmlFor="condition">Condition (Optional)</Label>
            <HelpCircle className="h-4 w-4 text-muted-foreground" title="JavaScript expression to evaluate. Step runs only if condition is truthy." />
          </div>
          <Textarea
            id="condition"
            value={step.condition || ''}
            onChange={(e) => handleUpdate({ condition: e.target.value || undefined })}
            placeholder="e.g., context.user.role === 'admin'"
            rows={2}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use JavaScript expressions. Access workflow context via <code className="bg-muted px-1 rounded">context</code>
          </p>
        </div>

        {/* Error Handling */}
        <div>
          <Label htmlFor="on-error">On Error</Label>
          <Select
            value={step.onError || 'abort'}
            onValueChange={(value: 'continue' | 'abort' | 'goto') => {
              const updates: Partial<WorkflowStep> = { onError: value };
              if (value !== 'goto') {
                updates.gotoStep = undefined;
              }
              handleUpdate(updates);
            }}
          >
            <SelectTrigger id="on-error" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abort">Abort Workflow</SelectItem>
              <SelectItem value="continue">Continue to Next Step</SelectItem>
              <SelectItem value="goto">Go to Step</SelectItem>
            </SelectContent>
          </Select>

          {step.onError === 'goto' && (
            <div className="mt-2">
              <Label htmlFor="goto-step">Target Step ID</Label>
              <Input
                id="goto-step"
                value={step.gotoStep || ''}
                onChange={(e) => handleUpdate({ gotoStep: e.target.value })}
                placeholder="step-123"
                className="mt-1"
                aria-invalid={!!validationErrors.gotoStep}
              />
              {validationErrors.gotoStep && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.gotoStep}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Retry Policy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Retry Policy (Optional)</Label>
            {step.retryPolicy ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUpdate({ retryPolicy: undefined })}
              >
                Remove
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdate({
                  retryPolicy: {
                    type: 'fixed_interval',
                    maxAttempts: 3,
                    interval: 1000,
                    onFailure: 'abort',
                  },
                })}
              >
                Add Retry Policy
              </Button>
            )}
          </div>

          {step.retryPolicy && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label>Retry Type</Label>
                  <Select
                    value={step.retryPolicy.type}
                    onValueChange={(value: 'fixed_interval' | 'exponential_backoff' | 'max_attempts') => {
                      handleUpdate({
                        retryPolicy: {
                          ...step.retryPolicy,
                          type: value,
                        },
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_interval">Fixed Interval</SelectItem>
                      <SelectItem value="exponential_backoff">Exponential Backoff</SelectItem>
                      <SelectItem value="max_attempts">Max Attempts Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="max-attempts">Max Attempts</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min="1"
                    value={step.retryPolicy.maxAttempts}
                    onChange={(e) => handleUpdate({
                      retryPolicy: {
                        ...step.retryPolicy,
                        maxAttempts: parseInt(e.target.value) || 3,
                      },
                    })}
                    className="mt-1"
                  />
                </div>

                {(step.retryPolicy.type === 'fixed_interval' || step.retryPolicy.type === 'exponential_backoff') && (
                  <div>
                    <Label htmlFor="interval">Interval (ms)</Label>
                    <Input
                      id="interval"
                      type="number"
                      min="100"
                      value={step.retryPolicy.interval || 1000}
                      onChange={(e) => handleUpdate({
                        retryPolicy: {
                          ...step.retryPolicy,
                          interval: parseInt(e.target.value) || 1000,
                        },
                      })}
                      className="mt-1"
                    />
                  </div>
                )}

                {step.retryPolicy.type === 'exponential_backoff' && (
                  <div>
                    <Label htmlFor="backoff-multiplier">Backoff Multiplier</Label>
                    <Input
                      id="backoff-multiplier"
                      type="number"
                      min="1"
                      step="0.1"
                      value={step.retryPolicy.backoffMultiplier || 2}
                      onChange={(e) => handleUpdate({
                        retryPolicy: {
                          ...step.retryPolicy,
                          backoffMultiplier: parseFloat(e.target.value) || 2,
                        },
                      })}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Validation Status */}
        <div className="pt-4 border-t">
          {validateStep() ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Step configuration is valid</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Please fix validation errors above</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
