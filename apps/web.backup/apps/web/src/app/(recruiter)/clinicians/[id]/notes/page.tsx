'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { PenLine, Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

type RecruiterNote = {
  id: string;
  note: string;
  recruiterId: string;
  createdAt: string;
  updatedAt?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

export default function RecruiterNotesPage() {
  const params = useParams();
  const clinicianId = params?.id as string;

  const [notes, setNotes] = useState<RecruiterNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [recruiterId, setRecruiterId] = useState('demo-recruiter');
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const timeline = useMemo(
    () => notes.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notes],
  );

  const loadNotes = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/recruiter/notes/${clinicianId}`), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load notes (${response.status})`);
      }
      const data = await response.json();
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (err) {
      console.error('Failed to load recruiter notes', err);
      setError(err instanceof Error ? err.message : 'Unable to load notes');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function handleCreateNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/recruiter/notes/${clinicianId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-recruiter-id': recruiterId,
        },
        body: JSON.stringify({ note: newNote }),
      });
      if (!response.ok) throw new Error('Unable to save note');
      const created = (await response.json()) as RecruiterNote;
      setNotes((prev) => [created, ...prev]);
      setNewNote('');
    } catch (err) {
      console.error('Failed to create note', err);
      setError(err instanceof Error ? err.message : 'Unable to create note');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(noteId: string) {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/recruiter/notes/${clinicianId}/${noteId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: editValue }),
      });
      if (!response.ok) throw new Error('Unable to update note');
      const updated = (await response.json()) as RecruiterNote;
      setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
      setEditingNote(null);
      setEditValue('');
    } catch (err) {
      console.error('Failed to update note', err);
      setError(err instanceof Error ? err.message : 'Unable to update note');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return;
    try {
      const response = await fetch(buildApiUrl(`/api/recruiter/notes/${clinicianId}/${noteId}`), {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Unable to delete note');
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    } catch (err) {
      console.error('Failed to delete note', err);
      setError(err instanceof Error ? err.message : 'Unable to delete note');
    }
  }

  return (
    <div className="container max-w-5xl space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Recruiter · Clinician record</p>
        <h1 className="text-3xl font-bold">Notes & contact history</h1>
        <p className="text-muted-foreground max-w-2xl">
          Maintain an audit-ready log of recruiter touchpoints, decisions, and context for this clinician. Notes are timestamped and
          scoped per recruiter.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add a note
          </CardTitle>
          <CardDescription>Capture outreach rationale, clinician updates, or blockers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recruiter id</label>
              <Input value={recruiterId} onChange={(event) => setRecruiterId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note</label>
              <Textarea
                value={newNote}
                onChange={(event) => setNewNote(event.target.value)}
                placeholder="Document outreach context, readiness shifts, or decisions..."
                className="min-h-[120px]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleCreateNote()} disabled={saving || !newNote.trim()}>
              <Save className="mr-2 h-4 w-4" />
              Save note
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Chronological recruiter touchpoints</CardDescription>
          </div>
          <Badge variant="outline">{timeline.length} entries</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading timeline…</p>
          ) : timeline.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No notes yet. Add the first touchpoint above.
            </div>
          ) : (
            timeline.map((note, index) => (
              <div key={note.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Recruiter {note.recruiterId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingNote(note.id);
                        setEditValue(note.note);
                      }}
                    >
                      <PenLine className="h-4 w-4" />
                      <span className="sr-only">Edit note</span>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleDelete(note.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete note</span>
                    </Button>
                  </div>
                </div>
                {editingNote === note.id ? (
                  <div className="mt-3 space-y-2">
                    <Textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void handleSaveEdit(note.id)} disabled={saving}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.note}</p>
                )}
                {index < timeline.length - 1 && <Separator className="my-6" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}










