import { expect, test } from "vitest";
import { helloFrame } from "../src/hello";

test("hello scene presents a complete authoritative grid", () => {
  expect(helloFrame.tiles).toHaveLength(helloFrame.width * helloFrame.height);
});
