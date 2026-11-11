import { describe, expect, it } from "vitest";

import { nextQuarterlySnapshotRevision } from "@/lib/quarterly-snapshots";
import type { QuarterlyReport } from "@/types";

describe("quarterly snapshot revisions", () => {
  it("keeps legacy snapshots separate and creates distinct revisions", () => {
    const reports = [
      { id: "Q1 2025", period: "Q1 2025" },
      { id: "first", snapshotKey: "scope", revision: 1 },
      { id: "second", snapshotKey: "scope", revision: 2 },
      { id: "other", snapshotKey: "different", revision: 7 },
    ] as QuarterlyReport[];

    expect(nextQuarterlySnapshotRevision(reports, "scope")).toEqual({
      revision: 3,
      revisionOf: "first",
    });
    expect(nextQuarterlySnapshotRevision(reports, "new-scope")).toEqual({
      revision: 1,
    });
  });
});
