import { describe, it, expect } from "vitest";
import { resolveConflicts } from "../resolve";
import {
  agreement,
  conflictName,
  missingInHigherSource,
  intraSourceDuplicate,
  canonicalizationMasksConflict,
  winningSourceInternallyInconsistent,
  arrayReorder,
  objectKeyReorder,
  nullAsClaim,
} from "./fixtures";

describe("resolveConflicts", () => {
  describe("empty input", () => {
    it("returns empty result for empty array", () => {
      const result = resolveConflicts([]);
      expect(result.fields).toEqual({});
      expect(result.conflicts).toEqual([]);
    });
  });

  describe("single record", () => {
    it("returns AGREED for a single record", () => {
      const result = resolveConflicts([missingInHigherSource[0]]);
      const field = result.fields["specialty"];
      expect(field.status).toBe("AGREED");
      expect(field.chosen?.source).toBe("NPPES");
      expect(field.chosen?.value).toBe("Cardiology");
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("agreement", () => {
    it("resolves as AGREED when sources match, chosen = highest rank", () => {
      const result = resolveConflicts(agreement);
      const field = result.fields["name"];

      expect(field.status).toBe("AGREED");
      expect(field.chosen?.source).toBe("STATE");
      expect(field.chosen?.value).toBe("John Smith");
      expect(field.candidates).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("cross-source conflict", () => {
    it("resolves as RESOLVED, chosen = highest rank source", () => {
      const result = resolveConflicts(conflictName);
      const field = result.fields["name"];

      expect(field.status).toBe("RESOLVED");
      expect(field.reason).toBe("CROSS_SOURCE");
      expect(field.chosen?.source).toBe("STATE");
      expect(field.chosen?.value).toBe("Jonathan A. Smith");
      expect(field.candidates).toHaveLength(2);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].field).toBe("name");
    });
  });

  describe("missing in higher source", () => {
    it("resolves as AGREED when only one source provides the field", () => {
      const result = resolveConflicts(missingInHigherSource);
      const field = result.fields["specialty"];

      expect(field.status).toBe("AGREED");
      expect(field.chosen?.source).toBe("NPPES");
      expect(field.chosen?.value).toBe("Cardiology");
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("intra-source duplicate", () => {
    it("resolves as UNRESOLVED when one source has conflicting values", () => {
      const result = resolveConflicts(intraSourceDuplicate);
      const field = result.fields["state"];

      expect(field.status).toBe("UNRESOLVED");
      expect(field.reason).toBe("INTRA_SOURCE_DUPLICATE");
      expect(field.chosen).toBeNull();
      expect(field.candidates).toHaveLength(2);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("canonicalization masks conflict", () => {
    it("treats whitespace/case differences as agreement", () => {
      const result = resolveConflicts(canonicalizationMasksConflict);
      const field = result.fields["name"];

      expect(field.status).toBe("AGREED");
      // Chosen is STATE's raw value (highest rank)
      expect(field.chosen?.source).toBe("STATE");
      expect(field.chosen?.value).toBe("john smith");
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("winning source internally inconsistent", () => {
    it("resolves as UNRESOLVED when highest-rank source has internal conflict", () => {
      const result = resolveConflicts(winningSourceInternallyInconsistent);
      const field = result.fields["name"];

      expect(field.status).toBe("UNRESOLVED");
      expect(field.reason).toBe("INTRA_SOURCE_DUPLICATE");
      expect(field.chosen).toBeNull();
      expect(field.candidates).toHaveLength(3);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("array reorder", () => {
    it("treats differently-ordered arrays as agreement after sort", () => {
      const result = resolveConflicts(arrayReorder);
      const field = result.fields["practiceStates"];

      expect(field.status).toBe("AGREED");
      expect(field.chosen?.source).toBe("STATE");
      // Raw value from STATE — the original order
      expect(field.chosen?.value).toEqual(["NY", "CA"]);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("object key reorder", () => {
    it("treats differently-ordered keys as agreement after sort", () => {
      const result = resolveConflicts(objectKeyReorder);
      const field = result.fields["address"];

      expect(field.status).toBe("AGREED");
      expect(field.chosen?.source).toBe("STATE");
      // Raw value from STATE — the original key order
      expect(field.chosen?.value).toEqual({
        city: "Springfield",
        street: "123 Main St",
      });
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("null as claim", () => {
    it("treats null as a real value that competes via priority", () => {
      const result = resolveConflicts(nullAsClaim);
      const field = result.fields["specialty"];

      expect(field.status).toBe("RESOLVED");
      expect(field.reason).toBe("CROSS_SOURCE");
      // STATE wins even though its value is null
      expect(field.chosen?.source).toBe("STATE");
      expect(field.chosen?.value).toBeNull();
      expect(field.candidates).toHaveLength(2);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe("multi-field resolution", () => {
    it("resolves each field independently", () => {
      const result = resolveConflicts([
        // name agrees
        { source: "NPPES", field: "name", value: "John", confidence: 0.9, verified: true, timestamp: 1 },
        { source: "STATE", field: "name", value: "John", confidence: 0.9, verified: true, timestamp: 2 },
        // specialty conflicts
        { source: "NPPES", field: "specialty", value: "Cardiology", confidence: 0.9, verified: true, timestamp: 1 },
        { source: "STATE", field: "specialty", value: "Internal Medicine", confidence: 0.9, verified: true, timestamp: 2 },
      ]);

      expect(result.fields["name"].status).toBe("AGREED");
      expect(result.fields["specialty"].status).toBe("RESOLVED");
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].field).toBe("specialty");
    });
  });

  describe("same source, same value", () => {
    it("treats duplicate records from same source with same value as AGREED", () => {
      const result = resolveConflicts([
        { source: "NPPES", field: "name", value: "John", confidence: 0.9, verified: true, timestamp: 1 },
        { source: "NPPES", field: "name", value: "John", confidence: 0.85, verified: true, timestamp: 2 },
      ]);

      expect(result.fields["name"].status).toBe("AGREED");
      expect(result.fields["name"].chosen?.source).toBe("NPPES");
    });
  });

  describe("conflicts projection correctness", () => {
    it("conflicts array matches non-AGREED fields", () => {
      const result = resolveConflicts(conflictName);

      const nonAgreed = Object.values(result.fields).filter(
        (f) => f.status !== "AGREED"
      );
      expect(result.conflicts).toHaveLength(nonAgreed.length);
      for (const conflict of result.conflicts) {
        expect(result.fields[conflict.field]).toBe(conflict);
      }
    });
  });
});
