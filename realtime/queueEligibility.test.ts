import { describe, expect, it } from "vitest";
import { partitionEligibleQueueEntries } from "./queueEligibility";

describe("partitionEligibleQueueEntries", () => {
  const entries = [
    { id: "q-online-active", competitorId: "active" },
    { id: "q-offline", competitorId: "offline" },
    { id: "q-inactive", competitorId: "inactive" },
  ];

  it("keeps only current online competitors whose profile is ACTIVE", () => {
    const result = partitionEligibleQueueEntries(
      entries,
      new Set(["active", "inactive"]),
      [{ competitorId: "active", username: "player" }],
    );

    expect(result.eligible).toEqual([entries[0]]);
    expect(result.staleIds).toEqual(["q-offline", "q-inactive"]);
    expect(result.usernames.get("active")).toBe("player");
  });
});
