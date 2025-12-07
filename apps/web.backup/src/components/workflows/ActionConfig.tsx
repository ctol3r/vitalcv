/**
 * ActionConfiguration UI
 *
 * Wizard-like UI to configure various actions (notification, API call, data transform);
 * shows required fields, provides previews, supports testing API calls
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, CheckCircle2, Loader2 } from 'lucide-react';
import type { ActionConfig } from './types';

interface ActionConfigProps {
  action: ActionConfig;
  onChange: (action: ActionConfig) => void;
}

export function ActionConfig({ action, onChange }: ActionConfigProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestApi = async () => {
    if (action.type !== 'external_api') return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/demo/workflows/test-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      setTestResult({
        success: response.ok,
        message: result.message || (response.ok ? 'API call successful' : 'API call failed'),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setTesting(false);
    }
  };

  if (action.type === 'external_api') {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-4 space-y-4">
          <div>
            <Label htmlFor="api-method">HTTP Method</Label>
            <Select
              value={action.method}
              onValueChange={(value: any) => onChange({ ...action, method: value })}
            >
              <SelectTrigger id="api-method" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="api-url">URL</Label>
            <Input
              id="api-url"
              value={action.url}
              onChange={(e) => onChange({ ...action, url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
              className="mt-1"
              type="url"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Full URL including protocol
            </p>
          </div>

          <div>
            <Label htmlFor="api-headers">Headers (JSON)</Label>
            <Textarea
              id="api-headers"
              value={action.headers ? JSON.stringify(action.headers, null, 2) : ''}
              onChange={(e) => {
                try {
                  const headers = e.target.value ? JSON.parse(e.target.value) : {};
                  onChange({ ...action, headers });
                } catch {
                  // Invalid JSON, keep as is
                }
              }}
              placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional HTTP headers as JSON object
            </p>
          </div>

          {(action.method === 'POST' || action.method === 'PUT' || action.method === 'PATCH') && (
            <div>
              <Label htmlFor="api-body">Request Body Template</Label>
              <Textarea
                id="api-body"
                value={action.bodyTemplate || ''}
                onChange={(e) => onChange({ ...action, bodyTemplate: e.target.value })}
                placeholder='{"userId": "{{context.userId}}", "data": "{{step1.result}}"}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">{{context.key}}</code> or <code className="bg-muted px-1 rounded">{{stepId.result}}</code> for templating
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="response-path">Response Path (Optional)</Label>
            <Input
              id="response-path"
              value={action.responsePath || ''}
              onChange={(e) => onChange({ ...action, responsePath: e.target.value || undefined })}
              placeholder="$.data.id"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              JSONPath to extract specific value from response
            </p>
          </div>

          <div>
            <Label htmlFor="store-context">Store in Context (Optional)</Label>
            <Input
              id="store-context"
              value={action.storeInContext || ''}
              onChange={(e) => onChange({ ...action, storeInContext: e.target.value || undefined })}
              placeholder="apiResponse"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Key to store response in workflow context for later steps
            </p>
          </div>

          <div className="pt-2 border-t">
            <Button
              variant="outline"
              onClick={handleTestApi}
              disabled={testing || !action.url}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Test API Call
                </>
              )}
            </Button>

            {testResult && (
              <div className={`mt-3 p-3 rounded-md flex items-start gap-2 ${
                testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.message}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (action.type === 'notification') {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-4 space-y-4">
          <div>
            <Label htmlFor="notification-channel">Channel</Label>
            <Select
              value={action.channel}
              onValueChange={(value: any) => onChange({ ...action, channel: value })}
            >
              <SelectTrigger id="notification-channel" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="in_app">In-App</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notification-template">Template</Label>
            <Textarea
              id="notification-template"
              value={action.template}
              onChange={(e) => onChange({ ...action, template: e.target.value })}
              placeholder="Hello {{user.name}}, your credential has been issued."
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">{{variable}}</code> for templating
            </p>
          </div>

          <div>
            <Label htmlFor="notification-recipients">Recipients</Label>
            <Textarea
              id="notification-recipients"
              value={action.recipients.join(', ')}
              onChange={(e) => {
                const recipients = e.target.value
                  .split(',')
                  .map(r => r.trim())
                  .filter(r => r.length > 0);
                onChange({ ...action, recipients });
              }}
              placeholder="user@example.com, +1234567890"
              rows={2}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of email addresses or phone numbers
            </p>
          </div>

          <div>
            <Label htmlFor="notification-personalization">Personalization (JSON)</Label>
            <Textarea
              id="notification-personalization"
              value={action.personalization ? JSON.stringify(action.personalization, null, 2) : ''}
              onChange={(e) => {
                try {
                  const personalization = e.target.value ? JSON.parse(e.target.value) : {};
                  onChange({ ...action, personalization });
                } catch {
                  // Invalid JSON
                }
              }}
              placeholder='{"user": {"name": "John"}, "org": {"name": "Acme"}}'
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional JSON object for template variables
            </p>
          </div>

          <div>
            <Label htmlFor="notification-locale">Locale (Optional)</Label>
            <Input
              id="notification-locale"
              value={action.locale || ''}
              onChange={(e) => onChange({ ...action, locale: e.target.value || undefined })}
              placeholder="en-US"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (action.type === 'data_transform') {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-4 space-y-4">
          <div>
            <Label htmlFor="transform-template">Transform Template</Label>
            <Textarea
              id="transform-template"
              value={action.template}
              onChange={(e) => onChange({ ...action, template: e.target.value })}
              placeholder='{"output": "{{input.value}}", "timestamp": "{{now}}"}'
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mustache/Handlebars template for data transformation
            </p>
          </div>

          <div>
            <Label htmlFor="transform-source">Source Mapping (JSON)</Label>
            <Textarea
              id="transform-source"
              value={JSON.stringify(action.source, null, 2)}
              onChange={(e) => {
                try {
                  const source = JSON.parse(e.target.value);
                  onChange({ ...action, source });
                } catch {
                  // Invalid JSON
                }
              }}
              placeholder='{"input": "{{step1.result}}", "context": "{{context.userId}}"}'
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Map source data to template variables
            </p>
          </div>

          <div>
            <Label htmlFor="transform-target">Target Key</Label>
            <Input
              id="transform-target"
              value={action.target}
              onChange={(e) => onChange({ ...action, target: e.target.value })}
              placeholder="transformedData"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Key to store transformed data in workflow context
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="transform-merge"
              checked={action.merge || false}
              onChange={(e) => onChange({ ...action, merge: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="transform-merge">Merge with existing context</Label>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
