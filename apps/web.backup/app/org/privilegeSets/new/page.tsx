"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Procedure {
  id: string;
  name: string;
  code?: string;
}

const DEPARTMENTS = [
  "Cardiology",
  "Surgery",
  "Emergency Medicine",
  "Anesthesiology",
  "Radiology",
  "Internal Medicine",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Psychiatry",
  "Orthopedic Surgery",
];

const COMMON_PROCEDURES = [
  { id: "p1", name: "Coronary Angiography", code: "CPT-93454" },
  { id: "p2", name: "PCI (Percutaneous Coronary Intervention)", code: "CPT-92920" },
  { id: "p3", name: "Appendectomy", code: "CPT-44970" },
  { id: "p4", name: "Cholecystectomy", code: "CPT-47562" },
  { id: "p5", name: "Central Line Insertion", code: "CPT-36556" },
  { id: "p6", name: "Endotracheal Intubation", code: "CPT-31500" },
  { id: "p7", name: "Thoracentesis", code: "CPT-32554" },
  { id: "p8", name: "Lumbar Puncture", code: "CPT-62270" },
];

export default function CreatePrivilegeSetPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    department: "",
    specialty: "",
    description: "",
    minimumCaseVolume: "",
    yearsExperienceRequired: "",
    boardCertificationRequired: false,
  });

  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [newProcedureName, setNewProcedureName] = useState("");
  const [newProcedureCode, setNewProcedureCode] = useState("");

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Privilege set name is required";
    }

    if (!formData.department) {
      newErrors.department = "Department is required";
    }

    if (procedures.length === 0) {
      newErrors.procedures = "At least one procedure is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddProcedure = () => {
    if (!newProcedureName.trim()) return;

    const newProcedure: Procedure = {
      id: `proc-${Date.now()}`,
      name: newProcedureName.trim(),
      code: newProcedureCode.trim() || undefined,
    };

    setProcedures([...procedures, newProcedure]);
    setNewProcedureName("");
    setNewProcedureCode("");
    setErrors({ ...errors, procedures: "" });
  };

  const handleRemoveProcedure = (id: string) => {
    setProcedures(procedures.filter((p) => p.id !== id));
  };

  const handleAddCommonProcedure = (procedure: { id: string; name: string; code?: string }) => {
    if (procedures.some((p) => p.name === procedure.name)) return;

    const newProcedure: Procedure = {
      id: `proc-${Date.now()}`,
      name: procedure.name,
      code: procedure.code,
    };

    setProcedures([...procedures, newProcedure]);
    setErrors({ ...errors, procedures: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/org/privilege-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, procedures }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create privilege set");
      }

      // Redirect to list page
      router.push("/org/privilegeSets");
    } catch (error) {
      console.error("Failed to create privilege set:", error);
      setErrors({ submit: error instanceof Error ? error.message : "Failed to create privilege set. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
          aria-label="Go back to privilege sets list"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Privilege Sets
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Create Privilege Set
        </h1>
        <p className="text-muted-foreground">
          Define a new privilege set with required procedures and qualifications
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Core details about this privilege set
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Privilege Set Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Cardiology - Interventional"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setErrors({ ...errors, name: "" });
                  }}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  required
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">
                  Department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => {
                    setFormData({ ...formData, department: value });
                    setErrors({ ...errors, department: "" });
                  }}
                >
                  <SelectTrigger
                    id="department"
                    aria-invalid={!!errors.department}
                    aria-describedby={errors.department ? "department-error" : undefined}
                  >
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && (
                  <p id="department-error" className="text-sm text-destructive" role="alert">
                    {errors.department}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty (Optional)</Label>
                <Input
                  id="specialty"
                  placeholder="e.g., Interventional Cardiology"
                  value={formData.specialty}
                  onChange={(e) =>
                    setFormData({ ...formData, specialty: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the scope and purpose of this privilege set..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Qualification Requirements</CardTitle>
              <CardDescription>
                Minimum qualifications for this privilege set
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">Years of Experience</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    placeholder="e.g., 5"
                    value={formData.yearsExperienceRequired}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        yearsExperienceRequired: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caseVolume">Minimum Annual Case Volume</Label>
                  <Input
                    id="caseVolume"
                    type="number"
                    min="0"
                    placeholder="e.g., 50"
                    value={formData.minimumCaseVolume}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minimumCaseVolume: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Procedures */}
          <Card>
            <CardHeader>
              <CardTitle>
                Procedures <span className="text-destructive">*</span>
              </CardTitle>
              <CardDescription>
                Add procedures included in this privilege set
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Common Procedures */}
              <div>
                <Label className="mb-2 block">Quick Add Common Procedures</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PROCEDURES.map((proc) => (
                    <Button
                      key={proc.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddCommonProcedure(proc)}
                      disabled={procedures.some((p) => p.name === proc.name)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {proc.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Procedure Input */}
              <div className="space-y-2">
                <Label>Add Custom Procedure</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Procedure name"
                    value={newProcedureName}
                    onChange={(e) => setNewProcedureName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddProcedure();
                      }
                    }}
                  />
                  <Input
                    placeholder="Code (optional)"
                    className="w-40"
                    value={newProcedureCode}
                    onChange={(e) => setNewProcedureCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddProcedure();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddProcedure}
                    disabled={!newProcedureName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Procedure List */}
              {procedures.length > 0 && (
                <div>
                  <Label className="mb-2 block">
                    Selected Procedures ({procedures.length})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {procedures.map((procedure) => (
                      <Badge
                        key={procedure.id}
                        variant="secondary"
                        className="gap-2 pr-1"
                      >
                        <span>
                          {procedure.name}
                          {procedure.code && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({procedure.code})
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProcedure(procedure.id)}
                          className="hover:bg-secondary-foreground/20 rounded-full p-0.5"
                          aria-label={`Remove ${procedure.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {errors.procedures && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.procedures}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          {errors.submit && (
            <div
              className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded"
              role="alert"
            >
              {errors.submit}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Privilege Set"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

