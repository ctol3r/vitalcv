'use client';

/**
 * B243C-KMS-025: TagManagement UI
 * Interface for admins/editors to create, edit, and delete tags; shows tag usage count and
 * search by name; allows merging or deprecating tags; validates uniqueness
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Merge,
  Archive,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  usageCount: number;
  status: 'active' | 'deprecated';
  createdAt: string;
}

// Mock data - replace with API call
const mockTags: Tag[] = [
  { id: '1', name: 'authentication', usageCount: 45, status: 'active', createdAt: '2024-01-01' },
  { id: '2', name: 'credentials', usageCount: 38, status: 'active', createdAt: '2024-01-02' },
  { id: '3', name: 'api', usageCount: 32, status: 'active', createdAt: '2024-01-03' },
  { id: '4', name: 'security', usageCount: 28, status: 'active', createdAt: '2024-01-04' },
  { id: '5', name: 'setup', usageCount: 25, status: 'active', createdAt: '2024-01-05' },
  { id: '6', name: 'legacy-tag', usageCount: 5, status: 'deprecated', createdAt: '2023-12-01' },
];

export default function TagManagement() {
  const [tags, setTags] = useState<Tag[]>(mockTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deprecated'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [mergeSource, setMergeSource] = useState<Tag | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [error, setError] = useState('');

  const filteredTags = tags.filter((tag) => {
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tag.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const validateTagName = (name: string, excludeId?: string): boolean => {
    if (!name.trim()) {
      setError('Tag name cannot be empty');
      return false;
    }
    if (name.length < 2) {
      setError('Tag name must be at least 2 characters');
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      setError('Tag name can only contain lowercase letters, numbers, and hyphens');
      return false;
    }
    const exists = tags.some((tag) => tag.name === name && tag.id !== excludeId);
    if (exists) {
      setError('Tag name already exists');
      return false;
    }
    setError('');
    return true;
  };

  const handleCreateTag = () => {
    if (!validateTagName(newTagName)) return;

    const newTag: Tag = {
      id: Date.now().toString(),
      name: newTagName.trim().toLowerCase(),
      usageCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    setTags([...tags, newTag]);
    setNewTagName('');
    setIsCreateDialogOpen(false);
    setError('');
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
    setIsEditDialogOpen(true);
    setError('');
  };

  const handleUpdateTag = () => {
    if (!editingTag || !validateTagName(newTagName, editingTag.id)) return;

    setTags(
      tags.map((tag) =>
        tag.id === editingTag.id ? { ...tag, name: newTagName.trim().toLowerCase() } : tag
      )
    );
    setEditingTag(null);
    setNewTagName('');
    setIsEditDialogOpen(false);
    setError('');
  };

  const handleDeleteTag = (tag: Tag) => {
    if (tag.usageCount > 0) {
      if (!confirm(`This tag is used in ${tag.usageCount} articles. Are you sure you want to delete it?`)) {
        return;
      }
    }
    setTags(tags.filter((t) => t.id !== tag.id));
  };

  const handleDeprecateTag = (tag: Tag) => {
    setTags(
      tags.map((t) =>
        t.id === tag.id ? { ...t, status: t.status === 'active' ? 'deprecated' : 'active' } : t
      )
    );
  };

  const handleStartMerge = (tag: Tag) => {
    setMergeSource(tag);
    setMergeTarget('');
    setIsMergeDialogOpen(true);
  };

  const handleMergeTags = () => {
    if (!mergeSource || !mergeTarget) return;

    const targetTag = tags.find((t) => t.id === mergeTarget);
    if (!targetTag) return;

    // Merge: add source usage count to target, remove source
    setTags(
      tags.map((t) =>
        t.id === mergeTarget
          ? { ...t, usageCount: t.usageCount + mergeSource.usageCount }
          : t
      ).filter((t) => t.id !== mergeSource.id)
    );

    setIsMergeDialogOpen(false);
    setMergeSource(null);
    setMergeTarget('');
  };

  const sortedTags = [...filteredTags].sort((a, b) => {
    if (statusFilter === 'deprecated') {
      return b.usageCount - a.usageCount;
    }
    return b.usageCount - a.usageCount;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Tag Management</h1>
            <p className="text-muted-foreground">
              Create, edit, and manage tags used across knowledge base articles
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tag</DialogTitle>
                <DialogDescription>
                  Enter a unique tag name. Use lowercase letters, numbers, and hyphens only.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Input
                    value={newTagName}
                    onChange={(e) => {
                      setNewTagName(e.target.value);
                      if (error) validateTagName(e.target.value);
                    }}
                    placeholder="tag-name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTag();
                    }}
                  />
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTag} disabled={!!error || !newTagName.trim()}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags by name..."
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="deprecated">Deprecated Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {sortedTags.length} tag{sortedTags.length !== 1 ? 's' : ''} found
            </div>
          </CardContent>
        </Card>

        {/* Tags List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTags.map((tag) => (
            <Card key={tag.id} className={cn(tag.status === 'deprecated' && 'opacity-60')}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{tag.name}</CardTitle>
                  </div>
                  {tag.status === 'deprecated' && (
                    <Badge variant="secondary">Deprecated</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Usage Count</span>
                    <span className="font-medium">{tag.usageCount} articles</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(tag.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTag(tag)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartMerge(tag)}
                      className="flex-1"
                    >
                      <Merge className="h-3 w-3 mr-1" />
                      Merge
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeprecateTag(tag)}
                      className="flex-1"
                    >
                      <Archive className="h-3 w-3 mr-1" />
                      {tag.status === 'active' ? 'Deprecate' : 'Reactivate'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteTag(tag)}
                      className="flex-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedTags.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <TagIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tags found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? `No tags match "${searchQuery}"`
                  : 'Create your first tag to get started'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tag</DialogTitle>
              <DialogDescription>
                Update the tag name. Make sure it's unique and follows naming conventions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Input
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    if (error && editingTag) validateTagName(e.target.value, editingTag.id);
                  }}
                  placeholder="tag-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTag();
                  }}
                />
                {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTag} disabled={!!error || !newTagName.trim()}>
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merge Dialog */}
        <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merge Tags</DialogTitle>
              <DialogDescription>
                Merge "{mergeSource?.name}" into another tag. All articles using the source tag
                will be updated to use the target tag.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Merge into</label>
                <Select value={mergeTarget} onValueChange={setMergeTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags
                      .filter((t) => t.id !== mergeSource?.id && t.status === 'active')
                      .map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name} ({tag.usageCount} articles)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMergeTags} disabled={!mergeTarget}>
                Merge Tags
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

