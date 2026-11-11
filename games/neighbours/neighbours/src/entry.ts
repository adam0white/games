type Entry =
	| { kind: "native" | "file" | "refuse" }
	| { kind: "redirect"; href: string };

/** Pure: run before importing App, Lab, or any native startup module. */
export function classifyEntry(url: URL): Entry {
	const values = url.searchParams.getAll("file");
	if (values.length > 1 || (values.length === 1 && values[0] !== "1"))
		return { kind: "refuse" };
	if (
		values.length ||
		url.pathname === "/neighbours/file" ||
		url.pathname === "/neighbours/file/index.html"
	) {
		const target = new URL(url);
		target.pathname = "/neighbours/file/";
		target.searchParams.delete("file");
		return {
			kind: "redirect",
			href: target.pathname + target.search + target.hash,
		};
	}
	if (url.pathname === "/neighbours/file/") return { kind: "file" };
	return { kind: "native" };
}
