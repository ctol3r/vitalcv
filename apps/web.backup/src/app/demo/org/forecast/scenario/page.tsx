'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, Calculator, Plus, Trash2, TrendingDown, TrendingUp, UsersRound } from 'lucide-react'

interface ScenarioChange {
  id: string
  type: 'add_clinician' | 'remove_clinician' | 'new_privilege' | 'compact_change'
  description: string
  department?: string
  role?: string
  count?: number
  impact?: {
    coverageChange: number
    shortageChange: number
  }
}

interface ForecastImpact {
  department: string
  role: string
  baselineCoverage: number
  scenarioCoverage: number
  coverageDelta: number
  baselineShortage: number
  scenarioShortage: number
  shortageDelta: number
}

const BASELINE_FORECAST: ForecastImpact[] = [
  { department: 'ICU', role: 'Intensivist', baselineCoverage: 0.82, scenarioCoverage: 0.82, coverageDelta: 0, baselineShortage: 4, scenarioShortage: 4, shortageDelta: 0 },
  { department: 'ED', role: 'Emergency MD', baselineCoverage: 0.95, scenarioCoverage: 0.95, coverageDelta: 0, baselineShortage: 0, scenarioShortage: 0, shortageDelta: 0 },
  { department: 'Cath Lab', role: 'Interventional Card', baselineCoverage: 0.75, scenarioCoverage: 0.75, coverageDelta: 0, baselineShortage: 3, scenarioShortage: 3, shortageDelta: 0 },
  { department: 'Telehealth', role: 'Behavioral Health', baselineCoverage: 0.65, scenarioCoverage: 0.65, coverageDelta: 0, baselineShortage: 8, scenarioShortage: 8, shortageDelta: 0 },
]

export default function ForecastScenarioPage() {
  const [scenarioChanges, setScenarioChanges] = useState<ScenarioChange[]>([])
  const [scenarioName, setScenarioName] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const scenarioForecast = useMemo(() => {
    if (scenarioChanges.length === 0) return BASELINE_FORECAST

    // Simulate forecast changes based on scenario
    return BASELINE_FORECAST.map((forecast) => {
      let coverageDelta = 0
      let shortageDelta = 0

      scenarioChanges.forEach((change) => {
        if (change.department === forecast.department && change.role === forecast.role) {
          if (change.type === 'add_clinician' && change.count) {
            coverageDelta += change.count * 0.05 // Each clinician adds ~5% coverage
            shortageDelta -= change.count
          } else if (change.type === 'remove_clinician' && change.count) {
            coverageDelta -= change.count * 0.05
            shortageDelta += change.count
          } else if (change.type === 'new_privilege') {
            coverageDelta += 0.03 // New privileges increase coverage slightly
          } else if (change.type === 'compact_change') {
            coverageDelta += 0.08 // Compact changes can significantly improve coverage
          }
        }
      })

      const newCoverage = Math.min(1, Math.max(0, forecast.baselineCoverage + coverageDelta))
      const newShortage = Math.max(0, forecast.baselineShortage + shortageDelta)

      return {
        ...forecast,
        scenarioCoverage: newCoverage,
        coverageDelta,
        scenarioShortage: newShortage,
        shortageDelta,
      }
    })
  }, [scenarioChanges])

  const totalBaselineShortage = BASELINE_FORECAST.reduce((sum, f) => sum + f.baselineShortage, 0)
  const totalScenarioShortage = scenarioForecast.reduce((sum, f) => sum + f.scenarioShortage, 0)
  const totalShortageDelta = totalScenarioShortage - totalBaselineShortage

  const handleAddChange = () => {
    const newChange: ScenarioChange = {
      id: `change-${Date.now()}`,
      type: 'add_clinician',
      description: '',
      department: '',
      role: '',
      count: 1,
    }
    setScenarioChanges([...scenarioChanges, newChange])
  }

  const handleRemoveChange = (id: string) => {
    setScenarioChanges(scenarioChanges.filter((c) => c.id !== id))
  }

  const handleUpdateChange = (id: string, updates: Partial<ScenarioChange>) => {
    setScenarioChanges(scenarioChanges.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const handleRunScenario = () => {
    setIsRunning(true)
    // Simulate API call
    setTimeout(() => {
      setIsRunning(false)
    }, 1000)
  }

  const handleReset = () => {
    setScenarioChanges([])
    setScenarioName('')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo » Org » Forecast » Scenario</p>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" /> Forecast Scenario Simulator
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Simulate clinician additions/removals, new privileges, compacts changes. Outputs forecast changes with
          before/after comparison.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scenario Configuration</CardTitle>
            <CardDescription>Define changes to simulate forecast impact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Scenario Name</label>
              <Input
                placeholder="e.g., Add 5 ICU Intensivists"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Changes</h3>
                <Button size="sm" variant="outline" onClick={handleAddChange}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Change
                </Button>
              </div>

              {scenarioChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No changes added. Click "Add Change" to simulate forecast modifications.
                </p>
              ) : (
                <div className="space-y-3">
                  {scenarioChanges.map((change) => (
                    <div key={change.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <select
                          className="text-sm border rounded px-2 py-1"
                          value={change.type}
                          onChange={(e) =>
                            handleUpdateChange(change.id, { type: e.target.value as ScenarioChange['type'] })
                          }
                        >
                          <option value="add_clinician">Add Clinician</option>
                          <option value="remove_clinician">Remove Clinician</option>
                          <option value="new_privilege">New Privilege</option>
                          <option value="compact_change">Compact Change</option>
                        </select>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveChange(change.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Department"
                          value={change.department || ''}
                          onChange={(e) => handleUpdateChange(change.id, { department: e.target.value })}
                          className="text-sm"
                        />
                        <Input
                          placeholder="Role"
                          value={change.role || ''}
                          onChange={(e) => handleUpdateChange(change.id, { role: e.target.value })}
                          className="text-sm"
                        />
                      </div>

                      {(change.type === 'add_clinician' || change.type === 'remove_clinician') && (
                        <Input
                          type="number"
                          placeholder="Count"
                          value={change.count || ''}
                          onChange={(e) => handleUpdateChange(change.id, { count: parseInt(e.target.value) || 0 })}
                          className="text-sm"
                        />
                      )}

                      <Input
                        placeholder="Description (optional)"
                        value={change.description}
                        onChange={(e) => handleUpdateChange(change.id, { description: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleRunScenario} disabled={scenarioChanges.length === 0 || isRunning} className="flex-1">
                {isRunning ? 'Running...' : 'Run Scenario'}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={scenarioChanges.length === 0}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Impact Summary</CardTitle>
            <CardDescription>Forecast changes from baseline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Baseline Shortage</p>
                <p className="text-2xl font-bold">{totalBaselineShortage} FTE</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground mb-1">Scenario Shortage</p>
                <p className={cn('text-2xl font-bold', totalShortageDelta < 0 ? 'text-emerald-600' : 'text-rose-600')}>
                  {totalScenarioShortage} FTE
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Net Change</p>
                <div className="flex items-center gap-2">
                  {totalShortageDelta < 0 ? (
                    <TrendingDown className="h-4 w-4 text-emerald-600" />
                  ) : totalShortageDelta > 0 ? (
                    <TrendingUp className="h-4 w-4 text-rose-600" />
                  ) : null}
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      totalShortageDelta < 0 ? 'text-emerald-600' : totalShortageDelta > 0 ? 'text-rose-600' : 'text-muted-foreground',
                    )}
                  >
                    {totalShortageDelta > 0 ? '+' : ''}
                    {totalShortageDelta.toFixed(1)} FTE
                  </p>
                </div>
              </div>
            </div>

            {scenarioChanges.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Applied Changes</h3>
                <div className="space-y-1">
                  {scenarioChanges.map((change) => (
                    <div key={change.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      {change.type === 'add_clinician' && `+${change.count} ${change.role} in ${change.department}`}
                      {change.type === 'remove_clinician' && `-${change.count} ${change.role} in ${change.department}`}
                      {change.type === 'new_privilege' && `New privilege: ${change.description || 'N/A'}`}
                      {change.type === 'compact_change' && `Compact change: ${change.description || 'N/A'}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast Comparison</CardTitle>
          <CardDescription>Before and after scenario impact by department and role</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Baseline Coverage</TableHead>
                <TableHead>Scenario Coverage</TableHead>
                <TableHead>Coverage Change</TableHead>
                <TableHead>Baseline Shortage</TableHead>
                <TableHead>Scenario Shortage</TableHead>
                <TableHead>Shortage Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarioForecast.map((forecast) => (
                <TableRow key={`${forecast.department}-${forecast.role}`}>
                  <TableCell className="font-medium">{forecast.department}</TableCell>
                  <TableCell>{forecast.role}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(forecast.baselineCoverage * 100)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        forecast.coverageDelta > 0 ? 'bg-emerald-50 text-emerald-900' : forecast.coverageDelta < 0 ? 'bg-rose-50 text-rose-900' : '',
                      )}
                    >
                      {Math.round(forecast.scenarioCoverage * 100)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {forecast.coverageDelta !== 0 && (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          forecast.coverageDelta > 0 ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {forecast.coverageDelta > 0 ? '+' : ''}
                        {Math.round(forecast.coverageDelta * 100)}%
                      </span>
                    )}
                    {forecast.coverageDelta === 0 && <span className="text-sm text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{forecast.baselineShortage} FTE</span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        forecast.shortageDelta < 0 ? 'text-emerald-600' : forecast.shortageDelta > 0 ? 'text-rose-600' : '',
                      )}
                    >
                      {forecast.scenarioShortage} FTE
                    </span>
                  </TableCell>
                  <TableCell>
                    {forecast.shortageDelta !== 0 && (
                      <span
                        className={cn(
                          'text-sm font-medium flex items-center gap-1',
                          forecast.shortageDelta < 0 ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {forecast.shortageDelta < 0 ? (
                          <ArrowLeft className="h-3 w-3" />
                        ) : (
                          <ArrowRight className="h-3 w-3" />
                        )}
                        {Math.abs(forecast.shortageDelta).toFixed(1)} FTE
                      </span>
                    )}
                    {forecast.shortageDelta === 0 && <span className="text-sm text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

