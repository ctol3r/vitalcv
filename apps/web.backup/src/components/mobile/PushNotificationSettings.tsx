/**
 * PushNotificationSettings UI Component
 * Task: B244C-MOF-027
 *
 * Allows users to opt in/out of push notifications per category
 * Updates PushNotificationRegistration
 * Includes explanatory text
 * Accessible forms
 */

'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  pushNotificationRegistration,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/services/PushNotificationRegistration';
import { cn } from '@/lib/utils';

export function PushNotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    pushNotificationRegistration.getPreferences(),
  );
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(pushNotificationRegistration.isSupported());
    setPermission(pushNotificationRegistration.getPermission());

    const unsubscribe = pushNotificationRegistration.subscribe((prefs) => {
      setPreferences(prefs);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRequestPermission = async () => {
    try {
      const result = await pushNotificationRegistration.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Register service worker and subscribe to push
        const registration = await pushNotificationRegistration.registerServiceWorker();
        if (registration) {
          await pushNotificationRegistration.subscribeToPush(registration);
          pushNotificationRegistration.setEnabled(true);
        }
      } else if (result === 'denied') {
        setError('Notification permission was denied. Please enable it in your browser settings.');
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      setError('Failed to request notification permission. Please try again.');
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    pushNotificationRegistration.setEnabled(enabled);
  };

  const handleToggleCategory = (category: NotificationCategory) => {
    pushNotificationRegistration.toggleCategory(category);
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>Push notifications are not supported in your browser.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const categories: Array<{ id: NotificationCategory; label: string; description: string }> = [
    {
      id: 'reminders',
      label: 'Reminders',
      description: 'Get notified about upcoming deadlines and important dates',
    },
    {
      id: 'alerts',
      label: 'Alerts',
      description: 'Receive critical alerts and urgent notifications',
    },
    {
      id: 'announcements',
      label: 'Announcements',
      description: 'Stay updated with platform announcements and updates',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {permission === 'granted' ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
          Push Notifications
        </CardTitle>
        <CardDescription>
          Manage your push notification preferences and categories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {permission !== 'granted' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Enable push notifications to receive updates even when the app is closed.
            </p>
            <Button onClick={handleRequestPermission} className="w-full sm:w-auto">
              Enable Notifications
            </Button>
          </div>
        )}

        {permission === 'granted' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-enabled" className="text-base font-medium">
                  Enable Push Notifications
                </Label>
                <Switch
                  id="notifications-enabled"
                  checked={preferences.enabled}
                  onCheckedChange={handleToggleEnabled}
                  aria-label="Enable push notifications"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Turn push notifications on or off for all categories
              </p>
            </div>

            {preferences.enabled && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-medium">Notification Categories</h3>
                {categories.map((category) => (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`category-${category.id}`}
                          className="text-sm font-medium"
                        >
                          {category.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                      <Switch
                        id={`category-${category.id}`}
                        checked={preferences.categories[category.id]}
                        onCheckedChange={() => handleToggleCategory(category.id)}
                        aria-label={`Enable ${category.label} notifications`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

