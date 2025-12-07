'use client';

import { Bell, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { useRoleUX, type RoleUxConfig } from '@/contexts/RoleUXContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NotificationCenterProps {
  limit?: number;
}

export function NotificationCenter({ limit = 3 }: NotificationCenterProps) {
  const { config, loading } = useRoleUX();
  const notifications = useMemo(() => buildNotifications(config), [config]);

  if (!notifications.length) {
    return null;
  }

  return (
    <Card className="m-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Unified notifications
        </CardTitle>
        <Badge variant="outline">{loading ? 'Loading…' : `${notifications.length} events`}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {notifications.slice(0, limit).map((item) => (
          <div key={item.id} className="flex items-start gap-2 rounded-md border p-2">
            {item.severity === 'warning' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
            )}
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function buildNotifications(config: RoleUxConfig | null | undefined) {
  if (!config?.notifications) {
    return [];
  }
  const subs = config.notifications.subscriptions ?? [];
  return subs.map((subscription) => ({
    id: subscription,
    severity: subscription === 'trust' ? 'warning' : 'info',
    title:
      subscription === 'trust'
        ? 'Trust anchor dipped below policy floor'
        : subscription === 'observability'
          ? 'Chain health digest ready'
          : subscription === 'workforce'
            ? 'High-risk specialty flagged'
            : 'Workflow update',
    description:
      subscription === 'trust'
        ? 'Issuer requires additional verification before issuing new VCs.'
        : subscription === 'observability'
          ? 'Daily digest compiled across validators and AI guardrails.'
          : subscription === 'workforce'
            ? 'Supply gap detected; review optimization suggestions.'
            : 'New activity available in your notification feed.',
  }));
}

