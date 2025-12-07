'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  CredentialEvent,
  formatEventTimestamp,
  getEventTypeInfo,
  getEventsForCredential,
} from '@/lib/event-cache';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  History,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface RevocationTimelineProps {
  credentialId: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function RevocationTimeline({ credentialId, isOpen, onToggle }: RevocationTimelineProps) {
  const [events, setEvents] = useState<CredentialEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && credentialId) {
      loadEvents();
    }
  }, [isOpen, credentialId]);

  const loadEvents = () => {
    setIsLoading(true);
    try {
      const credentialEvents = getEventsForCredential(credentialId);
      setEvents(credentialEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: '❌ Error',
        description: 'Failed to load event history',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg">Event Timeline</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <span className="sr-only">Help</span>
                  <span className="text-gray-400">ℹ️</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Shows the complete history of this credential including when it was issued,
                  verified, and any revocation events.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="flex items-center gap-1"
            aria-label={isOpen ? 'Collapse timeline' : 'Expand timeline'}
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {isOpen ? 'Hide' : 'Show'}
          </Button>
        </div>
        <CardDescription>Complete history of credential events and status changes</CardDescription>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading events...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No events found for this credential</p>
              <p className="text-xs mt-1">
                Events will appear here after verification or revocation
              </p>
            </div>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {events.map((event, index) => {
                  const typeInfo = getEventTypeInfo(event.type);
                  const isLast = index === events.length - 1;

                  return (
                    <div key={event.id} className="relative">
                      {/* Timeline line */}
                      {!isLast && <div className="absolute left-4 top-8 w-px h-6 bg-gray-200" />}

                      <div className="flex items-start gap-3">
                        {/* Event icon */}
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full ${typeInfo.bgColor} ${typeInfo.borderColor} border flex items-center justify-center`}
                        >
                          <span className={typeInfo.color}>{getEventIcon(event.type)}</span>
                        </div>

                        {/* Event content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${typeInfo.color} ${typeInfo.bgColor}`}
                              >
                                {typeInfo.label}
                              </Badge>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatEventTimestamp(event.timestamp)}
                              </span>
                            </div>

                            {event.auditRef && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(event.auditRef!, 'Audit Reference')}
                                className="h-6 px-2 text-xs"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy Audit
                              </Button>
                            )}
                          </div>

                          <div className="text-sm text-gray-700">
                            {event.details?.reason && (
                              <p className="mb-1">
                                <strong>Reason:</strong> {event.details.reason}
                              </p>
                            )}
                            {event.details?.issuer && (
                              <p className="mb-1">
                                <strong>Issuer:</strong> {event.details.issuer}
                              </p>
                            )}
                            {event.details?.subjectId && (
                              <p className="mb-1">
                                <strong>Subject:</strong> {event.details.subjectId}
                              </p>
                            )}
                            {event.details?.status && (
                              <p className="mb-1">
                                <strong>Status:</strong> {event.details.status}
                              </p>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
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
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {events.length} event{events.length !== 1 ? 's' : ''} recorded
                </span>
                <Button variant="ghost" size="sm" onClick={loadEvents} className="h-6 px-2 text-xs">
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
