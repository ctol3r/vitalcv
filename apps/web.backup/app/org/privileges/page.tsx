"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClipboardList, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PrivilegeRequest {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetName: string;
  department: string;
  status: "pending" | "under_review" | "approved" | "denied";
  requestDate: string;
  reviewerName?: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Requests" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

export default function PrivilegeRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PrivilegeRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PrivilegeRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    // Simulate API call - replace with actual API
    const loadRequests = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch("/api/org/privilege-requests");
        // const data = await response.json();

        // Mock data for now
        const mockData: PrivilegeRequest[] = [
          {
            id: "pr-001",
            clinicianName: "Dr. Sarah Johnson",
            clinicianNPI: "1234567890",
            privilegeSetName: "Cardiology - Interventional",
            department: "Cardiology",
            status: "pending",
            requestDate: "2024-11-10T14:30:00Z",
          },
          {
            id: "pr-002",
            clinicianName: "Dr. Michael Chen",
            clinicianNPI: "2345678901",
            privilegeSetName: "General Surgery - Advanced",
            department: "Surgery",
            status: "under_review",
            requestDate: "2024-11-08T09:15:00Z",
            reviewerName: "Dr. Emily Davis",
          },
          {
            id: "pr-003",
            clinicianName: "Dr. Jennifer Martinez",
            clinicianNPI: "3456789012",
            privilegeSetName: "Emergency Medicine - Level I",
            department: "Emergency Medicine",
            status: "approved",
            requestDate: "2024-11-05T16:45:00Z",
            reviewerName: "Dr. Robert Wilson",
          },
          {
            id: "pr-004",
            clinicianName: "Dr. David Lee",
            clinicianNPI: "4567890123",
            privilegeSetName: "Anesthesiology - Cardiac",
            department: "Anesthesiology",
            status: "pending",
            requestDate: "2024-11-12T11:20:00Z",
          },
          {
            id: "pr-005",
            clinicianName: "Dr. Lisa Anderson",
            clinicianNPI: "5678901234",
            privilegeSetName: "Cardiology - Interventional",
            department: "Cardiology",
            status: "denied",
            requestDate: "2024-11-01T08:00:00Z",
            reviewerName: "Dr. James Thompson",
          },
        ];

        setRequests(mockData);
        setFilteredRequests(mockData);
      } catch (error) {
        console.error("Failed to load privilege requests:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  // Filter requests based on search and status
  useEffect(() => {
    let filtered = requests;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.clinicianName.toLowerCase().includes(query) ||
          req.clinicianNPI.includes(query) ||
          req.privilegeSetName.toLowerCase().includes(query) ||
          req.department.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  }, [requests, searchQuery, statusFilter]);

  const handleRowClick = (id: string) => {
    router.push(`/org/privileges/${id}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "pending":
        return "secondary";
      case "under_review":
        return "outline";
      case "denied":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Privilege Request Queue
        </h1>
        <p className="text-muted-foreground">
          Review and approve privilege requests from clinicians
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Privilege Requests
              </CardTitle>
              <CardDescription>
                {filteredRequests.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, NPI, or set..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search privilege requests"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No requests found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No privilege requests to review at this time"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinician</TableHead>
                    <TableHead>NPI</TableHead>
                    <TableHead>Privilege Set</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Reviewer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow
                      key={request.id}
                      onClick={() => handleRowClick(request.id)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowClick(request.id);
                        }
                      }}
                      aria-label={`Review privilege request from ${request.clinicianName}`}
                    >
                      <TableCell className="font-medium">
                        {request.clinicianName}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {request.clinicianNPI}
                      </TableCell>
                      <TableCell>{request.privilegeSetName}</TableCell>
                      <TableCell>{request.department}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {getStatusLabel(request.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(request.requestDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.reviewerName || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

