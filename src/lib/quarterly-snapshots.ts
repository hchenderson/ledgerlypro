import type { QuarterlyReport } from "@/types";

export function nextQuarterlySnapshotRevision(
  reports: QuarterlyReport[],
  snapshotKey: string,
): { revision: number; revisionOf?: string } {
  const prior = reports
    .filter((report) => report.snapshotKey === snapshotKey)
    .sort((left, right) => (left.revision ?? 0) - (right.revision ?? 0));
  return {
    revision: (prior.at(-1)?.revision ?? 0) + 1,
    ...(prior[0]?.id ? { revisionOf: prior[0].id } : {}),
  };
}
