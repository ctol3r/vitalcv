'use client'

import { useState } from 'react'
import { Bell, Mail, Smartphone, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type NotificationCategory = {
  id: string
  name: string
  description: string
  email: boolean
  inApp: boolean
}

type NotificationPreferencesData = {
  categories: NotificationCategory[]
}

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferencesData>(() => buildMockPreferences())
  const [saved, setSaved] = useState(false)

  const handleToggle = (categoryId: string, type: 'email' | 'inApp') => {
    setPreferences((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              [type]: !cat[type],
            }
          : cat,
      ),
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    // TODO: Implement save to backend
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Notification Preferences
        </h2>
        <p className="text-muted-foreground">
          Manage your notification preferences for career development updates, course recommendations, mentorship suggestions, and credential expirations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Career Development Notifications</CardTitle>
          <CardDescription>
            Choose how you want to receive notifications about your career development activities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {preferences.categories.map((category) => (
            <div key={category.id} className="space-y-4 border-b pb-6 last:border-0 last:pb-0">
              <div className="space-y-1">
                <h3 className="font-semibold">{category.name}</h3>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor={`${category.id}-email`} className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id={`${category.id}-email`}
                    checked={category.email}
                    onCheckedChange={() => handleToggle(category.id, 'email')}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor={`${category.id}-inapp`} className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      In-App Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show notifications in the app
                    </p>
                  </div>
                  <Switch
                    id={`${category.id}-inapp`}
                    checked={category.inApp}
                    onCheckedChange={() => handleToggle(category.id, 'inApp')}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Changes are saved automatically. You can update these preferences at any time.
        </div>
        <Button onClick={handleSave} disabled={saved}>
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>

      {/* Notification Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Summary</CardTitle>
          <CardDescription>Overview of your current notification settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Email Notifications</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {preferences.categories
                  .filter((cat) => cat.email)
                  .map((cat) => (
                    <Badge key={cat.id} variant="secondary">
                      {cat.name}
                    </Badge>
                  ))}
                {preferences.categories.filter((cat) => cat.email).length === 0 && (
                  <span className="text-sm text-muted-foreground">None enabled</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">In-App Notifications</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {preferences.categories
                  .filter((cat) => cat.inApp)
                  .map((cat) => (
                    <Badge key={cat.id} variant="secondary">
                      {cat.name}
                    </Badge>
                  ))}
                {preferences.categories.filter((cat) => cat.inApp).length === 0 && (
                  <span className="text-sm text-muted-foreground">None enabled</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function buildMockPreferences(): NotificationPreferencesData {
  return {
    categories: [
      {
        id: 'course-recommendations',
        name: 'Course Recommendations',
        description: 'Get notified about training courses that match your specialty and career goals.',
        email: true,
        inApp: true,
      },
      {
        id: 'mentorship-suggestions',
        name: 'Mentorship Suggestions',
        description: 'Receive suggestions for potential mentors based on your profile and interests.',
        email: true,
        inApp: true,
      },
      {
        id: 'credential-expiration',
        name: 'Credential Expiration',
        description: 'Alerts when your credentials are approaching expiration dates.',
        email: true,
        inApp: true,
      },
      {
        id: 'training-credits',
        name: 'Training Credits',
        description: 'Notifications about available training credits and credit expiration.',
        email: false,
        inApp: true,
      },
      {
        id: 'career-opportunities',
        name: 'Career Opportunities',
        description: 'Updates about job opportunities and career advancement programs.',
        email: true,
        inApp: false,
      },
      {
        id: 'achievements',
        name: 'Achievements & Milestones',
        description: 'Celebrate your career milestones and completed certifications.',
        email: false,
        inApp: true,
      },
    ],
  }
}

