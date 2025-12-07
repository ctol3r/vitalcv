'use client';

/**
 * B243C-KMS-024: ArticleEditor UI
 * Provides WYSIWYG editor for creating/editing articles; includes formatting toolbar, preview mode,
 * version history sidebar, comments panel; supports saving draft and submitting for review
 */

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  Send,
  Eye,
  History,
  MessageSquare,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image,
  Code,
  Heading1,
  Heading2,
  Undo,
  Redo,
  FileText,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ArticleEditor() {
  const params = useParams();
  const router = useRouter();
  const articleId = params?.articleId as string;
  const isNew = articleId === 'new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const categories = ['Getting Started', 'API Reference', 'Troubleshooting', 'Best Practices', 'FAQs'];

  // Mock version history - replace with API call
  const versions = [
    {
      id: '1',
      version: 3,
      editor: 'John Doe',
      date: '2024-01-20T14:30:00Z',
      changeSummary: 'Updated authentication section',
    },
    {
      id: '2',
      version: 2,
      editor: 'John Doe',
      date: '2024-01-18T10:15:00Z',
      changeSummary: 'Added code examples',
    },
    {
      id: '3',
      version: 1,
      editor: 'John Doe',
      date: '2024-01-15T09:00:00Z',
      changeSummary: 'Initial version',
    },
  ];

  // Mock comments - replace with API call
  const comments = [
    {
      id: '1',
      author: 'Jane Smith',
      content: 'Consider adding more examples in the authentication section.',
      date: '2024-01-19T11:00:00Z',
      resolved: false,
    },
    {
      id: '2',
      author: 'Mike Johnson',
      content: 'Great work! Ready to publish.',
      date: '2024-01-20T13:00:00Z',
      resolved: true,
    },
  ];

  const insertText = (before: string, after: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);

    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    // Show success message
  };

  const handleSubmitForReview = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    router.push('/knowledge/author/dashboard');
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {isNew ? 'Create New Article' : 'Edit Article'}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? 'Start writing your article' : 'Make changes and save your work'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handleSubmitForReview} disabled={isSaving}>
              <Send className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-3 space-y-6">
            {/* Article Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Article Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter article title..."
                    className="text-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Excerpt</label>
                  <Textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Brief description of the article..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tags</label>
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Add tags (press Enter)"
                    />
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editor */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Content</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={mode === 'edit' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMode('edit')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant={mode === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMode('preview')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {mode === 'edit' ? (
                  <div className="space-y-4">
                    {/* Formatting Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg bg-muted/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('**', '**')}
                        title="Bold"
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('*', '*')}
                        title="Italic"
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('__', '__')}
                        title="Underline"
                      >
                        <Underline className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('# ', '')}
                        title="Heading 1"
                      >
                        <Heading1 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('## ', '')}
                        title="Heading 2"
                      >
                        <Heading2 className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('- ', '')}
                        title="Bullet List"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('1. ', '')}
                        title="Numbered List"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </Button>
                      <div className="w-px h-6 bg-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('`', '`')}
                        title="Inline Code"
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('```\n', '\n```')}
                        title="Code Block"
                      >
                        <Code className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('[', '](url)')}
                        title="Link"
                      >
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertText('![', '](image-url)')}
                        title="Image"
                      >
                        <Image className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Editor Textarea */}
                    <Textarea
                      ref={editorRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Start writing your article... Use markdown formatting."
                      rows={20}
                      className="font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none p-4 border rounded-lg min-h-[400px]">
                    {content ? (
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    ) : (
                      <p className="text-muted-foreground">No content to preview</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            {/* Version History */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Version History
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVersionHistory(!showVersionHistory)}
                  >
                    {showVersionHistory ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showVersionHistory && (
                <CardContent className="space-y-3">
                  {versions.map((version) => (
                    <div key={version.id} className="border-l-2 pl-3 pb-3 last:pb-0">
                      <div className="text-sm font-medium">Version {version.version}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {version.editor} • {formatDate(version.date)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {version.changeSummary}
                      </div>
                      <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs">
                        View Diff
                      </Button>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Comments ({comments.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowComments(!showComments)}
                  >
                    {showComments ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
              {showComments && (
                <CardContent className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="border-b pb-3 last:border-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-sm font-medium">{comment.author}</div>
                        {comment.resolved && (
                          <Badge variant="secondary" className="text-xs">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {formatDate(comment.date)}
                      </div>
                      <div className="text-sm">{comment.content}</div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Add Comment
                  </Button>
                </CardContent>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

