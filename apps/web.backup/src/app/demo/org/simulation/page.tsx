'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScenarioBuilder } from '@/components/simulation/ScenarioBuilder'
import { FaultConfigPanel } from '@/components/simulation/FaultConfigPanel'
import { ResultExplorer } from '@/components/simulation/ResultExplorer'
import { LogViewer } from '@/components/simulation/LogViewer'
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type SimulationStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused'
export type Scenario = {
  id: string
  name: string
  description?: string
  modules: string[]
  events: Array<{
    id: string
    type: string
    timestamp: number
    module: string
  }>
  expectations?: Array<{
    metric: string
    operator: 'gt' | 'lt' | 'eq'
    value: number
  }>
}

export type FaultConfig = {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  targetModule?: string
  probability: number
  duration?: number
}

export type SimulationRun = {
  id: string
  scenarioId: string
  scenarioName: string
  status: SimulationStatus
  progress: number
  startTime?: Date
  endTime?: Date
  faultConfig?: FaultConfig[]
  results?: SimulationResults
}

export type SimulationResults = {
  metrics: Record<string, number>
  events: Array<{
    id: string
    timestamp: number
    module: string
    type: string
    data?: Record<string, unknown>
  }>
  moduleResponses: Record<string, {
    success: boolean
    latency: number
    errors?: string[]
  }>
  baselineComparison?: Record<string, {
    baseline: number
    actual: number
    difference: number
  }>
}

export default function SimulationDashboardPage() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [faultConfig, setFaultConfig] = useState<FaultConfig[]>([])
  const [currentRun, setCurrentRun] = useState<SimulationRun | null>(null)
  const [runs, setRuns] = useState<SimulationRun[]>([])
  const [activeTab, setActiveTab] = useState<'scenarios' | 'faults' | 'results' | 'logs'>('scenarios')

  // Load saved runs from localStorage
  useEffect(() => {
    const savedRuns = localStorage.getItem('simulation-runs')
    if (savedRuns) {
      try {
        const parsed = JSON.parse(savedRuns)
        setRuns(parsed.map((run: any) => ({
          ...run,
          startTime: run.startTime ? new Date(run.startTime) : undefined,
          endTime: run.endTime ? new Date(run.endTime) : undefined,
        })))
      } catch (e) {
        console.error('Failed to load saved runs', e)
      }
    }
  }, [])

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario)
  }

  const handleScenarioCreate = (scenario: Scenario) => {
    setSelectedScenario(scenario)
    // In a real app, save to backend
  }

  const handleRunSimulation = async () => {
    if (!selectedScenario) return

    const newRun: SimulationRun = {
      id: `run-${Date.now()}`,
      scenarioId: selectedScenario.id,
      scenarioName: selectedScenario.name,
      status: 'running',
      progress: 0,
      startTime: new Date(),
      faultConfig: faultConfig.length > 0 ? faultConfig : undefined,
    }

    setCurrentRun(newRun)
    setRuns((prev) => [newRun, ...prev])
    setActiveTab('results')

    // Simulate simulation progress
    const interval = setInterval(() => {
      setCurrentRun((prev) => {
        if (!prev || prev.status !== 'running') {
          clearInterval(interval)
          return prev
        }

        const newProgress = Math.min(prev.progress + Math.random() * 15, 100)

        if (newProgress >= 100) {
          clearInterval(interval)
          const completedRun: SimulationRun = {
            ...prev,
            status: 'completed',
            progress: 100,
            endTime: new Date(),
            results: generateMockResults(selectedScenario),
          }

          // Save to localStorage
          const updatedRuns = [completedRun, ...runs.filter((r) => r.id !== prev.id)]
          localStorage.setItem('simulation-runs', JSON.stringify(updatedRuns))

          return completedRun
        }

        return { ...prev, progress: newProgress }
      })
    }, 500)
  }

  const handlePauseSimulation = () => {
    if (currentRun && currentRun.status === 'running') {
      setCurrentRun({ ...currentRun, status: 'paused' })
    }
  }

  const handleResumeSimulation = () => {
    if (currentRun && currentRun.status === 'paused') {
      setCurrentRun({ ...currentRun, status: 'running' })
      // Resume progress simulation
      handleRunSimulation()
    }
  }

  const handleStopSimulation = () => {
    if (currentRun) {
      setCurrentRun({ ...currentRun, status: 'failed', progress: 0 })
    }
  }

  const getStatusBadge = (status: SimulationStatus) => {
    const variants: Record<SimulationStatus, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: typeof CheckCircle2; label: string }> = {
      idle: { variant: 'outline', icon: Clock, label: 'Idle' },
      running: { variant: 'default', icon: RefreshCw, label: 'Running' },
      completed: { variant: 'default', icon: CheckCircle2, label: 'Completed' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      paused: { variant: 'secondary', icon: Pause, label: 'Paused' },
    }

    const config = variants[status]
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulation Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Select scenarios, inject faults, run simulations, and analyze results
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentRun && (
            <>
              {currentRun.status === 'running' && (
                <Button variant="outline" onClick={handlePauseSimulation}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {currentRun.status === 'paused' && (
                <Button variant="outline" onClick={handleResumeSimulation}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
              {currentRun.status === 'running' && (
                <Button variant="destructive" onClick={handleStopSimulation}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
            </>
          )}
          <Button
            onClick={handleRunSimulation}
            disabled={!selectedScenario || (currentRun?.status === 'running')}
          >
            <Play className="h-4 w-4 mr-2" />
            Run Simulation
          </Button>
        </div>
      </div>

      {/* Current Run Status */}
      {currentRun && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Current Run: {currentRun.scenarioName}
                  {getStatusBadge(currentRun.status)}
                </CardTitle>
                <CardDescription>
                  Started: {currentRun.startTime?.toLocaleString()}
                  {currentRun.endTime && ` • Completed: ${currentRun.endTime.toLocaleString()}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(currentRun.status === 'running' || currentRun.status === 'paused') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(currentRun.progress)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${currentRun.progress}%` }}
                  />
                </div>
              </div>
            )}
            {currentRun.status === 'completed' && currentRun.results && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{currentRun.results.events.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modules Tested</p>
                  <p className="text-2xl font-bold">{Object.keys(currentRun.results.moduleResponses).length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {(
                      (Object.values(currentRun.results.moduleResponses).filter((r) => r.success).length /
                        Object.keys(currentRun.results.moduleResponses).length) *
                      100
                    ).toFixed(0)}
                    %
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="faults">Fault Injection</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-4">
          <ScenarioBuilder
            onScenarioSelect={handleScenarioSelect}
            onScenarioCreate={handleScenarioCreate}
            selectedScenario={selectedScenario}
          />
        </TabsContent>

        <TabsContent value="faults" className="space-y-4">
          <FaultConfigPanel
            config={faultConfig}
            onConfigChange={setFaultConfig}
            availableModules={selectedScenario?.modules || []}
          />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <ResultExplorer
            runs={runs}
            currentRun={currentRun}
            onRunSelect={(run) => setCurrentRun(run)}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogViewer
            run={currentRun}
            runs={runs}
            onRunSelect={(run) => setCurrentRun(run)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Mock data generator for demo purposes
function generateMockResults(scenario: Scenario): SimulationResults {
  const events = scenario.events.map((e) => ({
    ...e,
    data: { mock: true },
  }))

  const moduleResponses: SimulationResults['moduleResponses'] = {}
  scenario.modules.forEach((module) => {
    moduleResponses[module] = {
      success: Math.random() > 0.2,
      latency: Math.random() * 1000,
      errors: Math.random() > 0.8 ? ['Mock error'] : undefined,
    }
  })

  const metrics: Record<string, number> = {
    totalLatency: Object.values(moduleResponses).reduce((sum, r) => sum + r.latency, 0),
    successRate: (Object.values(moduleResponses).filter((r) => r.success).length / scenario.modules.length) * 100,
    errorCount: Object.values(moduleResponses).reduce((sum, r) => sum + (r.errors?.length || 0), 0),
  }

  return {
    events,
    moduleResponses,
    metrics,
  }
}

