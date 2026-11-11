import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = (cmd, args, quiet = false) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "inherit"] : "inherit",
  });
const git = (...args) => run("git", args, true).trim();
const commit = git("rev-parse", "HEAD");
if (git("status", "--porcelain"))
  throw new Error("Deploy requires a clean tree");
git("fetch", "origin", "main");
if (commit !== git("rev-parse", "origin/main"))
  throw new Error("Deploy requires the pushed main commit");
const runs = JSON.parse(
  run(
    "gh",
    [
      "run",
      "list",
      "--workflow",
      "CI",
      "--branch",
      "main",
      "--commit",
      commit,
      "--event",
      "push",
      "--json",
      "headSha,status,conclusion,url",
      "--limit",
      "1",
    ],
    true,
  ),
);
const ci = runs[0];
if (
  ci?.headSha !== commit ||
  ci.status !== "completed" ||
  ci.conclusion !== "success"
)
  throw new Error("Deploy requires exact green main CI");
console.log(`Exact green CI: ${ci.url}`);
run("npm", ["run", "build"]);
const release = JSON.parse(readFileSync("dist/release.json", "utf8"));
if (release.commit !== commit || release.dirty !== false)
  throw new Error("Build provenance does not match clean HEAD");
run("pnpm", ["exec", "wrangler", "deploy"]);
let verified = false;
for (let attempt = 0; attempt < 10; attempt++) {
  const response = await fetch(
    `https://lefthand.adamwhite.work/release.json?commit=${commit}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Release receipt HTTP ${response.status}`);
  const live = await response.json();
  if (live.commit === commit && live.dirty === false) {
    console.log(`Verified live release: ${commit}, dirty:false`);
    verified = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
if (!verified) throw new Error("Live release did not match deployed commit");
