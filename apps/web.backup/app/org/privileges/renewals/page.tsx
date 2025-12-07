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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Search,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PrivilegeRenewal {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetName: string;
  department: string;
  originalApprovalDate: string;
  renewalDue: string;
  status: "pending" | "overdue" | "under_review" | "renewed";
  daysOverdue?: number;
  hasNewEvidence: boolean;
  lastEvidenceSubmitted?: string;
  assignedReviewer?: string;
}

export default function PrivilegeRenewalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [renewals, setRenewals] = useState<PrivilegeRenewal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredRenewals, setFilteredRenewals] = useState<
    PrivilegeRenewal[]
  >([]);

  useEffect(() => {
    const loadRenewals = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch("/api/org/privilege-renewals");
        // const data = await response.json();

        // Mock data
        const mockData: PrivilegeRenewal[] = [
          {
            id: "renewal-001",
            clinicianName: "Dr. Sarah Johnson",
            clinicianNPI: "1234567890",
            privilegeSetName: "Cardiology - Interventional",
            department: "Cardiology",
            originalApprovalDate: "2022-11-10",
            renewalDue: "2024-11-10",
            status: "overdue",
            daysOverdue: 3,
            hasNewEvidence: true,
            lastEvidenceSubmitted: "2024-11-08",
          },
          {
            id: "renewal-002",
            clinicianName: "Dr. Michael Chen",
            clinicianNPI: "2345678901",
            privilegeSetName: "General Surgery - Advanced",
            department: "Surgery",
            originalApprovalDate: "2022-10-15",
            renewalDue: "2024-10-15",
            status: "overdue",
            daysOverdue: 29,
            hasNewEvidence: false,
          },
          {
            id: "renewal-003",
            clinicianName: "Dr. Jennifer Martinez",
            clinicianNPI: "3456789012",
            privilegeSetName: "Emergency Medicine - Level I",
            department: "Emergency Medicine",
            originalApprovalDate: "2023-01-20",
            renewalDue: "2024-12-01",
            status: "pending",
            hasNewEvidence: true,
            lastEvidenceSubmitted: "2024-11-12",
            assignedReviewer: "Dr. Emily Davis",
          },
          {
            id: "renewal-004",
            clinicianName: "Dr. David Lee",
            clinicianNPI: "4567890123",
            privilegeSetName: "Anesthesiology - Cardiac",
            department: "Anesthesiology",
            originalApprovalDate: "2023-02-10",
            renewalDue: "2024-11-25",
            status: "pending",
            hasNewEvidence: true,
            lastEvidenceSubmitted: "2024-11-10",
          },
          {
            id: "renewal-005",
            clinicianName: "Dr. Lisa Anderson",
            clinicianNPI: "5678901234",
            privilegeSetName: "Radiology - Interventional",
            department: "Radiology",
            originalApprovalDate: "2022-09-01",
            renewalDue: "2024-09-01",
            status: "overdue",
            daysOverdue: 73,
            hasNewEvidence: false,
          },
          {
            id: "renewal-006",
            clinicianName: "Dr. Robert Wilson",
            clinicianNPI: "6789012345",
            privilegeSetName: "Orthopedic Surgery",
            department: "Orthopedics",
            originalApprovalDate: "2023-03-15",
            renewalDue: "2024-12-15",
            status: "pending",
            hasNewEvidence: true,
            lastEvidenceSubmitted: "2024-11-13",
            assignedReviewer: "Dr. James Thompson",
          },
        ];

        setRenewals(mockData);
        setFilteredRenewals(mockData);
      } catch (error) {
        console.error("Failed to load privilege renewals:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRenewals();
  }, []);

  // Filter renewals based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRenewals(renewals);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = renewals.filter(
      (renewal) =>
        renewal.clinicianName.toLowerCase().includes(query) ||
        renewal.clinicianNPI.includes(query) ||
        renewal.privilegeSetName.toLowerCase().includes(query) ||
        renewal.department.toLowerCase().includes(query)
    );

    setFilteredRenewals(filtered);
  }, [renewals, searchQuery]);

  const handleRowClick = (id: string) => {
    router.push(`/org/privileges/renewals/${id}`);
  };

  const pendingRenewals = filteredRenewals.filter(
    (r) => r.status === "pending"
  );
  const overdueRenewals = filteredRenewals.filter(
    (r) => r.status === "overdue"
  );

  const renderRenewalTable = (renewals: PrivilegeRenewal[], isOverdue = false) => {
    if (renewals.length === 0) {
      return (
        <div className="text-center py-12">
          <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No {isOverdue ? "overdue" : "pending"} renewals
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search"
              : `No ${
                  isOverdue ? "overdue" : "pending"
                } privilege renewals at this time`}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clinician</TableHead>
              <TableHead>Privilege Set</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Original Approval</TableHead>
              <TableHead>Renewal Due</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renewals.map((renewal) => (
              <TableRow
                key={renewal.id}
                onClick={() => handleRowClick(renewal.id)}
                className="cursor-pointer hover:bg-muted/50"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(renewal.id);
                  }
                }}
                aria-label={`Review renewal for ${renewal.clinicianName}, ${renewal.privilegeSetName}`}
              >
                <TableCell>
                  <div className="font-medium">{renewal.clinicianName}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    NPI: {renewal.clinicianNPI}
                  </div>
                </TableCell>
                <TableCell>{renewal.privilegeSetName}</TableCell>
                <TableCell>
                  <Badge variant="outline">{renewal.department}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(renewal.originalApprovalDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div
                        className={
                          renewal.status === "overdue"
                            ? "text-destructive font-medium"
                            : ""
                        }
                      >
                        {new Date(renewal.renewalDue).toLocaleDateString()}
                      </div>
                      {renewal.daysOverdue && renewal.daysOverdue > 0 && (
                        <div className="text-xs text-destructive font-semibold mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {renewal.daysOverdue} days overdue
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {renewal.hasNewEvidence ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="gap-1">
                        <FileText className="h-3 w-3" />
                        New Evidence
                      </Badge>
                      {renewal.lastEvidenceSubmitted && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(
                            renewal.lastEvidenceSubmitted
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Awaiting Evidence
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {renewal.assignedReviewer || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
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

  const overdueCount = overdueRenewals.length;
  const pendingCount = pendingRenewals.length;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Privilege Renewals
        </h1>
        <p className="text-muted-foreground">
          Review and process privilege renewal requests
        </p>
      </div>

      {/* Alert for overdue renewals */}
      {overdueCount > 0 && (
        <div
          className="mb-6 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md flex items-center gap-3"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">
              {overdueCount} Overdue Renewal{overdueCount !== 1 ? "s" : ""}
            </p>
            <p className="text-sm opacity-90">
              These renewals require immediate attention to maintain compliance
            </p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Renewals</CardDescription>
            <CardTitle className="text-3xl">{renewals.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {overdueCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Renewal Queue
              </CardTitle>
              <CardDescription>
                {filteredRenewals.length} of {renewals.length} renewal
                {renewals.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, NPI, or set..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search privilege renewals"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="overdue" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overdue" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Overdue ({overdueCount})
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="all">All ({filteredRenewals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overdue">
              {renderRenewalTable(overdueRenewals, true)}
            </TabsContent>

            <TabsContent value="pending">
              {renderRenewalTable(pendingRenewals, false)}
            </TabsContent>

            <TabsContent value="all">
              {renderRenewalTable(filteredRenewals, false)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

