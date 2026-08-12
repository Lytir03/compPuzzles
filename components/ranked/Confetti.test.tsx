import { describe, expect, it } from "vitest";
import { Confetti } from "./Confetti";

/**
 * The win burst is rendered on the server and again on the client. If its
 * geometry came from `Math.random()`, the two passes would disagree and React
 * would log a hydration mismatch on every ranked win — so the seeding has to
 * be deterministic. These tests pin that property rather than the visuals.
 */

type Rendered = { props: { style: Record<string, unknown> } };

function pieceStyles(seed: string): Record<string, unknown>[] {
  const tree = Confetti({ seed }) as unknown as {
    props: { children: Rendered[] };
  };
  return tree.props.children.map((child) => child.props.style);
}

describe("Confetti", () => {
  it("produces identical geometry for the same seed", () => {
    expect(pieceStyles("match_abc")).toEqual(pieceStyles("match_abc"));
  });

  it("produces different geometry for a different match", () => {
    expect(pieceStyles("match_abc")).not.toEqual(pieceStyles("match_xyz"));
  });

  it("keeps every piece within the viewport horizontally", () => {
    for (const style of pieceStyles("match_abc")) {
      const left = Number.parseFloat(String(style.left));
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(100);
    }
  });
});
