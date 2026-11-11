import { describe, expect, it } from "vitest";
import { classifyEntry } from "../src/entry";

describe("public file entry", () => {
	it("redirects a single legacy value without dropping source attribution", () => {
		expect(
			classifyEntry(new URL("https://example.test/?file=1&source=agent#saved")),
		).toEqual({
			kind: "redirect",
			href: "/neighbours/file/?source=agent#saved",
		});
	});
	it("refuses ambiguous file values before either startup", () => {
		for (const path of [
			"/?file=0",
			"/?file=",
			"/?file=1&file=1",
			"/neighbours/file/?file=1&file=0",
		])
			expect(classifyEntry(new URL(path, "https://example.test")).kind).toBe(
				"refuse",
			);
	});
	it("admits canonical file entry and preserves ordinary native entry", () => {
		expect(
			classifyEntry(new URL("https://example.test/neighbours/file/")),
		).toEqual({
			kind: "file",
		});
		expect(
			classifyEntry(new URL("https://example.test/neighbours/file/index.html")),
		).toEqual({ kind: "redirect", href: "/neighbours/file/" });
		expect(
			classifyEntry(new URL("https://example.test/?source=agent")),
		).toEqual({ kind: "native" });
	});
});
