'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Bookmark,
  BookmarkCheck,
  Bell,
  BellRing,
  Trash2,
  Mail,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SavedSearch {
  id: string
  name: string
  query: string
  filters?: Record<string, string[]>
  alertEnabled: boolean
  alertFrequency: 'realtime' | 'daily' | 'weekly'
  notificationChannels: ('email' | 'in-app')[]
  createdAt: string
  lastTriggered?: string
  matchCount?: number
}

interface SavedSearchesProps {
  query?: string
  className?: string
}

export function SavedSearches({ query, className }: SavedSearchesProps) {
  const router = useRouter()
  const [savedSearches, setSavedSearches] = React.useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showSaveDialog, setShowSaveDialog] = React.useState(false)
  const [searchName, setSearchName] = React.useState('')
  const [alertEnabled, setAlertEnabled] = React.useState(false)
  const [alertFrequency, setAlertFrequency] = React.useState<'realtime' | 'daily' | 'weekly'>('daily')
  const [notificationChannels, setNotificationChannels] = React.useState<('email' | 'in-app')[]>(['email'])

  // Load saved searches
  React.useEffect(() => {
    loadSavedSearches()
  }, [])

  const loadSavedSearches = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/search/saved')
      if (response.ok) {
        const data = await response.json()
        setSavedSearches(data.searches || [])
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSearch = async () => {
    if (!query || !searchName.trim()) return

    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName,
          query,
          alertEnabled,
          alertFrequency,
          notificationChannels,
        }),
      })

      if (response.ok) {
        setShowSaveDialog(false)
        setSearchName('')
        setAlertEnabled(false)
        setAlertFrequency('daily')
        setNotificationChannels(['email'])
        loadSavedSearches()
      }
    } catch (error) {
      console.error('Failed to save search:', error)
    }
  }

  const handleDeleteSearch = async (id: string) => {
    try {
      const response = await fetch(`/api/search/saved/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadSavedSearches()
      }
    } catch (error) {
      console.error('Failed to delete search:', error)
    }
  }

  const handleToggleAlert = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/search/saved/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertEnabled: enabled }),
      })

      if (response.ok) {
        loadSavedSearches()
      }
    } catch (error) {
      console.error('Failed to update alert:', error)
    }
  }

  const handleRunSearch = (savedSearch: SavedSearch) => {
    const params = new URLSearchParams()
    params.set('q', savedSearch.query)
    if (savedSearch.filters) {
      Object.entries(savedSearch.filters).forEach(([key, values]) => {
        if (values.length > 0) {
          params.set(key, values.join(','))
        }
      })
    }
    router.push(`/search?${params.toString()}`)
  }

  const toggleNotificationChannel = (channel: 'email' | 'in-app') => {
    setNotificationChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    )
  }

  const isQuerySaved = query ? savedSearches.some(s => s.query === query) : false

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saved Searches</CardTitle>
          <CardDescription>
            Save searches and get notified when new results match
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Save Current Search */}
          {query && !isQuerySaved && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Save this search</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    &quot;{query}&quot;
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  variant="outline"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>

              {showSaveDialog && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <Label htmlFor="search-name">Search Name</Label>
                    <Input
                      id="search-name"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      placeholder="e.g., Cardiology Providers"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="alert-toggle">Email Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified when new results match
                      </p>
                    </div>
                    <Switch
                      id="alert-toggle"
                      checked={alertEnabled}
                      onCheckedChange={setAlertEnabled}
                    />
                  </div>

                  {alertEnabled && (
                    <>
                      <div>
                        <Label htmlFor="alert-frequency">Frequency</Label>
                        <Select value={alertFrequency} onValueChange={(value: any) => setAlertFrequency(value)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realtime">Real-time</SelectItem>
                            <SelectItem value="daily">Daily Digest</SelectItem>
                            <SelectItem value="weekly">Weekly Summary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Notification Channels</Label>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="notify-email"
                              checked={notificationChannels.includes('email')}
                              onChange={() => toggleNotificationChannel('email')}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="notify-email" className="flex items-center gap-1 cursor-pointer">
                              <Mail className="h-4 w-4" />
                              Email
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="notify-inapp"
                              checked={notificationChannels.includes('in-app')}
                              onChange={() => toggleNotificationChannel('in-app')}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="notify-inapp" className="flex items-center gap-1 cursor-pointer">
                              <Bell className="h-4 w-4" />
                              In-App
                            </Label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleSaveSearch} className="flex-1">
                      Save Search
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowSaveDialog(false)
                        setSearchName('')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Saved Searches List */}
          {savedSearches.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No saved searches yet
            </p>
          )}

          {savedSearches.map((savedSearch) => (
            <div
              key={savedSearch.id}
              className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <BookmarkCheck className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">{savedSearch.name}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  &quot;{savedSearch.query}&quot;
                </p>
                {savedSearch.matchCount !== undefined && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    {savedSearch.matchCount} matches
                  </Badge>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRunSearch(savedSearch)}
                    className="h-7 text-xs"
                  >
                    Run Search
                  </Button>
                  <div className="flex items-center gap-1">
                    {savedSearch.alertEnabled ? (
                      <BellRing className="h-3 w-3 text-primary" />
                    ) : (
                      <Bell className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {savedSearch.alertEnabled ? 'Alerts ON' : 'Alerts OFF'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleAlert(savedSearch.id, !savedSearch.alertEnabled)}
                  className="h-7 w-7 p-0"
                >
                  {savedSearch.alertEnabled ? (
                    <BellRing className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteSearch(savedSearch.id)}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

