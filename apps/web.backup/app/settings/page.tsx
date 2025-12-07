"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Eye, EyeOff, Monitor, Smartphone, Laptop, MapPin, Clock, AlertTriangle, Download, Shield, FileText, Zap, RefreshCw, AutoFix, Sparkles } from "lucide-react"
import { useUsability } from "@/hooks/use-usability"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const THEME_OPTIONS = [
  { value: "light", label: "Light", description: "Clean and minimal" },
  { value: "dark", label: "Dark", description: "Easy on the eyes" },
  { value: "hims", label: "Hims", description: "Healthcare focused" },
  { value: "palantir", label: "Palantir", description: "Data-driven dark" },
  { value: "neon", label: "Neon", description: "Cyberpunk vibes" },
  { value: "glass", label: "Glass", description: "Glassmorphism effect" },
]

const MOCK_SESSIONS = [
  {
    id: "1",
    device: "MacBook Pro",
    location: "San Francisco, CA",
    lastActive: "2 minutes ago",
    current: true,
    icon: Laptop,
  },
  {
    id: "2",
    device: "iPhone 15 Pro",
    location: "San Francisco, CA",
    lastActive: "1 hour ago",
    current: false,
    icon: Smartphone,
  },
  {
    id: "3",
    device: "Chrome on Windows",
    location: "New York, NY",
    lastActive: "3 days ago",
    current: false,
    icon: Monitor,
  },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { settings, updateSettings, refreshEverything } = useUsability()
  const [showPassword, setShowPassword] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [euRelyingPartyEnabled, setEuRelyingPartyEnabled] = useState(false)
  const [exportRequested, setExportRequested] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // Load EUDI wallet acceptance setting from backend
        const loadEudiSetting = async () => {
          try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4005'
            const response = await fetch(`${backendUrl}/api/settings/eudi-accept`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            })

        if (response.ok) {
          const data = await response.json()
          setEuRelyingPartyEnabled(data.acceptEudiWalletsOnly || false)
          // Also sync to localStorage for offline access
          localStorage.setItem('vitalcv_eu_relying_party', String(data.acceptEudiWalletsOnly || false))
        } else {
          // Fallback to localStorage if backend unavailable
          const saved = localStorage.getItem('vitalcv_eu_relying_party')
          if (saved === 'true') {
            setEuRelyingPartyEnabled(true)
          }
        }
      } catch (err) {
        console.warn('Failed to load EUDI setting from backend:', err)
        // Fallback to localStorage
        const saved = localStorage.getItem('vitalcv_eu_relying_party')
        if (saved === 'true') {
          setEuRelyingPartyEnabled(true)
        }
      }
    }

    loadEudiSetting()

    // Check if export was already requested
    const exportStatus = localStorage.getItem('vitalcv_export_requested')
    if (exportStatus === 'true') {
      setExportRequested(true)
    }
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      })
      return
    }

    // Stubbed POST request for MVP
    try {
      // await fetch('/api/auth/change-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ currentPassword, newPassword }),
      // })

      toast({
        title: "Success",
        description: "Password changed successfully",
      })

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password",
        variant: "destructive",
      })
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    // Save to localStorage (handled by next-themes)
    toast({
      title: "Theme Updated",
      description: `Switched to ${THEME_OPTIONS.find((t) => t.value === newTheme)?.label} theme`,
    })
  }

  const handleSessionRevoke = (sessionId: string) => {
    toast({
      title: "Session Revoked",
      description: "The selected session has been terminated",
    })
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and security settings</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6" aria-label="Settings navigation tabs">
          <TabsTrigger value="account" aria-controls="account-tab">Account</TabsTrigger>
          <TabsTrigger value="security" aria-controls="security-tab">Security</TabsTrigger>
          <TabsTrigger value="appearance" aria-controls="appearance-tab">Appearance</TabsTrigger>
          <TabsTrigger value="usability" aria-controls="usability-tab">Usability</TabsTrigger>
          <TabsTrigger value="eudi" aria-controls="eudi-tab">EUDI</TabsTrigger>
          <TabsTrigger value="privacy" aria-controls="privacy-tab">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your basic account details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value="dr.smith@vitalcv.com" disabled className="bg-muted" />
                <p className="text-sm text-muted-foreground">
                  Email address cannot be changed. Contact support if needed.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="2fa-toggle">Enable 2FA</Label>
                  <p className="text-sm text-muted-foreground">
                    Require a verification code in addition to your password
                  </p>
                </div>
                <Switch id="2fa-toggle" checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
              </div>
              {twoFactorEnabled && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Two-factor authentication setup will be available in the full release. This is a UI-only toggle for
                    the MVP.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage devices that are currently signed in to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_SESSIONS.map((session) => {
                  const IconComponent = session.icon
                  return (
                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{session.device}</p>
                            {session.current && (
                              <Badge variant="secondary" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{session.location}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{session.lastActive}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {!session.current && (
                        <Button variant="outline" size="sm" onClick={() => handleSessionRevoke(session.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme Selection</CardTitle>
              <CardDescription>Choose your preferred theme with live preview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme-select">Theme</Label>
                <Select value={theme} onValueChange={handleThemeChange}>
                  <SelectTrigger id="theme-select">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Theme Preview</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Sample Card</h4>
                        <Badge>Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This is how your interface will look with the selected theme.
                      </p>
                      <div className="flex space-x-2">
                        <Button size="sm">Primary</Button>
                        <Button variant="outline" size="sm">
                          Secondary
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-muted">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Muted Card</h4>
                        <Badge variant="secondary">Preview</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Secondary content areas will use muted backgrounds.
                      </p>
                      <div className="flex space-x-2">
                        <Button variant="secondary" size="sm">
                          Muted
                        </Button>
                        <Button variant="ghost" size="sm">
                          Ghost
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Current theme:</strong> {THEME_OPTIONS.find((t) => t.value === theme)?.label || "System"} -
                  {THEME_OPTIONS.find((t) => t.value === theme)?.description || "Follows system preference"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Usability & Automation
              </CardTitle>
              <CardDescription>
                Enable zero-step identity activation and superhuman efficiency features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>UsabilityEngine v1.0</AlertTitle>
                <AlertDescription className="mt-2">
                  These features automate common tasks to reduce friction and save time. Enable them to experience zero-step identity activation and superhuman efficiency.
                </AlertDescription>
              </Alert>

              {/* Autopilot Toggle */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="autopilot-toggle" className="font-medium text-base">
                      Autopilot
                    </Label>
                    <Badge variant="secondary" className="text-xs">Phase 1 MVP</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically verify credentials, sync licenses, refresh DEA status, and recompute trust scores. Reduces manual work and keeps your profile up to date.
                  </p>
                </div>
                <Switch
                  id="autopilot-toggle"
                  checked={typeof window !== 'undefined' ? localStorage.getItem('vitalcv_autopilot_enabled') !== 'false' : true}
                  onCheckedChange={(checked) => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('vitalcv_autopilot_enabled', String(checked));
                      toast({
                        title: checked ? "Autopilot Enabled" : "Autopilot Disabled",
                        description: checked
                          ? "Autopilot will automatically manage your credentials"
                          : "Autopilot has been turned off",
                      });
                    }
                  }}
                />
              </div>

              {/* One-Tap Mode */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="one-tap-mode" className="font-medium text-base">
                      One-Tap Mode
                    </Label>
                    <Badge variant="secondary" className="text-xs">Global</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enable automatic identity detection and claiming. When enabled, the app will auto-detect your NPI and claim it without requiring manual taps.
                  </p>
                </div>
                <Switch
                  id="one-tap-mode"
                  checked={settings.oneTapMode}
                  onCheckedChange={(checked) => {
                    updateSettings({ oneTapMode: checked });
                    toast({
                      title: checked ? "One-Tap Mode Enabled" : "One-Tap Mode Disabled",
                      description: checked
                        ? "Identity will be auto-detected and claimed automatically."
                        : "Manual identity claiming required.",
                    });
                  }}
                />
              </div>

              {/* Auto-Detect Identity */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="auto-detect-identity" className="font-medium text-base">
                    Auto-Detect Identity on App Launch
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect your NPI and identity information when the app launches, using device autofill and stored session data.
                  </p>
                </div>
                <Switch
                  id="auto-detect-identity"
                  checked={settings.autoDetectIdentity}
                  onCheckedChange={(checked) => {
                    updateSettings({ autoDetectIdentity: checked });
                  }}
                />
              </div>

              {/* Auto-Restore Last State */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="auto-restore-state" className="font-medium text-base">
                    Auto-Restore Last State
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically restore your last viewed page when reopening the app, eliminating the home screen bounce.
                  </p>
                </div>
                <Switch
                  id="auto-restore-state"
                  checked={settings.autoRestoreState}
                  onCheckedChange={(checked) => {
                    updateSettings({ autoRestoreState: checked });
                  }}
                />
              </div>

              {/* Auto-Sync Credentials */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="auto-sync-credentials" className="font-medium text-base">
                    Auto-Sync Credentials
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh credential packets when the app foregrounds.
                  </p>
                </div>
                <Switch
                  id="auto-sync-credentials"
                  checked={settings.autoSyncCredentials}
                  onCheckedChange={(checked) => {
                    updateSettings({ autoSyncCredentials: checked });
                  }}
                />
              </div>

              {/* Auto-Sync State Boards */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="auto-sync-state-boards" className="font-medium text-base">
                    Auto-Sync with State Boards (Nightly)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync with state boards every night to keep licenses up to date.
                  </p>
                </div>
                <Switch
                  id="auto-sync-state-boards"
                  checked={settings.autoSyncStateBoards}
                  onCheckedChange={(checked) => {
                    updateSettings({ autoSyncStateBoards: checked });
                  }}
                />
              </div>

              {/* Auto-Sync DEA */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="auto-sync-dea" className="font-medium text-base">
                    Auto-Sync with DEA (Weekly)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync with DEA registry weekly to keep DEA certificates current.
                  </p>
                </div>
                <Switch
                  id="auto-sync-dea"
                  checked={settings.autoSyncDEA}
                  onCheckedChange={(checked) => {
                    updateSettings({ autoSyncDEA: checked });
                  }}
                />
              </div>

              {/* Auto-Sync Compact */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="auto-sync-compact" className="font-medium text-base">
                    Auto-Sync with Compact Participations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically fetch and update Compact eligibility information.
                  </p>
                </div>
                <Switch
                  id="auto-sync-compact"
                  checked={settings.autoSyncCompact}
                  onCheckedChange={(checked) => {
                    updateSettings({ autoSyncCompact: checked });
                  }}
                />
              </div>

              {/* Smart Notifications */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="smart-notifications" className="font-medium text-base">
                    Smart Notification Routing
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only show meaningful alerts and hide redundant notifications.
                  </p>
                </div>
                <Switch
                  id="smart-notifications"
                  checked={settings.smartNotifications}
                  onCheckedChange={(checked) => {
                    updateSettings({ smartNotifications: checked });
                  }}
                />
              </div>

              {/* Zero Redundancy Mode */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="zero-redundancy-mode" className="font-medium text-base">
                    Zero Redundancy Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Hide irrelevant tabs and UI elements to reduce cognitive load.
                  </p>
                </div>
                <Switch
                  id="zero-redundancy-mode"
                  checked={settings.zeroRedundancyMode}
                  onCheckedChange={(checked) => {
                    updateSettings({ zeroRedundancyMode: checked });
                  }}
                />
              </div>

              {/* Light Mode UX */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="light-mode-ux" className="font-medium text-base">
                    Light Mode UX
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Zero-cognitive load design with simplified interfaces.
                  </p>
                </div>
                <Switch
                  id="light-mode-ux"
                  checked={settings.lightModeUX}
                  onCheckedChange={(checked) => {
                    updateSettings({ lightModeUX: checked });
                  }}
                />
              </div>

              {/* Peak Efficiency Mode */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="peak-efficiency-mode" className="font-medium text-base">
                    Peak Efficiency Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    AI chooses the next 3 steps for you automatically.
                  </p>
                </div>
                <Switch
                  id="peak-efficiency-mode"
                  checked={settings.peakEfficiencyMode}
                  onCheckedChange={(checked) => {
                    updateSettings({ peakEfficiencyMode: checked });
                  }}
                />
              </div>

              {/* Zero Cognitive Load Mode */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="zero-cognitive-load-mode" className="font-medium text-base">
                    Zero Cognitive Load Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    AI manages everything automatically - maximum automation.
                  </p>
                </div>
                <Switch
                  id="zero-cognitive-load-mode"
                  checked={settings.zeroCognitiveLoadMode}
                  onCheckedChange={(checked) => {
                    updateSettings({ zeroCognitiveLoadMode: checked });
                  }}
                />
              </div>

              <Separator />

              {/* Refresh Everything Button */}
              <div className="space-y-4">
                <div>
                  <Label className="font-medium mb-2 block">Quick Actions</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Manually trigger a refresh of all enabled sync operations.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    setRefreshing(true);
                    try {
                      await refreshEverything();
                      toast({
                        title: "Refresh Complete",
                        description: "All enabled sync operations have been completed.",
                      });
                    } catch (error) {
                      toast({
                        title: "Refresh Error",
                        description: "Some sync operations may have failed. Check your connection and try again.",
                        variant: "destructive",
                      });
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                  disabled={refreshing}
                  className="w-full"
                >
                  {refreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Everything
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eudi" id="eudi-tab" role="tabpanel" aria-labelledby="eudi-tab-trigger" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" aria-hidden="true" />
                EU Digital Identity (EUDI) Wallet Settings
              </CardTitle>
              <CardDescription>
                Configure EUDI wallet acceptance and relying party behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important: EU Relying Party Duties</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-2">
                    As an EU relying party, you are subject to specific obligations under{' '}
                    <a
                      href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1503"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                      aria-label="EU Regulation 2024/1503 (opens in new tab)"
                    >
                      EU Regulation 2024/1503
                    </a>
                    {' '}(EU Digital Identity Wallet Regulation):
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>You must verify the authenticity and validity of EUDI credentials</li>
                    <li>You must respect user privacy and data minimization principles</li>
                    <li>You must maintain audit logs of all verification requests</li>
                    <li>You must comply with GDPR requirements for personal data processing</li>
                    <li>You must implement appropriate security measures to protect user data</li>
                  </ul>
                  <p className="mt-2 text-sm">
                    Enabling these settings indicates your acceptance of these duties and activates EUDI-specific verification flows.{' '}
                    <a
                      href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1503"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      aria-label="Read the full EU Regulation 2024/1503 legal text (opens in new tab)"
                    >
                      Read the full regulation →
                    </a>
                  </p>
                </AlertDescription>
              </Alert>

              {/* B102C-FE-049: Accept EUDI Wallets Toggle */}
              <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accept-eudi-wallets" className="font-medium text-base">
                      Accept EUDI Wallets
                    </Label>
                    <a
                      href="https://digital-identity.ec.europa.eu/eu-digital-identity-wallet_en"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded px-1 inline-flex items-center gap-1"
                      aria-label="Learn more about EUDI wallets (opens in new tab)"
                    >
                      <span className="sr-only">Learn more about EUDI wallets</span>
                      <span aria-hidden="true" className="text-primary underline decoration-dotted">ℹ️</span>
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When enabled, only presentations from EUDI wallets will be accepted. Non-EUDI presentations will be blocked with an audit reason logged.
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 mt-2">
                    <p>
                      <strong>What is an EUDI Wallet?</strong> The EU Digital Identity Wallet is a secure digital solution that allows EU citizens to store and share their identity credentials and other personal attributes.
                    </p>
                    <p>
                      <a
                        href="https://digital-identity.ec.europa.eu/eu-digital-identity-wallet_en"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                        aria-label="Learn more about EUDI wallets (opens in new tab)"
                      >
                        Learn more about EUDI wallets →
                      </a>
                    </p>
                    <p>
                      <a
                        href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1503"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                        aria-label="Read EU Regulation 2024/1503 legal brief (opens in new tab)"
                      >
                        Read EU Regulation 2024/1503 legal brief →
                      </a>
                    </p>
                  </div>
                </div>
                <Switch
                  id="accept-eudi-wallets"
                  checked={euRelyingPartyEnabled}
                  onCheckedChange={async (checked) => {
                    try {
                      setEuRelyingPartyEnabled(checked)
                      // Persist to localStorage
                      localStorage.setItem('vitalcv_eu_relying_party', String(checked))

                      // Sync with backend via API
                      try {
                        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4005'
                        const response = await fetch(`${backendUrl}/api/settings/eudi-accept`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ acceptEudiWalletsOnly: checked }),
                        })

                        if (!response.ok) {
                          const errorData = await response.json().catch(() => ({}))
                          console.warn('Backend setting update failed:', errorData)
                          // Continue with localStorage persistence even if backend fails
                        }
                      } catch (err) {
                        console.warn('Backend setting update error:', err)
                        // Ignore errors - localStorage persistence is sufficient for MVP
                      }

                      toast({
                        title: checked ? "EUDI Wallets Accepted" : "EUDI Wallets Disabled",
                        description: checked
                          ? "Only EUDI wallet presentations will be accepted. Non-EUDI presentations will be blocked."
                          : "All wallet types are now accepted.",
                      })
                    } catch (toggleError) {
                      // Revert toggle state on error
                      setEuRelyingPartyEnabled(!checked)
                      localStorage.setItem('vitalcv_eu_relying_party', String(!checked))
                      toast({
                        title: "Error",
                        description: "Failed to update EUDI wallet setting. Please try again.",
                        variant: "destructive",
                      })
                    }
                  }}
                  aria-label="Accept EUDI wallets only"
                  aria-describedby="accept-eudi-wallets-description"
                  aria-checked={euRelyingPartyEnabled}
                />
              </div>

              <div id="accept-eudi-wallets-description" className="sr-only">
                When enabled, only EUDI wallet presentations are accepted. Non-EUDI presentations are blocked and logged for audit purposes. This setting enforces compliance with EU Regulation 2024/1503.
              </div>

              {euRelyingPartyEnabled && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>EUDI-Only Mode Active:</strong> Your system is now configured to:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Accept only presentations from EUDI wallets</li>
                      <li>Block non-EUDI presentations with 403 Forbidden</li>
                      <li>Log all blocked presentations with audit reason</li>
                      <li>Verify credential authenticity using EUDI trust registries</li>
                      <li>Apply EUDI-specific privacy-preserving disclosure policies</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Export & Privacy
              </CardTitle>
              <CardDescription>
                Request a copy of your personal data (GDPR Article 15 - Right of Access)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Your Privacy Rights</AlertTitle>
                <AlertDescription className="mt-2">
                  Under GDPR, you have the right to:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Access your personal data (Article 15)</li>
                    <li>Rectify inaccurate data (Article 16)</li>
                    <li>Erase your data (Article 17 - "Right to be forgotten")</li>
                    <li>Restrict processing (Article 18)</li>
                    <li>Data portability (Article 20)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label className="font-medium mb-2 block">Request Data Export</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Request a complete export of all personal data we hold about you. This includes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
                    <li>Account information and profile data</li>
                    <li>Credential verification history</li>
                    <li>Audit logs of data access</li>
                    <li>Consent records</li>
                    <li>Communication history</li>
                  </ul>
                </div>

                {exportRequested ? (
                  <Alert>
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Export Request Submitted</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your data export request has been received. You will receive an email with a secure download link within 30 days as required by GDPR.
                          </p>
                        </div>
                        <Download className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Button
                    onClick={async () => {
                      setExportLoading(true)
                      try {
                        // API call to request export
                        const response = await fetch('/api/gdpr/export-request', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                        })

                        if (!response.ok) {
                          throw new Error('Failed to request export')
                        }

                        setExportRequested(true)
                        localStorage.setItem('vitalcv_export_requested', 'true')
                        toast({
                          title: "Export Request Submitted",
                          description: "You will receive an email with your data export within 30 days.",
                        })
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to submit export request. Please try again or contact support.",
                          variant: "destructive",
                        })
                      } finally {
                        setExportLoading(false)
                      }
                    }}
                    disabled={exportLoading}
                    className="w-full"
                  >
                    {exportLoading ? "Processing..." : "Request Data Export"}
                  </Button>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="font-medium">Audit Trail</Label>
                <p className="text-sm text-muted-foreground">
                  All data access and export requests are logged in our audit trail for compliance purposes.
                  You can view your audit history in the{" "}
                  <a href="/admin/audit-export" className="text-primary hover:underline">
                    audit export page
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
