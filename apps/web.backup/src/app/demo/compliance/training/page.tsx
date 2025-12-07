'use client'

import { useState, useMemo } from 'react'
import {
  BookOpen,
  Play,
  CheckCircle2,
  Clock,
  Award,
  Search,
  Filter,
  Video,
  FileText,
  BarChart3,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type TrainingResource = {
  id: string
  title: string
  type: 'video' | 'quiz' | 'document' | 'interactive'
  obligation: string
  duration: number // in minutes
  completed: boolean
  progress: number // 0-100
  certificate?: boolean
  description: string
}

type TrainingModule = {
  id: string
  title: string
  description: string
  obligation: string
  resources: TrainingResource[]
  completed: boolean
  progress: number
}

export default function ComplianceTrainingModulePage() {
  const [search, setSearch] = useState('')
  const [filterObligation, setFilterObligation] = useState('all')
  const [filterType, setFilterType] = useState<'all' | TrainingResource['type']>('all')

  const modules = useMemo(() => buildMockTrainingModules(), [])

  const filteredModules = useMemo(() => {
    return modules.filter((module) => {
      const matchesSearch =
        !search ||
        module.title.toLowerCase().includes(search.toLowerCase()) ||
        module.description.toLowerCase().includes(search.toLowerCase())
      const matchesObligation = filterObligation === 'all' || module.obligation === filterObligation
      return matchesSearch && matchesObligation
    })
  }, [modules, search, filterObligation])

  const filteredResources = useMemo(() => {
    const allResources = modules.flatMap((m) => m.resources.map((r) => ({ ...r, moduleId: m.id, moduleTitle: m.title })))
    return allResources.filter((resource) => {
      const matchesSearch =
        !search ||
        resource.title.toLowerCase().includes(search.toLowerCase()) ||
        resource.description.toLowerCase().includes(search.toLowerCase())
      const matchesObligation = filterObligation === 'all' || resource.obligation === filterObligation
      const matchesType = filterType === 'all' || resource.type === filterType
      return matchesSearch && matchesObligation && matchesType
    })
  }, [modules, search, filterObligation, filterType])

  const overallStats = useMemo(() => {
    const allResources = modules.flatMap((m) => m.resources)
    const total = allResources.length
    const completed = allResources.filter((r) => r.completed).length
    const inProgress = allResources.filter((r) => !r.completed && r.progress > 0).length
    const totalDuration = allResources.reduce((sum, r) => sum + r.duration, 0)
    const completedDuration = allResources
      .filter((r) => r.completed)
      .reduce((sum, r) => sum + r.duration, 0)

    return {
      total,
      completed,
      inProgress,
      totalDuration,
      completedDuration,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [modules])

  const handleStartResource = (resourceId: string) => {
    // In a real app, this would start the training resource
    console.log('Starting resource:', resourceId)
  }

  const handleCompleteResource = (resourceId: string) => {
    // In a real app, this would mark the resource as completed
    console.log('Completing resource:', resourceId)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Compliance • Training</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" aria-hidden="true" />
              Compliance Training Module
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Interactive training resources on compliance obligations (HIPAA, GDPR, etc.). Track completion and earn certificates.
            </p>
          </div>
        </div>
      </header>

      {/* Statistics */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-3xl font-bold">{overallStats.completionRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold">{overallStats.completed}</p>
              <p className="text-xs text-muted-foreground">of {overallStats.total} resources</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-3xl font-bold">{overallStats.inProgress}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Time Completed</p>
              <p className="text-3xl font-bold">{overallStats.completedDuration}</p>
              <p className="text-xs text-muted-foreground">of {overallStats.totalDuration} minutes</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" aria-hidden="true" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search training resources..."
                className="pl-9"
              />
            </div>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={filterObligation}
              onChange={(e) => setFilterObligation(e.target.value)}
            >
              <option value="all">All Obligations</option>
              <option value="GDPR">GDPR</option>
              <option value="HIPAA">HIPAA</option>
              <option value="CCPA">CCPA</option>
              <option value="SOC2">SOC 2</option>
            </select>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            >
              <option value="all">All Types</option>
              <option value="video">Videos</option>
              <option value="quiz">Quizzes</option>
              <option value="document">Documents</option>
              <option value="interactive">Interactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Training Modules */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Training Modules</h2>
        {filteredModules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </div>
                <Badge variant="outline" className="ml-4">
                  {module.obligation}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{module.progress}%</span>
                </div>
                <Progress value={module.progress} className="h-2" />
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Resources</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {module.resources.map((resource) => (
                    <div
                      key={resource.id}
                      className={cn(
                        'rounded-md border p-3 space-y-2',
                        resource.completed && 'border-emerald-200 bg-emerald-50',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {resource.type === 'video' && <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                            {resource.type === 'quiz' && <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                            {resource.type === 'document' && <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                            {resource.type === 'interactive' && <Play className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                            <h5 className="font-medium text-sm">{resource.title}</h5>
                            {resource.completed && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>{resource.duration} min</span>
                            {resource.certificate && (
                              <>
                                <span>•</span>
                                <Award className="h-3 w-3" aria-hidden="true" />
                                <span>Certificate</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {!resource.completed && (
                        <div className="space-y-1">
                          <Progress value={resource.progress} className="h-1" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleStartResource(resource.id)}
                          >
                            {resource.progress > 0 ? 'Continue' : 'Start'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All Resources View */}
      <Card>
        <CardHeader>
          <CardTitle>All Training Resources</CardTitle>
          <CardDescription>Browse all available training resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredResources.map((resource) => (
              <div
                key={resource.id}
                className={cn(
                  'flex items-center justify-between rounded-md border p-3',
                  resource.completed && 'border-emerald-200 bg-emerald-50',
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  {resource.type === 'video' && <Video className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                  {resource.type === 'quiz' && <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                  {resource.type === 'document' && <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                  {resource.type === 'interactive' && <Play className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{resource.title}</h4>
                      {resource.completed && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {resource.obligation}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{resource.moduleTitle}</span>
                      <span>•</span>
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{resource.duration} min</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {resource.completed ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-900">
                      Completed
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleStartResource(resource.id)}>
                      {resource.progress > 0 ? 'Continue' : 'Start'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {filteredResources.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No training resources match your filters.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function buildMockTrainingModules(): TrainingModule[] {
  return [
    {
      id: 'module-001',
      title: 'GDPR Compliance Training',
      description: 'Comprehensive training on GDPR requirements, data protection principles, and individual rights.',
      obligation: 'GDPR',
      progress: 75,
      completed: false,
      resources: [
        {
          id: 'res-001',
          title: 'Introduction to GDPR',
          type: 'video',
          obligation: 'GDPR',
          duration: 15,
          completed: true,
          progress: 100,
          description: 'Overview of GDPR and its key principles',
        },
        {
          id: 'res-002',
          title: 'Data Subject Rights',
          type: 'interactive',
          obligation: 'GDPR',
          duration: 20,
          completed: true,
          progress: 100,
          description: 'Interactive module on handling data subject requests',
        },
        {
          id: 'res-003',
          title: 'GDPR Compliance Quiz',
          type: 'quiz',
          obligation: 'GDPR',
          duration: 10,
          completed: false,
          progress: 50,
          certificate: true,
          description: 'Test your knowledge of GDPR requirements',
        },
      ],
    },
    {
      id: 'module-002',
      title: 'HIPAA Privacy and Security',
      description: 'Training on HIPAA Privacy Rule and Security Rule requirements for healthcare organizations.',
      obligation: 'HIPAA',
      progress: 40,
      completed: false,
      resources: [
        {
          id: 'res-004',
          title: 'HIPAA Privacy Rule Overview',
          type: 'video',
          obligation: 'HIPAA',
          duration: 25,
          completed: true,
          progress: 100,
          description: 'Understanding the HIPAA Privacy Rule',
        },
        {
          id: 'res-005',
          title: 'Security Controls Documentation',
          type: 'document',
          obligation: 'HIPAA',
          duration: 30,
          completed: false,
          progress: 0,
          description: 'Guide to implementing HIPAA security controls',
        },
      ],
    },
    {
      id: 'module-003',
      title: 'CCPA Consumer Rights',
      description: 'Training on California Consumer Privacy Act requirements and consumer rights handling.',
      obligation: 'CCPA',
      progress: 0,
      completed: false,
      resources: [
        {
          id: 'res-006',
          title: 'CCPA Overview',
          type: 'video',
          obligation: 'CCPA',
          duration: 12,
          completed: false,
          progress: 0,
          description: 'Introduction to CCPA requirements',
        },
      ],
    },
  ]
}

