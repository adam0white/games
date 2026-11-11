import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
writeFileSync(
  "public/release.json",
  `${JSON.stringify({
    game: "child",
    commit: git("rev-parse", "HEAD"),
    dirty: git("status", "--porcelain").length > 0,
    humanFramework: "4.17.0",
  })}\n`,
);
