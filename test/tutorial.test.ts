import { describe, expect, it } from "vitest";
import {
  advanceGuide,
  type GuideState,
  readGuideDone,
  writeGuideDone,
} from "../src/tutorial.ts";

describe("first delivery guide", () => {
  it("waits for a route, an actual move and a lantern change before showing the consequence", () => {
    let guide: GuideState = "route";
    expect(advanceGuide(guide, "move")).toBe("route");
    guide = advanceGuide(guide, "route");
    expect(guide).toBe("move");
    expect(advanceGuide(guide, "lantern")).toBe("move");
    guide = advanceGuide(guide, "move");
    expect(guide).toBe("lantern");
    guide = advanceGuide(guide, "lantern");
    expect(guide).toBe("consequence");
    expect(advanceGuide(guide, "continue")).toBe("done");
  });
});

it("keeps the guide usable when storage is blocked", () => {
  const denied = () => {
    throw new Error("storage blocked");
  };
  expect(readGuideDone(denied)).toBe(false);
  expect(() => writeGuideDone(denied)).not.toThrow();
});
