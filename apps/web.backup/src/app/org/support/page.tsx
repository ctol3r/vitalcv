'use client';

/**
 * B142B-FE-003: Organization Support Center
 *
 * Provides a centralized support interface for organization administrators to:
 * - View all open support tickets
 * - Create new support tickets
 * - Filter tickets by status, severity, and category
 * - Track SLA compliance
 * - View ticket history
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LifeBuoy,
  Plus,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  ChevronRight,
} from 'lucide-react';

// Types
enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

enum TicketSeverity {
  SEV1 = 'SEV1',
  SEV2 = 'SEV2',
  SEV3 = 'SEV3',
  SEV4 = 'SEV4',
}

enum TicketCategory {
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  ACCESS = 'ACCESS',
  DATA = 'DATA',
  COMPLIANCE = 'COMPLIANCE',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  INTEGRATION = 'INTEGRATION',
  OTHER = 'OTHER',
}

interface SupportTicket {
  id: string;
  orgId: string;
  userId: string;
  category: TicketCategory;
  severity: TicketSeverity;
  status: TicketStatus;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  slaBreached?: boolean;
  assignedTo?: string;
}

interface TicketFilters {
  status?: TicketStatus;
  severity?: TicketSeverity;
  category?: TicketCategory;
  search?: string;
}

export default function OrgSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TicketFilters>({});
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);

  // New ticket form state
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    category: TicketCategory.TECHNICAL,
    severity: TicketSeverity.SEV3,
  });

  useEffect(() => {
    fetchTickets();
  }, [filters]);

  async function fetchTickets() {
    try {
      setLoading(true);

      // Build query params from filters
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/support/tickets?${params.toString()}`);

      if (!response.ok) throw new Error('Failed to fetch tickets');

      const data = await response.json();
      setTickets(data.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      // Use mock data for demo
      setTickets(getMockTickets());
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTicket,
          orgId: 'org-123', // TODO: Get from auth context
          userId: 'user-456', // TODO: Get from auth context
        }),
      });

      if (!response.ok) throw new Error('Failed to create ticket');

      const data = await response.json();

      // Close dialog and reset form
      setIsNewTicketDialogOpen(false);
      setNewTicket({
        title: '',
        description: '',
        category: TicketCategory.TECHNICAL,
        severity: TicketSeverity.SEV3,
      });

      // Refresh ticket list
      fetchTickets();

      // Show success message
      alert('Support ticket created successfully!');
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket. Please try again.');
    }
  }

  function getMockTickets(): SupportTicket[] {
    return [
      {
        id: 'ticket-001',
        orgId: 'org-123',
        userId: 'user-456',
        category: TicketCategory.TECHNICAL,
        severity: TicketSeverity.SEV2,
        status: TicketStatus.IN_PROGRESS,
        title: 'API Gateway returning 503 errors',
        description: 'Users reporting intermittent 503 errors when calling credential issuance API',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        slaBreached: false,
        assignedTo: 'Support Engineer',
      },
      {
        id: 'ticket-002',
        orgId: 'org-123',
        userId: 'user-789',
        category: TicketCategory.BILLING,
        severity: TicketSeverity.SEV3,
        status: TicketStatus.OPEN,
        title: 'Invoice discrepancy for November',
        description: 'Expected usage charges do not match invoice amount',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        slaBreached: false,
      },
      {
        id: 'ticket-003',
        orgId: 'org-123',
        userId: 'user-456',
        category: TicketCategory.FEATURE_REQUEST,
        severity: TicketSeverity.SEV4,
        status: TicketStatus.RESOLVED,
        title: 'Add bulk credential issuance feature',
        description: 'Request for API endpoint to issue multiple credentials in single call',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        slaBreached: false,
      },
    ];
  }

  function getStatusIcon(status: TicketStatus) {
    switch (status) {
      case TicketStatus.OPEN:
        return <AlertCircle className="h-4 w-4" />;
      case TicketStatus.IN_PROGRESS:
        return <Clock className="h-4 w-4" />;
      case TicketStatus.RESOLVED:
        return <CheckCircle className="h-4 w-4" />;
      case TicketStatus.CLOSED:
        return <XCircle className="h-4 w-4" />;
    }
  }

  function getStatusBadge(status: TicketStatus) {
    const configs = {
      [TicketStatus.OPEN]: { variant: 'default', label: 'Open' },
      [TicketStatus.IN_PROGRESS]: { variant: 'secondary', label: 'In Progress' },
      [TicketStatus.RESOLVED]: { variant: 'default', label: 'Resolved', className: 'bg-green-600' },
      [TicketStatus.CLOSED]: { variant: 'outline', label: 'Closed' },
    };

    const config = configs[status];
    return (
      <Badge variant={config.variant as any} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  function getSeverityBadge(severity: TicketSeverity) {
    const configs = {
      [TicketSeverity.SEV1]: { variant: 'destructive', label: 'SEV1 - Critical' },
      [TicketSeverity.SEV2]: { variant: 'destructive', label: 'SEV2 - High', className: 'bg-orange-600' },
      [TicketSeverity.SEV3]: { variant: 'secondary', label: 'SEV3 - Medium' },
      [TicketSeverity.SEV4]: { variant: 'outline', label: 'SEV4 - Low' },
    };

    const config = configs[severity];
    return (
      <Badge variant={config.variant as any} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  function getCategoryLabel(category: TicketCategory): string {
    return category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  const filteredTickets = tickets.filter(ticket => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!ticket.title.toLowerCase().includes(searchLower) &&
          !ticket.description.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === TicketStatus.OPEN).length,
    inProgress: tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
    slaBreached: tickets.filter(t => t.slaBreached).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-8 w-8" />
            Support Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage support tickets and get help from our team
          </p>
        </div>

        <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue or request. Our support team will respond according to the severity level.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief description of your issue"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(value) => setNewTicket({ ...newTicket, category: value as TicketCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TicketCategory).map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="severity">Severity *</Label>
                  <Select
                    value={newTicket.severity}
                    onValueChange={(value) => setNewTicket({ ...newTicket, severity: value as TicketSeverity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TicketSeverity.SEV1}>SEV1 - Critical (System down)</SelectItem>
                      <SelectItem value={TicketSeverity.SEV2}>SEV2 - High (Major feature unavailable)</SelectItem>
                      <SelectItem value={TicketSeverity.SEV3}>SEV3 - Medium (Minor issue)</SelectItem>
                      <SelectItem value={TicketSeverity.SEV4}>SEV4 - Low (Enhancement)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information about your issue or request..."
                  rows={6}
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                />
              </div>

              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Response Time SLA:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• SEV1: 15 minutes first response</li>
                  <li>• SEV2: 1 hour first response</li>
                  <li>• SEV3: 4 hours first response</li>
                  <li>• SEV4: 1 business day first response</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsNewTicketDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={createTicket}
                disabled={!newTicket.title || !newTicket.description || newTicket.description.length < 20}
              >
                Create Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold">{ticketStats.total}</p>
              </div>
              <LifeBuoy className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">{ticketStats.open}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{ticketStats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SLA Breached</p>
                <p className="text-2xl font-bold">{ticketStats.slaBreached}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  className="pl-8"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? undefined : value as TicketStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.values(TicketStatus).map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={filters.severity || 'all'}
                onValueChange={(value) => setFilters({ ...filters, severity: value === 'all' ? undefined : value as TicketSeverity })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {Object.values(TicketSeverity).map(sev => (
                    <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) => setFilters({ ...filters, category: value === 'all' ? undefined : value as TicketCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.values(TicketCategory).map(cat => (
                    <SelectItem key={cat} value={cat}>{getCategoryLabel(cat)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>
            {filteredTickets.length} ticket(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <LifeBuoy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tickets found</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsNewTicketDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Ticket
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      {ticket.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{ticket.title}</p>
                        {ticket.slaBreached && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            SLA Breach
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(ticket.category)}</Badge>
                    </TableCell>
                    <TableCell>
                      {getSeverityBadge(ticket.severity)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(ticket.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimeAgo(ticket.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/org/support/${ticket.id}`)}
                      >
                        View
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

