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
import { ClipboardCheck, Search, AlertTriangle, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OppeRecord {
  id: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  evaluationType: "FPPE" | "OPPE";
  privilegeSetName: string;
  dueDate: string;
  lastEvaluationDate?: string;
  status: "upcoming" | "due_soon" | "overdue" | "completed";
  assignedReviewer?: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Evaluations" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due Soon (30 days)" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

export default function OppeDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<OppeRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<OppeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    // Simulate API call - replace with actual API
    const loadRecords = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch("/api/org/oppe-records");
        // const data = await response.json();

        // Mock data
        const mockData: OppeRecord[] = [
          {
            id: "oppe-001",
            clinicianName: "Dr. Sarah Johnson",
            clinicianNPI: "1234567890",
            department: "Cardiology",
            evaluationType: "FPPE",
            privilegeSetName: "Cardiology - Interventional",
            dueDate: "2024-11-15",
            status: "overdue",
            assignedReviewer: "Dr. Emily Davis",
          },
          {
            id: "oppe-002",
            clinicianName: "Dr. Michael Chen",
            clinicianNPI: "2345678901",
            department: "Surgery",
            evaluationType: "OPPE",
            privilegeSetName: "General Surgery - Advanced",
            dueDate: "2024-12-01",
            lastEvaluationDate: "2024-06-01",
            status: "due_soon",
            assignedReviewer: "Dr. Robert Wilson",
          },
          {
            id: "oppe-003",
            clinicianName: "Dr. Jennifer Martinez",
            clinicianNPI: "3456789012",
            department: "Emergency Medicine",
            evaluationType: "OPPE",
            privilegeSetName: "Emergency Medicine - Level I",
            dueDate: "2025-01-15",
            lastEvaluationDate: "2024-07-15",
            status: "upcoming",
          },
          {
            id: "oppe-004",
            clinicianName: "Dr. David Lee",
            clinicianNPI: "4567890123",
            department: "Anesthesiology",
            evaluationType: "FPPE",
            privilegeSetName: "Anesthesiology - Cardiac",
            dueDate: "2024-11-20",
            status: "due_soon",
          },
          {
            id: "oppe-005",
            clinicianName: "Dr. Lisa Anderson",
            clinicianNPI: "5678901234",
            department: "Radiology",
            evaluationType: "OPPE",
            privilegeSetName: "Interventional Radiology",
            dueDate: "2024-10-01",
            lastEvaluationDate: "2024-04-01",
            status: "completed",
            assignedReviewer: "Dr. James Thompson",
          },
        ];

        setRecords(mockData);
        setFilteredRecords(mockData);
      } catch (error) {
        console.error("Failed to load OPPE records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, []);

  // Filter records
  useEffect(() => {
    let filtered = records;

    // Apply tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((rec) => rec.evaluationType === activeTab);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((rec) => rec.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (rec) =>
          rec.clinicianName.toLowerCase().includes(query) ||
          rec.clinicianNPI.includes(query) ||
          rec.department.toLowerCase().includes(query) ||
          rec.privilegeSetName.toLowerCase().includes(query)
      );
    }

    setFilteredRecords(filtered);
  }, [records, searchQuery, statusFilter, activeTab]);

  const handleRowClick = (record: OppeRecord) => {
    const path = record.evaluationType === "FPPE"
      ? `/org/oppe/fppe/${record.id}`
      : `/org/oppe/oppe/${record.id}`;
    router.push(path);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "upcoming":
        return "secondary";
      case "due_soon":
        return "outline";
      case "overdue":
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

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const days = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const overdueCount = records.filter((r) => r.status === "overdue").length;
  const dueSoonCount = records.filter((r) => r.status === "due_soon").length;
  const fppeCount = records.filter((r) => r.evaluationType === "FPPE").length;
  const oppeCount = records.filter((r) => r.evaluationType === "OPPE").length;

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
          FPPE/OPPE Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor focused and ongoing professional practice evaluations
        </p>
      </div>

      {/* Alert for overdue evaluations */}
      {overdueCount > 0 && (
        <div className="mb-6 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">
              {overdueCount} Overdue Evaluation{overdueCount !== 1 ? 's' : ''}
            </p>
            <p className="text-sm opacity-90">
              These evaluations require immediate attention
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Evaluations</CardDescription>
            <CardTitle className="text-3xl">{records.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>FPPE (Initial)</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{fppeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>OPPE (Ongoing)</CardDescription>
            <CardTitle className="text-3xl text-green-600">{oppeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Needs Attention
            </CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {overdueCount + dueSoonCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Evaluation Records
                </CardTitle>
                <CardDescription>
                  {filteredRecords.length} of {records.length} record{records.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, NPI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search evaluations"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({records.length})</TabsTrigger>
              <TabsTrigger value="FPPE">FPPE ({fppeCount})</TabsTrigger>
              <TabsTrigger value="OPPE">OPPE ({oppeCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No records found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || statusFilter !== "all"
                      ? "Try adjusting your filters"
                      : "No evaluation records at this time"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clinician</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Privilege Set</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => {
                        const daysUntil = getDaysUntilDue(record.dueDate);

                        return (
                          <TableRow
                            key={record.id}
                            onClick={() => handleRowClick(record)}
                            className="cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleRowClick(record);
                              }
                            }}
                            aria-label={`Review ${record.evaluationType} evaluation for ${record.clinicianName}`}
                          >
                            <TableCell className="font-medium">
                              {record.clinicianName}
                              <div className="text-xs text-muted-foreground font-mono">
                                {record.clinicianNPI}
                              </div>
                            </TableCell>
                            <TableCell>{record.department}</TableCell>
                            <TableCell>{record.privilegeSetName}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  record.evaluationType === "FPPE"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {record.evaluationType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span>
                                  {new Date(record.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                              {daysUntil < 0 && (
                                <p className="text-xs text-destructive font-medium mt-1">
                                  {Math.abs(daysUntil)} days overdue
                                </p>
                              )}
                              {daysUntil >= 0 && daysUntil <= 30 && (
                                <p className="text-xs text-orange-600 font-medium mt-1">
                                  {daysUntil} days remaining
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(record.status)}>
                                {getStatusLabel(record.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.assignedReviewer || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

