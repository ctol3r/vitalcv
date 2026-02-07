import { describe, it, expect } from "vitest";
import { DomainError } from "@vitalcv/domain-common";

import {
  assertCanAccept,
  assertCanStart,
} from "../src/wedge/assertions";

describe("Wedge domain invariants", () => {
  it("Start without Recognition → throws", () => {
    expect(() => {
      const acceptance = {} as any;
      assertCanStart(acceptance, []);
    }).toThrow(DomainError);
  });

  it("Acceptance without Recognition → throws", () => {
    expect(() => {
      assertCanAccept(undefined);
    }).toThrow(DomainError);
  });

  it("Start without Acceptance → throws", () => {
    expect(() => {
      assertCanStart(undefined, []);
    }).toThrow(DomainError);
  });

  it("Recognition without verification → throws", () => {
    expect(() => {
      assertCanAccept(null);
    }).toThrow(DomainError);
  });

  it("Acceptance without facilityId → throws", () => {
    expect(() => {
      assertCanAccept(undefined);
    }).toThrow(DomainError);
  });
});