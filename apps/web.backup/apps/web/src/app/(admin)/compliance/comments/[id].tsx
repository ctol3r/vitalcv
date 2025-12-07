'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, Clock, FileText, MessageCircle, ShieldAlert, ShieldCheck } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

type CommentSeverity = 'info' | 'warning' | 'critical'

type AuditorComment = {
  id: string
  author: string
  role: string
  timestamp: string
  severity: CommentSeverity
  body: string
  status: 'open' | 'resolved' | 'pending'
  attachments?: string[]
  internal?: boolean
}

type CommentThread = {
  id: string
  subject: string
  facility: string
  riskScore: number
  status: 'open' | 'resolved'
  lastUpdated: string
  watchers: string[]
  tags: string[]
  dossierLink?: string
  comments: AuditorComment[]
}

export default function AuditorCommentThreadPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const threadId = params?.id ?? 'thread-demo'

  const [thread, setThread] = useState<CommentThread>(() => buildMockThread(threadId))
  const [newComment, setNewComment] = useState('')
  const [severity, setSeverity] = useState<CommentSeverity>('info')
  const [markResolved, setMarkResolved] = useState(false)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const filteredComments = useMemo(() => {
    if (filter === 'all') return thread.comments
    return thread.comments.filter((comment) => comment.status === filter)
  }, [thread.comments, filter])

  const handleSubmit = () => {
    if (!newComment.trim()) {
      toast({ title: 'Message required', description: 'Add a comment before posting.', variant: 'destructive' })
      return
    }

    const comment: AuditorComment = {
      id: `local-${Date.now()}`,
      author: 'You',
      role: 'Issuing CVO',
      timestamp: new Date().toISOString(),
      severity,
      body: newComment.trim(),
      status: markResolved ? 'resolved' : 'open',
      attachments: [],
    }

    setThread((prev) => ({
      ...prev,
      status: markResolved ? 'resolved' : prev.status,
      lastUpdated: comment.timestamp,
      comments: [comment, ...prev.comments],
    }))

    setNewComment('')
    setSeverity('info')
    setMarkResolved(false)
    toast({ title: 'Comment posted', description: 'Auditors notified via thread watchers.' })
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Admin • Compliance</p>
        <h1 className="text-3xl font-semibold tracking-tight">Auditor comment thread</h1>
        <p className="text-muted-foreground max-w-3xl">
          Collaborative thread between site auditors and the issuer. Attach evidence, resolve deltas, and leave attestations with full
          provenance.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{thread.subject}</CardTitle>
              <CardDescription>Facility: {thread.facility}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Updated {new Date(thread.lastUpdated).toLocaleString()}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Risk score {thread.riskScore}%
                </span>
                <Separator orientation="vertical" className="h-4" />
                <Badge variant={thread.status === 'resolved' ? 'secondary' : 'destructive'} className="capitalize">
                  {thread.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {thread.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Watchers:</span>
                {thread.watchers.map((watcher) => (
                  <Badge key={watcher} variant="outline">
                    {watcher}
                  </Badge>
                ))}
              </div>
              {thread.dossierLink && (
                <Button asChild variant="outline" size="sm">
                  <a href={thread.dossierLink} target="_blank" rel="noreferrer">
                    <FileText className="mr-2 h-4 w-4" />
                    Open dossier
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reply to thread</CardTitle>
              <CardDescription>Post attestation notes, remediation steps, or attach new evidence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="comment">Message</Label>
                  <Textarea
                    id="comment"
                    placeholder="Summarize findings, reference evidence IDs, or tag next steps."
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    rows={4}
                  />
                </div>
                <div className="w-full space-y-2 md:w-64">
                  <Label>Severity</Label>
                  <Select value={severity} onValueChange={(value) => setSeverity(value as CommentSeverity)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informational</SelectItem>
                      <SelectItem value="warning">Requires action</SelectItem>
                      <SelectItem value="critical">Blocking / critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="markResolved">Mark resolved</Label>
                      <p className="text-xs text-muted-foreground">Close open action item once remediation is complete.</p>
                    </div>
                    <Switch id="markResolved" checked={markResolved} onCheckedChange={setMarkResolved} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Button variant="ghost" size="sm">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Attach evidence
                </Button>
                <Button variant="ghost" size="sm">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Add attestation
                </Button>
                <Separator orientation="vertical" className="hidden h-4 md:block" />
                <Input placeholder="Add watcher@example.com" className="w-full md:w-auto" />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => setNewComment('')}>
                  Reset
                </Button>
                <Button onClick={handleSubmit}>Post comment</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Timeline</CardTitle>
                <CardDescription>{thread.comments.length} comments across issuers and auditors.</CardDescription>
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[540px] pr-4">
                <div className="space-y-6">
                  {filteredComments.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} />
                  ))}
                  {filteredComments.length === 0 && (
                    <p className="text-sm text-muted-foreground">No comments match the selected filter.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thread metadata</CardTitle>
              <CardDescription>Operational context for the auditors assigned.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Thread ID</span>
                <span className="font-mono">{thread.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Facility</span>
                <span>{thread.facility}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current status</span>
                <Badge variant={thread.status === 'resolved' ? 'secondary' : 'destructive'}>{thread.status}</Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Linked systems</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">NCQA CR4</Badge>
                  <Badge variant="outline">PSV Packet #4431</Badge>
                  <Badge variant="outline">Audit anchor 0x93ab…1f</Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Escalation playbooks</Label>
                <div className="space-y-2">
                  <Button variant="ghost" className="w-full justify-start text-left text-sm" size="sm">
                    <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                    Trigger surge review
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-left text-sm" size="sm">
                    <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" />
                    Attach NCQA attestation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto-actions</CardTitle>
              <CardDescription>Suggested remediation steps detected from thread context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-md border p-3">
                <p className="font-medium text-foreground">Refresh CME proof</p>
                <p className="text-sm">Latest CR5 evidence is 10 months old. Auto-fetch from CME registry?</p>
                <Button variant="link" size="sm" className="px-0">
                  Launch action →
                </Button>
              </div>
              <div className="rounded-md border p-3">
                <p className="font-medium text-foreground">Anchor updated PSV packet</p>
                <p className="text-sm">PSV packet v7 uploaded with new sanctions attestation.</p>
                <Button variant="link" size="sm" className="px-0">
                  Anchor evidence →
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function CommentCard({ comment }: { comment: AuditorComment }) {
  const severityIcon =
    comment.severity === 'critical' ? (
      <ShieldAlert className="h-4 w-4 text-destructive" />
    ) : comment.severity === 'warning' ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : (
      <MessageCircle className="h-4 w-4 text-muted-foreground" />
    )

  return (
    <div className="flex gap-4 rounded-lg border p-4">
      <Avatar>
        <AvatarFallback>{comment.author.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{comment.author}</span>
          <Badge variant="outline">{comment.role}</Badge>
          <span className="text-muted-foreground">• {new Date(comment.timestamp).toLocaleString()}</span>
          <Badge variant={comment.status === 'resolved' ? 'secondary' : 'destructive'} className="capitalize">
            {comment.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {severityIcon}
          <span className="capitalize">{comment.severity}</span>
        </div>
        <p className="text-sm">{comment.body}</p>
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {comment.attachments.map((attachment) => (
              <Badge key={attachment} variant="outline">
                {attachment}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function buildMockThread(id: string): CommentThread {
  return {
    id,
    subject: 'CR4 peer review escalation – sedation privileges',
    facility: 'Northwind Medical Center',
    riskScore: 62,
    status: 'open',
    lastUpdated: new Date().toISOString(),
    watchers: ['auditor@northwind.org', 'credentialing@issuer.health'],
    tags: ['NCQA CR4', 'Peer Review', 'PSV Packet'],
    dossierLink: '#',
    comments: [
      {
        id: 'c1',
        author: 'Northwind Auditor',
        role: 'Facility Compliance',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        severity: 'warning',
        body: 'Need updated PSV packet with sedation attestation attached. Current file is missing CR4 evidence.',
        status: 'open',
        attachments: ['psv-packet-v6.pdf'],
      },
      {
        id: 'c2',
        author: 'Issuer HITL',
        role: 'HITL Analyst',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        severity: 'info',
        body: 'Auto-generated PSV v7 with sedation attachments queued for anchor. Will upload within the hour.',
        status: 'open',
      },
    ],
  }
}

