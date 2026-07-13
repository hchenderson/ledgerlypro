import { describe, expect, it } from "vitest";

import { chunkArray } from "./batching";

describe("chunkArray", () => {
  it("keeps every write below the configured batch size", () => {
    const chunks = chunkArray(Array.from({ length: 1_001 }, (_, index) => index), 450);

    expect(chunks.map((chunk) => chunk.length)).toEqual([450, 450, 101]);
    expect(chunks.flat()).toHaveLength(1_001);
  });

  it("rejects invalid batch sizes", () => {
    expect(() => chunkArray([1], 0)).toThrow("positive integer");
  });
});
