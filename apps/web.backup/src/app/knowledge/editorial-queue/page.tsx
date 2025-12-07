'use client';

/**
 * B243C-KMS-027: EditorialQueue UI
 * Lists articles awaiting review: shows status, assigned reviewer, last updated; provides buttons
 * to approve, request changes, or reject; includes filters and bulk actions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Filter,
  User,
  Calendar,
  Clock,
  FileText,
  Search,
} from 'lucide-react';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  slug: string;
  author: string;
  category: string;
  status: 'pending' | 'changes-requested';
  assignedReviewer?: string;
  submittedAt: string;
  lastUpdated: string;
  priority: 'low' | 'medium' | 'high';
}

// Mock data - replace with API call
const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Advanced API Configuration',
    slug: 'advanced-api-config',
    author: 'John Doe',
    category: 'API Reference',
    status: 'pending',
    assignedReviewer: 'Jane Smith',
    submittedAt: '2024-01-19T10:00:00Z',
    lastUpdated: '2024-01-19T10:00:00Z',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Security Best Practices Guide',
    slug: 'security-best-practices',
    author: 'Mike Johnson',
    category: 'Best Practices',
    status: 'changes-requested',
    assignedReviewer: 'Jane Smith',
    submittedAt: '2024-01-18T14:30:00Z',
    lastUpdated: '2024-01-20T09:15:00Z',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Troubleshooting Common Issues',
    slug: 'troubleshooting-common-issues',
    author: 'Sarah Williams',
    category: 'Troubleshooting',
    status: 'pending',
    assignedReviewer: 'Mike Johnson',
    submittedAt: '2024-01-17T11:20:00Z',
    lastUpdated: '2024-01-17T11:20:00Z',
    priority: 'low',
  },
];

export default function EditorialQueue() {
  const [articles, setArticles] = useState<Article[]>(mockArticles);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewerFilter, setReviewerFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isRequestChangesDialogOpen, setIsRequestChangesDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [actionArticleId, setActionArticleId] = useState<string | null>(null);

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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const getPriorityBadge = (priority: Article['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium Priority</Badge>;
      case 'low':
        return <Badge variant="secondary">Low Priority</Badge>;
    }
  };

  const filteredArticles = articles.filter((article) => {
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    const matchesReviewer =
      reviewerFilter === 'all' || article.assignedReviewer === reviewerFilter;
    const matchesPriority = priorityFilter === 'all' || article.priority === priorityFilter;
    const matchesSearch =
      !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.author.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesReviewer && matchesPriority && matchesSearch;
  });

  const reviewers = Array.from(
    new Set(articles.map((a) => a.assignedReviewer).filter(Boolean))
  ) as string[];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticles(filteredArticles.map((a) => a.id));
    } else {
      setSelectedArticles([]);
    }
  };

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    if (checked) {
      setSelectedArticles([...selectedArticles, articleId]);
    } else {
      setSelectedArticles(selectedArticles.filter((id) => id !== articleId));
    }
  };

  const handleApprove = (articleId: string) => {
    setActionArticleId(articleId);
    setIsApproveDialogOpen(true);
  };

  const handleReject = (articleId: string) => {
    setActionArticleId(articleId);
    setIsRejectDialogOpen(true);
  };

  const handleRequestChanges = (articleId: string) => {
    setActionArticleId(articleId);
    setIsRequestChangesDialogOpen(true);
  };

  const confirmApprove = () => {
    if (actionArticleId) {
      setArticles(articles.filter((a) => a.id !== actionArticleId));
      setIsApproveDialogOpen(false);
      setActionArticleId(null);
      setFeedback('');
    }
  };

  const confirmReject = () => {
    if (actionArticleId && feedback.trim()) {
      setArticles(articles.filter((a) => a.id !== actionArticleId));
      setIsRejectDialogOpen(false);
      setActionArticleId(null);
      setFeedback('');
    }
  };

  const confirmRequestChanges = () => {
    if (actionArticleId && feedback.trim()) {
      setArticles(
        articles.map((a) =>
          a.id === actionArticleId
            ? { ...a, status: 'changes-requested' as const, lastUpdated: new Date().toISOString() }
            : a
        )
      );
      setIsRequestChangesDialogOpen(false);
      setActionArticleId(null);
      setFeedback('');
    }
  };

  const handleBulkApprove = () => {
    setArticles(articles.filter((a) => !selectedArticles.includes(a.id)));
    setSelectedArticles([]);
  };

  const handleBulkReject = () => {
    setArticles(articles.filter((a) => !selectedArticles.includes(a.id)));
    setSelectedArticles([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Editorial Queue</h1>
          <p className="text-muted-foreground">
            Review and manage articles awaiting approval
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="changes-requested">Changes Requested</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Reviewers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviewers</SelectItem>
                  {reviewers.map((reviewer) => (
                    <SelectItem key={reviewer} value={reviewer}>
                      {reviewer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedArticles.length > 0 && (
              <div className="mt-4 flex items-center gap-2 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedArticles.length} selected
                </span>
                <Button variant="outline" size="sm" onClick={handleBulkApprove}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Selected
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkReject}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Selected
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles List */}
        <div className="space-y-4">
          {filteredArticles.map((article) => (
            <Card key={article.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedArticles.includes(article.id)}
                    onCheckedChange={(checked) =>
                      handleSelectArticle(article.id, checked as boolean)
                    }
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link
                            href={`/knowledge/${article.slug}`}
                            className="text-xl font-semibold hover:text-primary"
                          >
                            {article.title}
                          </Link>
                          {getPriorityBadge(article.priority)}
                          <Badge variant={article.status === 'pending' ? 'default' : 'secondary'}>
                            {article.status === 'pending' ? 'Pending' : 'Changes Requested'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {article.author}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            Reviewer: {article.assignedReviewer || 'Unassigned'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Submitted {formatRelativeTime(article.submittedAt)}
                          </span>
                          <Badge variant="outline">{article.category}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApprove(article.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRequestChanges(article.id)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Request Changes
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReject(article.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/knowledge/${article.slug}`}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Article
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No articles in queue</h3>
              <p className="text-muted-foreground">All articles have been reviewed!</p>
            </CardContent>
          </Card>
        )}

        {/* Approve Dialog */}
        <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Article</DialogTitle>
              <DialogDescription>
                Are you sure you want to approve this article? It will be published immediately.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmApprove}>Approve</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Article</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this article. The author will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Rejection reason..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmReject} disabled={!feedback.trim()}>
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Changes Dialog */}
        <Dialog open={isRequestChangesDialogOpen} onOpenChange={setIsRequestChangesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Changes</DialogTitle>
              <DialogDescription>
                Provide feedback on what needs to be changed. The author will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What changes are needed?"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRequestChangesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmRequestChanges} disabled={!feedback.trim()}>
                Request Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

