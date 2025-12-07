'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bell, Mail, MessageSquare, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type NotificationChannel = 'email' | 'sms' | 'in_app'

type NotificationEvent = 'expiring' | 'renewal' | 'revocation' | 'renewal_approved' | 'renewal_denied'

type NotificationPreference = {
  event: NotificationEvent
  channels: NotificationChannel[]
  enabled: boolean
}

type NotificationPreferencesProps = {
  userId?: string
  onSave?: (preferences: Record<NotificationEvent, NotificationPreference>) => Promise<void>
}

const EVENT_LABELS: Record<NotificationEvent, string> = {
  expiring: 'Credential Expiring',
  renewal: 'Renewal Request Submitted',
  revocation: 'Credential Revoked',
  renewal_approved: 'Renewal Approved',
  renewal_denied: 'Renewal Denied',
}

const EVENT_DESCRIPTIONS: Record<NotificationEvent, string> = {
  expiring: 'Get notified when your credentials are approaching expiration',
  renewal: 'Receive updates when you submit a renewal request',
  revocation: 'Be alerted immediately if any of your credentials are revoked',
  renewal_approved: 'Get notified when your renewal request is approved',
  renewal_denied: 'Receive notification if your renewal request is denied',
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-App',
}

// Mock initial preferences
const DEFAULT_PREFERENCES: Record<NotificationEvent, NotificationPreference> = {
  expiring: {
    event: 'expiring',
    channels: ['email', 'in_app'],
    enabled: true,
  },
  renewal: {
    event: 'renewal',
    channels: ['email', 'in_app'],
    enabled: true,
  },
  revocation: {
    event: 'revocation',
    channels: ['email', 'sms', 'in_app'],
    enabled: true,
  },
  renewal_approved: {
    event: 'renewal_approved',
    channels: ['email', 'in_app'],
    enabled: true,
  },
  renewal_denied: {
    event: 'renewal_denied',
    channels: ['email', 'in_app'],
    enabled: true,
  },
}

export function NotificationPreferences({ userId, onSave }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<Record<NotificationEvent, NotificationPreference>>(
    DEFAULT_PREFERENCES,
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load preferences from API
    const loadPreferences = async () => {
      try {
        const response = await fetch(`/api/demo/user/settings/notifications${userId ? `?userId=${userId}` : ''}`)
        if (response.ok) {
          const data = await response.json()
          setPreferences(data.preferences || DEFAULT_PREFERENCES)
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error)
      }
    }

    loadPreferences()
  }, [userId])

  const toggleEvent = (event: NotificationEvent) => {
    setPreferences((prev) => ({
      ...prev,
      [event]: {
        ...prev[event],
        enabled: !prev[event].enabled,
      },
    }))
  }

  const toggleChannel = (event: NotificationEvent, channel: NotificationChannel) => {
    setPreferences((prev) => {
      const eventPref = prev[event]
      const channels = eventPref.channels.includes(channel)
        ? eventPref.channels.filter((c) => c !== channel)
        : [...eventPref.channels, channel]

      return {
        ...prev,
        [event]: {
          ...eventPref,
          channels,
        },
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      if (onSave) {
        await onSave(preferences)
      } else {
        // Default save - call API
        const response = await fetch('/api/demo/user/settings/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
        })

        if (!response.ok) {
          throw new Error('Failed to save preferences')
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const getChannelIcon = (channel: NotificationChannel) => {
    switch (channel) {
      case 'email':
        return Mail
      case 'sms':
        return MessageSquare
      case 'in_app':
        return Bell
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how and when you want to be notified about credential lifecycle events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(preferences).map(([event, pref]) => {
          const eventKey = event as NotificationEvent
          const Icon = getChannelIcon('email')

          return (
            <div key={event} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-medium">{EVENT_LABELS[eventKey]}</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">{EVENT_DESCRIPTIONS[eventKey]}</p>
                </div>
                <Switch
                  checked={pref.enabled}
                  onCheckedChange={() => toggleEvent(eventKey)}
                />
              </div>

              {pref.enabled && (
                <div className="space-y-3 pl-6 border-l-2 border-muted">
                  <Label className="text-sm text-muted-foreground">Notification Channels</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['email', 'sms', 'in_app'] as NotificationChannel[]).map((channel) => {
                      const ChannelIcon = getChannelIcon(channel)
                      const isSelected = pref.channels.includes(channel)

                      return (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => toggleChannel(eventKey, channel)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted',
                          )}
                        >
                          <ChannelIcon className="h-3 w-3" />
                          {CHANNEL_LABELS[channel]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>Changes are saved automatically</span>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

