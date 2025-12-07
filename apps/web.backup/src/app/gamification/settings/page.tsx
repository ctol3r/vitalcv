'use client'

/**
 * B247C-GAM-028: GamificationSettings UI
 *
 * Allows users to opt in/out of leaderboards and notifications; updates preferences via API;
 * displays current settings; uses accessible forms; responsive design
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/design/Card'
import { Button } from '@/components/design/Button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Save, CheckCircle, AlertCircle } from 'lucide-react'

interface GamificationPreferences {
  leaderboardOptIn: boolean
  notificationsOptIn: boolean
}

export default function GamificationSettingsPage() {
  const [preferences, setPreferences] = useState<GamificationPreferences>({
    leaderboardOptIn: true,
    notificationsOptIn: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/gamification/preferences')
      if (response.ok) {
        const data = await response.json()
        setPreferences({
          leaderboardOptIn: data.leaderboardOptIn ?? true,
          notificationsOptIn: data.notificationsOptIn ?? true,
        })
      } else if (response.status === 404) {
        // No preferences exist yet, use defaults
        setPreferences({
          leaderboardOptIn: true,
          notificationsOptIn: true,
        })
      } else {
        throw new Error('Failed to load preferences')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('idle')
    setError(null)

    try {
      const response = await fetch('/api/gamification/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (key: keyof GamificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
    setSaveStatus('idle')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gamification Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences for leaderboards and notifications
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive bg-destructive/10">
          <div className="p-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Privacy & Visibility</h2>

          <div className="space-y-6">
            {/* Leaderboard Opt-in */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="leaderboard-opt-in" className="text-base font-medium cursor-pointer">
                  Show on Leaderboards
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Allow your rank and points to be visible on public leaderboards. If disabled, your
                  data will be anonymized.
                </p>
              </div>
              <Switch
                id="leaderboard-opt-in"
                checked={preferences.leaderboardOptIn}
                onCheckedChange={() => handleToggle('leaderboardOptIn')}
                aria-label="Show on leaderboards"
              />
            </div>

            {/* Notifications Opt-in */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label
                  htmlFor="notifications-opt-in"
                  className="text-base font-medium cursor-pointer"
                >
                  Reward Notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Receive notifications when you earn points or badges. You can still view your
                  rewards in the dashboard.
                </p>
              </div>
              <Switch
                id="notifications-opt-in"
                checked={preferences.notificationsOptIn}
                onCheckedChange={() => handleToggle('notificationsOptIn')}
                aria-label="Enable reward notifications"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Settings saved successfully</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">Failed to save settings</span>
                </div>
              )}
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Information Card */}
      <Card className="mt-6 bg-muted/50">
        <div className="p-6">
          <h3 className="font-semibold mb-2">About These Settings</h3>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>
              <strong>Leaderboard visibility:</strong> When disabled, your rank and points are
              hidden from public leaderboards, but you can still view your own progress privately.
            </li>
            <li>
              <strong>Notifications:</strong> Disabling notifications will stop toast/modal alerts
              for new rewards, but you can always check your dashboard for updates.
            </li>
            <li>
              Settings are saved automatically when you toggle switches. You can change these
              preferences at any time.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

