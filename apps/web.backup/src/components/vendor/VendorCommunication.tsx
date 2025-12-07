'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Phone, Mail, Clock, User, Tag, Send, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface VendorCommunicationProps {
  vendorId: string
}

interface Communication {
  id: string
  type: 'call' | 'message' | 'note' | 'email'
  subject?: string
  content: string
  author: string
  authorRole?: string
  createdAt: string
  tags?: string[]
  mentions?: string[]
}

export function VendorCommunication({ vendorId }: VendorCommunicationProps) {
  const [communications, setCommunications] = useState<Communication[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [newNoteSubject, setNewNoteSubject] = useState('')
  const [newNoteTags, setNewNoteTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [selectedType, setSelectedType] = useState<'note' | 'call' | 'message' | 'email'>('note')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchCommunications()
  }, [vendorId])

  useEffect(() => {
    scrollToBottom()
  }, [communications])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function fetchCommunications() {
    try {
      setLoading(true)
      const response = await fetch(`/api/demo/vendor/${vendorId}/communications`)
      if (!response.ok) throw new Error('Failed to fetch communications')
      const payload = await response.json()
      setCommunications(payload.communications || [])
    } catch (err) {
      console.error('Failed to fetch communications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitNote() {
    if (!newNote.trim()) return

    try {
      const response = await fetch(`/api/demo/vendor/${vendorId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          content: newNote,
          subject: newNoteSubject || undefined,
          tags: newNoteTags,
        }),
      })

      if (!response.ok) throw new Error('Failed to save communication')

      setNewNote('')
      setNewNoteSubject('')
      setNewNoteTags([])
      await fetchCommunications()
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  function addTag() {
    if (tagInput.trim() && !newNoteTags.includes(tagInput.trim())) {
      setNewNoteTags([...newNoteTags, tagInput.trim()])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setNewNoteTags(newNoteTags.filter((t) => t !== tag))
  }

  function getTypeIcon(type: Communication['type']) {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />
      case 'message':
        return <MessageSquare className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'note':
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  function getTypeLabel(type: Communication['type']) {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const notes = communications.filter((c) => c.type === 'note')
  const calls = communications.filter((c) => c.type === 'call')
  const messages = communications.filter((c) => c.type === 'message' || c.type === 'email')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Communication & Notes</h2>
        <p className="text-sm text-muted-foreground">
          Log calls, send messages, and write notes about vendor interactions
        </p>
      </div>

      {/* New Communication Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Communication</CardTitle>
          <CardDescription>
            Log a call, send a message, or write a note
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(selectedType === 'message' || selectedType === 'email') && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={newNoteSubject}
                onChange={(e) => setNewNoteSubject(e.target.value)}
                placeholder="Enter subject..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>
              {selectedType === 'call' ? 'Call Notes' : selectedType === 'note' ? 'Note' : 'Message'}
            </Label>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={
                selectedType === 'call'
                  ? 'Enter call notes...'
                  : selectedType === 'note'
                  ? 'Write a note...'
                  : 'Enter message...'
              }
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2 flex-wrap mb-2">
              {newNoteTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Add tag and press Enter..."
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button onClick={handleSubmitNote} disabled={!newNote.trim()}>
            <Send className="h-4 w-4 mr-2" />
            Submit
          </Button>
        </CardContent>
      </Card>

      {/* Communication History */}
      <Card>
        <CardHeader>
          <CardTitle>Communication History</CardTitle>
          <CardDescription>
            Timeline of all communications with this vendor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({communications.length})</TabsTrigger>
              <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
              <TabsTrigger value="calls">Calls ({calls.length})</TabsTrigger>
              <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {communications.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {communications
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((comm) => (
                      <Card key={comm.id}>
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(comm.type)}
                                <span className="font-medium">{getTypeLabel(comm.type)}</span>
                                {comm.subject && (
                                  <span className="text-sm text-muted-foreground">
                                    - {comm.subject}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(comm.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <div className="text-sm">{comm.content}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {comm.author}
                                {comm.authorRole && ` (${comm.authorRole})`}
                              </div>
                              {comm.tags && comm.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {comm.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      <Tag className="h-3 w-3 mr-1" />
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No communications yet
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              {notes.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {notes.map((comm) => (
                    <Card key={comm.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Note</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comm.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm">{comm.content}</div>
                          <div className="text-xs text-muted-foreground">
                            By {comm.author}
                            {comm.authorRole && ` (${comm.authorRole})`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No notes yet</div>
              )}
            </TabsContent>

            <TabsContent value="calls" className="space-y-4 mt-4">
              {calls.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {calls.map((comm) => (
                    <Card key={comm.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span className="font-medium">Call</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comm.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm">{comm.content}</div>
                          <div className="text-xs text-muted-foreground">
                            By {comm.author}
                            {comm.authorRole && ` (${comm.authorRole})`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No calls logged yet</div>
              )}
            </TabsContent>

            <TabsContent value="messages" className="space-y-4 mt-4">
              {messages.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {messages.map((comm) => (
                    <Card key={comm.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {comm.type === 'email' ? (
                                <Mail className="h-4 w-4" />
                              ) : (
                                <MessageSquare className="h-4 w-4" />
                              )}
                              <span className="font-medium">
                                {comm.type === 'email' ? 'Email' : 'Message'}
                              </span>
                              {comm.subject && (
                                <span className="text-sm text-muted-foreground">
                                  - {comm.subject}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comm.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm">{comm.content}</div>
                          <div className="text-xs text-muted-foreground">
                            By {comm.author}
                            {comm.authorRole && ` (${comm.authorRole})`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

