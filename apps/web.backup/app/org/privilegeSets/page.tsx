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
import { Plus, Stethoscope } from "lucide-react";

interface PrivilegeSet {
  id: string;
  name: string;
  department: string;
  specialty?: string;
  procedureCount: number;
  status: "active" | "draft" | "archived";
  createdAt: string;
}

export default function PrivilegeSetsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [privilegeSets, setPrivilegeSets] = useState<PrivilegeSet[]>([]);

  useEffect(() => {
    const loadPrivilegeSets = async () => {
      try {
        const response = await fetch("/api/org/privilege-sets");
        const data = await response.json();

        if (data.success && data.data) {
          setPrivilegeSets(data.data);
        }
      } catch (error) {
        console.error("Failed to load privilege sets:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPrivilegeSets();
  }, []);

  const handleCreateNew = () => {
    router.push("/org/privilegeSets/new");
  };

  const handleRowClick = (id: string) => {
    router.push(`/org/privilegeSets/${id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "outline";
    }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Privilege Sets
            </h1>
            <p className="text-muted-foreground">
              Manage clinical privilege sets for your organization
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            aria-label="Create new privilege set"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Privilege Set
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            All Privilege Sets
          </CardTitle>
          <CardDescription>
            {privilegeSets.length} privilege set{privilegeSets.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {privilegeSets.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No privilege sets yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first privilege set
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Privilege Set
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead className="text-center">Procedures</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {privilegeSets.map((set) => (
                    <TableRow
                      key={set.id}
                      onClick={() => handleRowClick(set.id)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(set.id);
                        }
                      }}
                      aria-label={`View ${set.name} privilege set details`}
                    >
                      <TableCell className="font-medium">{set.name}</TableCell>
                      <TableCell>{set.department}</TableCell>
                      <TableCell>{set.specialty || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{set.procedureCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(set.status)}>
                          {set.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(set.createdAt).toLocaleDateString()}
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

