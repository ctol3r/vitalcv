'use client'

import { useMemo, useState } from 'react'
import {
  Users,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  Clock,
  X,
  Send,
  Star,
  Briefcase,
  GraduationCap,
  MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'

type Mentor = {
  id: string
  name: string
  title: string
  specialty: string
  organization: string
  location: string
  experience: string
  rating: number
  reviewCount: number
  bio: string
  expertise: string[]
  availability: 'available' | 'limited' | 'unavailable'
}

type MentorshipRequest = {
  id: string
  mentorId: string
  mentorName: string
  status: 'pending' | 'accepted' | 'rejected' | 'active'
  message: string
  sentAt: string
  respondedAt?: string
}

type ActiveMentorship = {
  id: string
  mentorId: string
  mentorName: string
  mentorTitle: string
  startedAt: string
  lastMessageAt: string
  unreadCount: number
}

type MentorshipMatchData = {
  suggestions: Mentor[]
  requests: MentorshipRequest[]
  activeMentorships: ActiveMentorship[]
}

export default function MentorshipMatchPage() {
  const [selectedTab, setSelectedTab] = useState<'suggestions' | 'requests' | 'active'>('suggestions')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)
  const [inviteMessage, setInviteMessage] = useState('')
  const [srMessage, setSrMessage] = useState('')

  const data = useMemo(() => buildMockData(), [])

  const handleSendInvite = async () => {
    if (!selectedMentor) return
    setSrMessage(`Sending mentorship request to ${selectedMentor.name}`)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSrMessage(`Mentorship request sent to ${selectedMentor.name}`)
    setShowInviteDialog(false)
    setInviteMessage('')
    setSelectedMentor(null)
    setTimeout(() => setSrMessage(''), 2000)
  }

  const handleAcceptRequest = async (requestId: string) => {
    setSrMessage('Accepting mentorship request')
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSrMessage('Mentorship request accepted')
    setTimeout(() => setSrMessage(''), 2000)
  }

  const handleRejectRequest = async (requestId: string) => {
    setSrMessage('Rejecting mentorship request')
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSrMessage('Mentorship request rejected')
    setTimeout(() => setSrMessage(''), 2000)
  }

  const openInviteDialog = (mentor: Mentor) => {
    setSelectedMentor(mentor)
    setShowInviteDialog(true)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Mentorship • Match</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" aria-hidden="true" />
              Mentorship Match
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Connect with experienced mentors, manage mentorship requests, and maintain active mentorship relationships.
            </p>
          </div>
          <Link href="/demo/user/career/dashboard">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setSelectedTab('suggestions')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            selectedTab === 'suggestions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Mentor Suggestions ({data.suggestions.length})
        </button>
        <button
          onClick={() => setSelectedTab('requests')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            selectedTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Requests ({data.requests.length})
        </button>
        <button
          onClick={() => setSelectedTab('active')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            selectedTab === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active Mentorships ({data.activeMentorships.length})
        </button>
      </div>

      {/* Mentor Suggestions */}
      {selectedTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Based on your specialty and career goals, we've matched you with these mentors.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.suggestions.map((mentor) => (
              <Card key={mentor.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{mentor.name}</CardTitle>
                      <CardDescription className="mt-1">{mentor.title}</CardDescription>
                    </div>
                    <Badge
                      variant={
                        mentor.availability === 'available'
                          ? 'default'
                          : mentor.availability === 'limited'
                            ? 'secondary'
                            : 'outline'
                      }
                      className="capitalize"
                    >
                      {mentor.availability}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="h-4 w-4" />
                      {mentor.organization}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {mentor.location}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      {mentor.specialty} • {mentor.experience}
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{mentor.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({mentor.reviewCount} reviews)</span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3">{mentor.bio}</p>

                  <div className="flex flex-wrap gap-1">
                    {mentor.expertise.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {mentor.expertise.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{mentor.expertise.length - 3} more
                      </Badge>
                    )}
                  </div>

                  <Button
                    onClick={() => openInviteDialog(mentor)}
                    disabled={mentor.availability === 'unavailable'}
                    className="w-full mt-auto"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Mentorship Request
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Mentorship Requests */}
      {selectedTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage incoming and outgoing mentorship requests.
            </p>
          </div>
          <div className="space-y-4">
            {data.requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{request.mentorName}</h3>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{request.message}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Sent: {request.sentAt}</span>
                        {request.respondedAt && <span>Responded: {request.respondedAt}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {request.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleAcceptRequest(request.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectRequest(request.id)}>
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      {request.status === 'accepted' && (
                        <Link href={`/demo/mentorship/chat?mentor=${request.mentorId}`}>
                          <Button size="sm">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {data.requests.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No mentorship requests at this time.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Active Mentorships */}
      {selectedTab === 'active' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Your active mentorship relationships.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.activeMentorships.map((mentorship) => (
              <Card key={mentorship.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{mentorship.mentorName}</CardTitle>
                      <CardDescription>{mentorship.mentorTitle}</CardDescription>
                    </div>
                    {mentorship.unreadCount > 0 && (
                      <Badge variant="destructive">{mentorship.unreadCount}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Started: {mentorship.startedAt}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last message: {mentorship.lastMessageAt}
                    </div>
                    <Link href={`/demo/mentorship/chat?mentor=${mentorship.mentorId}`}>
                      <Button className="w-full">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Open Messages
                        {mentorship.unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {mentorship.unreadCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {data.activeMentorships.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No active mentorships. Start by sending a mentorship request!</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSelectedTab('suggestions')}
                  >
                    Browse Mentor Suggestions
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Send Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Mentorship Request</DialogTitle>
            <DialogDescription>
              Send a mentorship request to {selectedMentor?.name}. They'll be notified and can accept or decline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Message</label>
              <Textarea
                placeholder="Introduce yourself and explain why you'd like to connect..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={5}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendInvite} disabled={!inviteMessage.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: MentorshipRequest['status'] }) {
  const config = {
    pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
    accepted: { label: 'Accepted', variant: 'default' as const, icon: CheckCircle2 },
    rejected: { label: 'Rejected', variant: 'destructive' as const, icon: X },
    active: { label: 'Active', variant: 'default' as const, icon: CheckCircle2 },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

function buildMockData(): MentorshipMatchData {
  return {
    suggestions: [
      {
        id: 'mentor1',
        name: 'Dr. Sarah Chen',
        title: 'Senior Cardiologist',
        specialty: 'Cardiology',
        organization: 'Northwind Medical Center',
        location: 'San Francisco, CA',
        experience: '15 years',
        rating: 4.9,
        reviewCount: 47,
        bio: 'Experienced cardiologist specializing in interventional cardiology and cardiac catheterization. Passionate about mentoring the next generation of cardiologists.',
        expertise: ['Interventional Cardiology', 'Cardiac Catheterization', 'Mentorship', 'Research'],
        availability: 'available',
      },
      {
        id: 'mentor2',
        name: 'Dr. Michael Rodriguez',
        title: 'Chief Medical Officer',
        specialty: 'General Practice',
        organization: 'Healthcare Innovations Group',
        location: 'New York, NY',
        experience: '20 years',
        rating: 4.7,
        reviewCount: 32,
        bio: 'Healthcare executive and practicing physician with expertise in telemedicine, practice management, and healthcare technology.',
        expertise: ['Telemedicine', 'Practice Management', 'Healthcare Technology', 'Leadership'],
        availability: 'limited',
      },
      {
        id: 'mentor3',
        name: 'Dr. Emily Watson',
        title: 'Pediatric Emergency Medicine Specialist',
        specialty: 'Pediatrics',
        organization: 'Children\'s Hospital',
        location: 'Boston, MA',
        experience: '12 years',
        rating: 4.8,
        reviewCount: 28,
        bio: 'Dedicated pediatric emergency medicine physician with extensive experience in pediatric advanced life support and emergency care.',
        expertise: ['Pediatric Emergency', 'PALS', 'Emergency Medicine', 'Teaching'],
        availability: 'available',
      },
    ],
    requests: [
      {
        id: 'req1',
        mentorId: 'mentor1',
        mentorName: 'Dr. Sarah Chen',
        status: 'pending',
        message: 'I would love to learn more about interventional cardiology and advance my career in this field.',
        sentAt: '2025-11-10',
        respondedAt: undefined,
      },
      {
        id: 'req2',
        mentorId: 'mentor2',
        mentorName: 'Dr. Michael Rodriguez',
        status: 'accepted',
        message: 'Interested in learning about telemedicine implementation and practice management.',
        sentAt: '2025-11-05',
        respondedAt: '2025-11-06',
      },
    ],
    activeMentorships: [
      {
        id: 'active1',
        mentorId: 'mentor2',
        mentorName: 'Dr. Michael Rodriguez',
        mentorTitle: 'Chief Medical Officer',
        startedAt: '2025-11-06',
        lastMessageAt: '2025-11-15',
        unreadCount: 2,
      },
    ],
  }
}

