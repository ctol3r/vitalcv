import { describe, it, expect } from "vitest";

import { assertCanAccept } from "../guards/assertCanAccept";
import { assertCanStart } from "../guards/assertCanStart";

describe("Wedge domain invariants", () => {
  it("Start without Acceptance → throws", () => {
    expect(() => {
      assertCanStart(undefined, []);
    }).toThrow(/Acceptance is required/);
  });

  it("Start with null Acceptance → throws", () => {
    expect(() => {
      assertCanStart(null, []);
    }).toThrow(/Acceptance is required/);
  });

  it("Acceptance without Recognition → throws", () => {
    expect(() => {
      assertCanAccept(undefined);
    }).toThrow(/Recognition is required/);
  });

  it("Acceptance with null Recognition → throws", () => {
    expect(() => {
      assertCanAccept(null);
    }).toThrow(/Recognition is required/);
  });
});
