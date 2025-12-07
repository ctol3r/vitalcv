/**
 * B235C-API-030: API Community Integration
 *
 * Integrates the community forum (from Batch 234) with the DeveloperPortal:
 * creates a dedicated API support section; allows posting questions, tagging with endpoints;
 * adds search.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageSquare, Tag, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  endpointTags?: string[];
  category: string;
  commentCount: number;
  reactionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  apiEndpoint?: string;
}

export default function APISupportForum({ apiEndpoint }: Props) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTags, setNewPostTags] = useState<string[]>([]);
  const [newPostEndpoint, setNewPostEndpoint] = useState('');

  useEffect(() => {
    fetchAPIPosts();
  }, [apiEndpoint]);

  const fetchAPIPosts = async () => {
    setLoading(true);
    try {
      // In production, this would fetch from the community API filtered by API category
      const response = await fetch('/api/community/posts?category=API Support');
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to fetch API posts:', error);
      // Demo data
      setPosts([
        {
          id: '1',
          title: 'How to paginate through credentials?',
          content: 'I\'m trying to fetch all credentials but hitting pagination limits. What\'s the best approach?',
          author: 'developer123',
          tags: ['graphql', 'pagination', 'help'],
          endpointTags: ['credentials'],
          category: 'API Support',
          commentCount: 5,
          reactionCount: 12,
          createdAt: '2025-11-15T10:00:00Z',
          updatedAt: '2025-11-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'API key authentication not working',
          content: 'I\'m getting 401 errors even though I\'m including my API key in the Authorization header.',
          author: 'newdev',
          tags: ['authentication', 'api-keys', 'error'],
          endpointTags: ['*'],
          category: 'API Support',
          commentCount: 8,
          reactionCount: 15,
          createdAt: '2025-11-14T15:30:00Z',
          updatedAt: '2025-11-15T09:00:00Z',
        },
        {
          id: '3',
          title: 'Best practices for rate limiting?',
          content: 'What are the recommended patterns for handling rate limits in production applications?',
          author: 'senior_dev',
          tags: ['rate-limiting', 'best-practices'],
          category: 'API Support',
          commentCount: 12,
          reactionCount: 25,
          createdAt: '2025-11-13T08:00:00Z',
          updatedAt: '2025-11-13T08:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostTitle || !newPostContent) {
      alert('Please fill in title and content');
      return;
    }

    try {
      const tags = [...newPostTags];
      if (newPostEndpoint) {
        tags.push(`endpoint:${newPostEndpoint}`);
      }

      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newPostTitle,
          content: newPostContent,
          category: 'API Support',
          tags,
          endpointTags: newPostEndpoint ? [newPostEndpoint] : undefined,
        }),
      });

      if (response.ok) {
        setShowNewPost(false);
        setNewPostTitle('');
        setNewPostContent('');
        setNewPostTags([]);
        setNewPostEndpoint('');
        fetchAPIPosts();
      } else {
        alert('Failed to create post');
      }
    } catch (error) {
      alert('Error creating post');
    }
  };

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags)));
  const endpointTags = Array.from(new Set(posts.flatMap(p => p.endpointTags || [])));

  const filteredPosts = posts.filter(post => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = !selectedTag || post.tags.includes(selectedTag) || post.endpointTags?.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Support Forum</CardTitle>
              <CardDescription>
                Get help from the community and share your API integration experiences
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowNewPost(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
              <Button variant="outline" asChild>
                <Link href="/community">
                  View Full Forum
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedTag === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTag(null)}
              >
                All
              </Button>
              {allTags.slice(0, 8).map(tag => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>

          {showNewPost && (
            <Card className="mb-4 border-primary">
              <CardHeader>
                <CardTitle>Create New Post</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Title</label>
                  <Input
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="What's your question?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Content</label>
                  <Textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Describe your issue or question..."
                    rows={6}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Related API Endpoint (optional)</label>
                  <Input
                    value={newPostEndpoint}
                    onChange={(e) => setNewPostEndpoint(e.target.value)}
                    placeholder="e.g., credentials, searchOrganizations"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreatePost}>Post</Button>
                  <Button variant="outline" onClick={() => setShowNewPost(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No posts found. Be the first to ask a question!
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map(post => (
                <Card key={post.id} className="hover:bg-muted/50 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link href={`/community/posts/${post.id}`}>
                          <CardTitle className="text-lg hover:text-primary">
                            {post.title}
                          </CardTitle>
                        </Link>
                        <CardDescription className="mt-1">
                          by {post.author} • {new Date(post.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        {post.commentCount}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-3 line-clamp-2">{post.content}</p>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {post.endpointTags && post.endpointTags.map(endpoint => (
                        <Badge key={endpoint} variant="default" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {endpoint}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

