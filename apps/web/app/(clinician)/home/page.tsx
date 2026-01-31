'use client'

import { CheckCircle2, Link2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { CRSCard } from '@/components/CRSCard'
import { CredentialStatus, type CredentialStatusItem } from '@/components/CredentialStatus'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { parseMagicLink, type MagicLinkPayload } from '@/lib/auth/magicLink'
import { cn } from '@/lib/utils'

type ClinicianTask = {
  id: string
  title: string
  description: string
  actionLabel: string
  due: string
  status: 'open' | 'resolved'
}

const CRS_SNAPSHOT = {
  score: 82,
  grade: 'GREEN',
  readiness: 'READY',
  updatedAt: '2026-01-30T17:20:00Z',
  summary: 'PSV evidence is current for required sources.',
  reasons: [
    'Identity and NPI verified against NPPES.',
    'Sanctions checks are within freshness windows.',
    'Restricted sources remain review-only until integrations are live.',
  ],
} as const

const CREDENTIAL_ITEMS: CredentialStatusItem[] = [
  {
    id: 'npi-identity',
    label: 'NPI identity anchor',
    status: 'valid',
    issuer: 'NPPES registry',
    lastVerified: '2026-01-28',
    expiresAt: '2027-01-28',
    note: 'Primary identity anchor for PSV evidence.',
  },
  {
    id: 'state-license',
    label: 'State medical license',
    status: 'valid',
    issuer: 'State licensing board',
    lastVerified: '2026-01-17',
    expiresAt: '2027-01-31',
    note: 'License number on file (masked).',
  },
  {
    id: 'board-cert',
    label: 'Board certification',
    status: 'expiring',
    issuer: 'Specialty board',
    lastVerified: '2025-06-15',
    expiresAt: '2026-06-15',
    note: 'Renewal required this cycle.',
  },
]

const INITIAL_TASKS: ClinicianTask[] = [
  {
    id: 'employer-access',
    title: 'Authorize employer review',
    description: 'Grant a single request access to your CRS snapshot.',
    actionLabel: 'Authorize',
    due: 'Within 24 hours',
    status: 'open',
  },
  {
    id: 'license-ack',
    title: 'Confirm license renewal date',
    description: 'Acknowledge the renewal date on file for your state license.',
    actionLabel: 'Acknowledge',
    due: 'This week',
    status: 'open',
  },
  {
    id: 'share-refresh',
    title: 'Re-issue a share link',
    description: 'Send a fresh, time-bound link for the latest PSV request.',
    actionLabel: 'Issue link',
    due: 'Today',
    status: 'open',
  },
]

export default function ClinicianHomePage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [tasks, setTasks] = useState<ClinicianTask[]>(INITIAL_TASKS)
  const [magicLink, setMagicLink] = useState<MagicLinkPayload | null>(null)

  useEffect(() => {
    const { payload, cleanedParams } = parseMagicLink(searchParams)
    const currentParams = searchParams.toString()

    if (cleanedParams !== currentParams) {
      const query = cleanedParams ? `?${cleanedParams}` : ''
      router.replace(`${pathname}${query}`, { scroll: false })
    }

    if (!payload) return
    setMagicLink(payload)
  }, [searchParams, pathname, router])

  const magicTask = useMemo(() => {
    if (!magicLink?.taskId) return null
    return tasks.find((task) => task.id === magicLink.taskId) ?? null
  }, [magicLink, tasks])

  const resolveTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'resolved',
            }
          : task,
      ),
    )
  }

  const handleMagicResolve = () => {
    if (!magicTask) return
    resolveTask(magicTask.id)
    setMagicLink(null)
  }

  const taskList = useMemo(() => {
    const visible = magicTask ? tasks.filter((task) => task.id !== magicTask.id) : tasks
    return visible.slice(0, 3)
  }, [tasks, magicTask])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Clinician Home
              </div>
              <div className="text-sm font-semibold text-foreground">VitalCV</div>
            </div>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
            Read-only workspace
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        {magicLink && (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Magic link re-entry</CardTitle>
                <CardDescription>
                  Resume a single task without navigating away from home.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-primary/30 bg-background px-3 py-1 text-xs"
              >
                <Link2 className="mr-2 h-3 w-3" />
                Active
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {magicTask?.title ?? magicLink.label ?? 'Pending clinician action'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {magicTask?.description ?? 'Complete the requested action in one step.'}
                </p>
              </div>
              {magicTask ? (
                magicTask.status === 'resolved' ? (
                  <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
                    Resolved
                  </Badge>
                ) : (
                  <Button size="sm" onClick={handleMagicResolve}>
                    {magicTask.actionLabel}
                  </Button>
                )
              ) : (
                <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
                  No matching task
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        <CRSCard
          score={CRS_SNAPSHOT.score}
          grade={CRS_SNAPSHOT.grade}
          readiness={CRS_SNAPSHOT.readiness}
          updatedAt={CRS_SNAPSHOT.updatedAt}
          summary={CRS_SNAPSHOT.summary}
          reasons={CRS_SNAPSHOT.reasons}
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <CredentialStatus
            title="Credential snapshot"
            description="Read-only view of credential evidence on file."
            items={CREDENTIAL_ITEMS}
          />

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Action queue</CardTitle>
                <CardDescription>Resolve each task with a single action.</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
                {tasks.filter((task) => task.status === 'open').length} open
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {taskList.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between',
                    task.status === 'resolved' && 'opacity-70',
                  )}
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">{task.title}</div>
                    <p className="text-xs text-muted-foreground">{task.description}</p>
                    <p className="text-xs text-muted-foreground">Due {task.due}</p>
                  </div>
                  {task.status === 'resolved' ? (
                    <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-xs">
                      <CheckCircle2 className="mr-2 h-3 w-3" />
                      Resolved
                    </Badge>
                  ) : (
                    <Button size="sm" onClick={() => resolveTask(task.id)}>
                      {task.actionLabel}
                    </Button>
                  )}
                </div>
              ))}
              {taskList.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-6 text-center text-sm text-muted-foreground">
                  No pending tasks. CRS remains visible for sharing.
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Showing up to three actions to keep focus on CRS.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
