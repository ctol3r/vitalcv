'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  Info,
  RefreshCw,
  Bell,
  Eye,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type CredentialLifecycleSettingsProps = {
  credentialId: string
  credentialName: string
  onSave?: (settings: LifecycleSettings) => Promise<void>
}

type LifecycleSettings = {
  autoRenewalEnabled: boolean
  renewalReminderDays: number[]
  revocationVisibility: 'public' | 'private' | 'organization'
  reminderChannels: ('email' | 'sms' | 'in_app')[]
}

const DEFAULT_SETTINGS: LifecycleSettings = {
  autoRenewalEnabled: false,
  renewalReminderDays: [90, 60, 30],
  revocationVisibility: 'organization',
  reminderChannels: ['email', 'in_app'],
}

export function CredentialLifecycleSettings({
  credentialId,
  credentialName,
  onSave,
}: CredentialLifecycleSettingsProps) {
  const [settings, setSettings] = useState<LifecycleSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newReminderDay, setNewReminderDay] = useState('')

  useEffect(() => {
    // Load settings from API
    const loadSettings = async () => {
      try {
        const response = await fetch(`/api/demo/lifecycle/credentials/${credentialId}/settings`)
        if (response.ok) {
          const data = await response.json()
          setSettings(data.settings || DEFAULT_SETTINGS)
        }
      } catch (error) {
        console.error('Failed to load lifecycle settings:', error)
      }
    }

    loadSettings()
  }, [credentialId])

  const toggleAutoRenewal = () => {
    setSettings((prev) => ({
      ...prev,
      autoRenewalEnabled: !prev.autoRenewalEnabled,
    }))
  }

  const toggleReminderChannel = (channel: 'email' | 'sms' | 'in_app') => {
    setSettings((prev) => ({
      ...prev,
      reminderChannels: prev.reminderChannels.includes(channel)
        ? prev.reminderChannels.filter((c) => c !== channel)
        : [...prev.reminderChannels, channel],
    }))
  }

  const addReminderDay = () => {
    const day = parseInt(newReminderDay)
    if (day > 0 && day <= 365 && !settings.renewalReminderDays.includes(day)) {
      setSettings((prev) => ({
        ...prev,
        renewalReminderDays: [...prev.renewalReminderDays, day].sort((a, b) => b - a),
      }))
      setNewReminderDay('')
    }
  }

  const removeReminderDay = (day: number) => {
    setSettings((prev) => ({
      ...prev,
      renewalReminderDays: prev.renewalReminderDays.filter((d) => d !== day),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      if (onSave) {
        await onSave(settings)
      } else {
        const response = await fetch(`/api/demo/lifecycle/credentials/${credentialId}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        })

        if (!response.ok) {
          throw new Error('Failed to save settings')
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save lifecycle settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Credential Lifecycle Settings
        </CardTitle>
        <CardDescription>
          Manage settings for <strong>{credentialName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-Renewal */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-medium">Auto-Renewal</Label>
                <Badge variant="outline" className="text-xs">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  <a
                    href="/lifecycle/education#auto-renewal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Learn more
                  </a>
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically submit renewal requests when credentials are approaching expiration
              </p>
            </div>
            <Switch checked={settings.autoRenewalEnabled} onCheckedChange={toggleAutoRenewal} />
          </div>
        </div>

        {/* Renewal Reminders */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Renewal Reminders</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Get notified when your credential is X days away from expiration
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {settings.renewalReminderDays.map((day) => (
                <Badge
                  key={day}
                  variant="outline"
                  className="flex items-center gap-1 bg-background"
                >
                  {day} days
                  <button
                    type="button"
                    onClick={() => removeReminderDay(day)}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Days before expiry"
                value={newReminderDay}
                onChange={(e) => setNewReminderDay(e.target.value)}
                min="1"
                max="365"
                className="max-w-32"
              />
              <Button variant="outline" size="sm" onClick={addReminderDay}>
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm text-muted-foreground">Reminder Channels</Label>
            <div className="flex gap-2">
              {(['email', 'sms', 'in_app'] as const).map((channel) => {
                const isSelected = settings.reminderChannels.includes(channel)
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggleReminderChannel(channel)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted',
                    )}
                  >
                    {channel.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Revocation Visibility */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Revocation Visibility</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Control who can see if this credential is revoked
            </p>
          </div>

          <Select
            value={settings.revocationVisibility}
            onValueChange={(value: 'public' | 'private' | 'organization') =>
              setSettings((prev) => ({ ...prev, revocationVisibility: value }))
            }
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public - Anyone can see revocation status</SelectItem>
              <SelectItem value="organization">
                Organization - Only your organization can see
              </SelectItem>
              <SelectItem value="private">Private - Only you can see</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-muted-foreground">
                Public visibility helps verifiers check credential status. Private visibility
                provides maximum privacy.
              </p>
              <a
                href="/lifecycle/education#revocation-visibility"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {saved && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

