'use client';

import { DarkModeToggle } from '@/components/DarkModeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  CredentialEvent,
  clearEventCache,
  formatEventTimestamp,
  getAllEvents,
  getEventTypeInfo,
  getRecentEvents,
} from '@/lib/event-cache';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  FileText,
  RefreshCw,
  Shield,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AccessLogPage() {
  const [events, setEvents] = useState<CredentialEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'recent'>('recent');
  const { toast } = useToast();

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = () => {
    setIsLoading(true);
    try {
      const allEvents = filter === 'recent' ? getRecentEvents(24) : getAllEvents();
      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: '❌ Error',
        description: 'Failed to load access log',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = () => {
    try {
      clearEventCache();
      setEvents([]);
      toast({
        title: '✅ Cache Cleared',
        description: 'All event history has been cleared',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast({
        title: '❌ Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '✅ Copied',
        description: `${type} copied to clipboard`,
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: '❌ Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const getEventIcon = (type: CredentialEvent['type']) => {
    switch (type) {
      case 'issued':
        return <FileText className="h-4 w-4" />;
      case 'verified':
        return <CheckCircle className="h-4 w-4" />;
      case 'revoked':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getEventStats = () => {
    const issued = events.filter((e) => e.type === 'issued').length;
    const verified = events.filter((e) => e.type === 'verified').length;
    const revoked = events.filter((e) => e.type === 'revoked').length;
    return { issued, verified, revoked, total: events.length };
  };

  const stats = getEventStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issuer
            </Link>
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/wallet" className="text-gray-600 hover:text-blue-600 transition-colors">
              Wallet
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
            <DarkModeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Log</h1>
          <p className="text-lg text-gray-600">
            View recent credential events and activity history
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Events</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Issued</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.issued}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Verified</p>
                    <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Revoked</p>
                    <p className="text-2xl font-bold text-red-600">{stats.revoked}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Event History</CardTitle>
                  <CardDescription>
                    {filter === 'recent' ? 'Last 24 hours' : 'All time'} - {events.length} events
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={filter === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('recent')}
                  >
                    Recent
                  </Button>
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    All Time
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadEvents} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearCache}
                    disabled={events.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cache
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                  <span className="ml-3 text-gray-600">Loading events...</span>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No events found</p>
                  <p className="text-sm mt-2">
                    {filter === 'recent'
                      ? 'No events in the last 24 hours'
                      : 'No events recorded yet'}
                  </p>
                  <p className="text-xs mt-1">
                    Events will appear here after issuing, verifying, or revoking credentials
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {events.map((event, index) => {
                      const typeInfo = getEventTypeInfo(event.type);
                      const isLast = index === events.length - 1;

                      return (
                        <div key={event.id} className="relative">
                          {/* Timeline line */}
                          {!isLast && (
                            <div className="absolute left-6 top-12 w-px h-8 bg-gray-200" />
                          )}

                          <div className="flex items-start gap-4 p-4 bg-white/50 rounded-lg border hover:bg-white/70 transition-colors">
                            {/* Event icon */}
                            <div
                              className={`flex-shrink-0 w-12 h-12 rounded-full ${typeInfo.bgColor} ${typeInfo.borderColor} border flex items-center justify-center`}
                            >
                              <span className={typeInfo.color}>{getEventIcon(event.type)}</span>
                            </div>

                            {/* Event content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}
                                  >
                                    {typeInfo.label}
                                  </span>
                                  <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatEventTimestamp(event.timestamp)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {event.auditRef && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        copyToClipboard(event.auditRef!, 'Audit Reference')
                                      }
                                      className="h-7 px-2 text-xs"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Audit
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyToClipboard(event.credentialId, 'Credential ID')
                                    }
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    ID
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-1 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3 w-3 text-gray-400" />
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {event.credentialId}
                                  </span>
                                </div>

                                {event.details?.reason && (
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-3 w-3 text-gray-400" />
                                    <span>
                                      <strong>Reason:</strong> {event.details.reason}
                                    </span>
                                  </div>
                                )}

                                {event.details?.issuer && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-gray-400" />
                                    <span>
                                      <strong>Issuer:</strong> {event.details.issuer}
                                    </span>
                                  </div>
                                )}

                                {event.details?.subjectId && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-gray-400" />
                                    <span>
                                      <strong>Subject:</strong> {event.details.subjectId}
                                    </span>
                                  </div>
                                )}

                                {event.details?.status && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-3 w-3 text-gray-400" />
                                    <span>
                                      <strong>Status:</strong> {event.details.status}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {new Date(event.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {events.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Showing {events.length} event{events.length !== 1 ? 's' : ''}
                      {filter === 'recent' ? ' from last 24 hours' : ' total'}
                    </span>
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/verify?jwt=${events[0]?.credentialId}`}
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        Verify Latest →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
