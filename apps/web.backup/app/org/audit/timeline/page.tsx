"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Search,
  Shield,
  CreditCard,
  Building2,
  Bot,
  User,
  Clock,
  ChevronRight
} from "lucide-react";

type EventType = "privileges" | "payer" | "ehr" | "agent";

interface AuditEvent {
  id: string;
  timestamp: string;
  type: EventType;
  actor: string;
  action: string;
  resource: string;
  description: string;
  metadata: Record<string, any>;
  severity: "info" | "warning" | "critical";
}

const EVENT_TYPE_CONFIG = {
  privileges: {
    label: "Privileges",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  payer: {
    label: "Payer",
    icon: CreditCard,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  ehr: {
    label: "EHR",
    icon: Building2,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  agent: {
    label: "Agent",
    icon: Bot,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
};

const MOCK_EVENTS: AuditEvent[] = [
  {
    id: "evt-001",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    type: "privileges",
    actor: "admin@hospital.org",
    action: "privilege_granted",
    resource: "Dr. Sarah Johnson (NPI: 1234567890)",
    description: "Granted surgical privileges for Cardiology",
    metadata: { privilegeSet: "Cardiology - Interventional", department: "Cardiology" },
    severity: "info",
  },
  {
    id: "evt-002",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    type: "payer",
    actor: "system",
    action: "enrollment_updated",
    resource: "Aetna Commercial",
    description: "Payer enrollment status updated to Active",
    metadata: { payerId: "AETNA-001", effectiveDate: "2024-11-01" },
    severity: "info",
  },
  {
    id: "evt-003",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    type: "agent",
    actor: "agent-001",
    action: "credential_verified",
    resource: "Board Certification",
    description: "Verified ABMS board certification for Dr. Michael Chen",
    metadata: { npi: "2345678901", certificationDate: "2020-06-15" },
    severity: "info",
  },
  {
    id: "evt-004",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    type: "ehr",
    action: "data_sync",
    actor: "ehr-integration",
    resource: "Epic FHIR Endpoint",
    description: "Provider roster synchronized with EHR system",
    metadata: { recordsUpdated: 47, syncDuration: "2.3s" },
    severity: "info",
  },
  {
    id: "evt-005",
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    type: "privileges",
    actor: "dept-head@hospital.org",
    action: "privilege_revoked",
    resource: "Dr. David Lee (NPI: 4567890123)",
    description: "Temporarily suspended privileges pending review",
    metadata: { reason: "FPPE in progress", reviewDate: "2024-11-20" },
    severity: "warning",
  },
  {
    id: "evt-006",
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    type: "payer",
    actor: "credentialing@hospital.org",
    action: "enrollment_submitted",
    resource: "United Healthcare",
    description: "New payer enrollment application submitted",
    metadata: { payerId: "UHC-002", applicationId: "APP-2024-1234" },
    severity: "info",
  },
  {
    id: "evt-007",
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    type: "agent",
    actor: "agent-002",
    action: "anomaly_detected",
    resource: "License Expiration Alert",
    description: "Detected upcoming license expiration for 3 providers",
    metadata: { affectedProviders: 3, expirationWindow: "30 days" },
    severity: "warning",
  },
];

export default function AuditTimelinePage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<AuditEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    // Simulate API call
    const loadEvents = async () => {
      try {
        // TODO: Replace with actual API endpoint
        // const response = await fetch("/api/org/audit/timeline");
        // const data = await response.json();
        setEvents(MOCK_EVENTS);
        setFilteredEvents(MOCK_EVENTS);
      } catch (error) {
        console.error("Failed to load audit events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  // Filter events
  useEffect(() => {
    let filtered = events;

    if (typeFilter !== "all") {
      filtered = filtered.filter((evt) => evt.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (evt) =>
          evt.actor.toLowerCase().includes(query) ||
          evt.action.toLowerCase().includes(query) ||
          evt.resource.toLowerCase().includes(query) ||
          evt.description.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, typeFilter]);

  const handleEventClick = (event: AuditEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const handleKeyboardNavigation = (event: React.KeyboardEvent, auditEvent: AuditEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleEventClick(auditEvent);
    }
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    }

    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) {
      return `${diffHrs} hour${diffHrs !== 1 ? "s" : ""} ago`;
    }

    return date.toLocaleString();
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge variant="outline" className="border-orange-600 text-orange-600">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          Audit Timeline
        </h1>
        <p className="text-muted-foreground">
          Real-time activity log for privileges, payer enrollment, EHR integration, and agent actions
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Events</CardTitle>
          <CardDescription>
            {filteredEvents.length} of {events.length} events shown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by actor, action, or resource..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search audit events"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as EventType | "all")}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="privileges">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    Privileges
                  </div>
                </SelectItem>
                <SelectItem value="payer">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3" />
                    Payer
                  </div>
                </SelectItem>
                <SelectItem value="ehr">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    EHR
                  </div>
                </SelectItem>
                <SelectItem value="agent">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3" />
                    Agent
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No audit events at this time"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredEvents.map((event, index) => {
            const config = EVENT_TYPE_CONFIG[event.type];
            const Icon = config.icon;

            return (
              <Card
                key={event.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleEventClick(event)}
                onKeyDown={(e) => handleKeyboardNavigation(e, event)}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${event.action} event`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${config.bgColor} flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{config.label}</Badge>
                          {getSeverityBadge(event.severity)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          <time dateTime={event.timestamp}>
                            {formatTimestamp(event.timestamp)}
                          </time>
                        </div>
                      </div>

                      <h3 className="font-semibold mb-1">
                        {event.action.split("_").map(word =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(" ")}
                      </h3>

                      <p className="text-sm text-muted-foreground mb-2">
                        {event.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.actor}
                          </span>
                          <span className="truncate">{event.resource}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Detail Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = EVENT_TYPE_CONFIG[selectedEvent.type].icon;
                    return <Icon className={`h-5 w-5 ${EVENT_TYPE_CONFIG[selectedEvent.type].color}`} />;
                  })()}
                  Event Details
                </SheetTitle>
                <SheetDescription>
                  {selectedEvent.id}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold mb-3">Overview</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Action:</span>
                      <p className="font-medium mt-1">
                        {selectedEvent.action.split("_").map(word =>
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(" ")}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1">{selectedEvent.description}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Resource:</span>
                      <p className="mt-1 font-mono text-xs">{selectedEvent.resource}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actor:</span>
                      <p className="mt-1 font-mono text-xs">{selectedEvent.actor}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Timestamp:</span>
                      <p className="mt-1">
                        {new Date(selectedEvent.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Severity:</span>
                      <div className="mt-1">
                        {getSeverityBadge(selectedEvent.severity)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {Object.keys(selectedEvent.metadata).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Additional Details</h3>
                    <div className="rounded-lg border bg-muted/50 p-3">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(selectedEvent.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={`/admin/audit-export?event=${selectedEvent.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Export Event Details
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

