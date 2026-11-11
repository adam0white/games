import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import zlib from "node:zlib";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const metadata = JSON.parse(fs.readFileSync("release-metadata.json", "utf8"));
const godotBinary =
  process.platform === "darwin"
    ? ".godot-tools/Godot.app/Contents/MacOS/Godot"
    : ".godot-tools/Godot_v4.7.2-stable_linux.x86_64";
const godotVersion = execFileSync(godotBinary, ["--version"], {
  encoding: "utf8",
}).trim();
if (
  Object.keys(metadata).sort().join(",") !== "app,engine,godot" ||
  metadata.app !== "lefthand" ||
  metadata.engine !== pkg.dependencies["@adam0white/human-framework"] ||
  metadata.godot !== "4.7.2" ||
  !godotVersion.startsWith(`${metadata.godot}.`)
)
  throw new Error(
    "Release metadata does not match the game and verified engine versions",
  );

const artifacts = fs
  .readdirSync("dist")
  .filter((file) => file.startsWith("game.") && file !== "game.html")
  .sort();
const raw = fs.readFileSync("dist/game.wasm");
const contentHash = crypto.createHash("sha256");
for (const file of artifacts) {
  const data = fs.readFileSync(`dist/${file}`);
  contentHash.update(`${file}:${data.length}:`).update(data);
}
const digest = contentHash.digest("hex").slice(0, 16);
const name = `game-${digest}`;
fs.mkdirSync("dist/engine", { recursive: true });
for (const file of artifacts) {
  const data = fs.readFileSync(`dist/${file}`);
  const suffix = file.slice("game".length);
  fs.writeFileSync(
    `dist/engine/${name}${suffix}${suffix === ".wasm" ? ".gz" : ""}`,
    suffix === ".wasm" ? zlib.gzipSync(data, { level: 9 }) : data,
  );
}
for (const f of fs.readdirSync("dist"))
  if (f.startsWith("game."))
    fs.rmSync(`dist/${f}`, { recursive: true, force: true });
fs.writeFileSync(
  "dist/engine.json",
  JSON.stringify({
    executable: `/lefthand/engine/${name}`,
    script: `/lefthand/engine/${name}.js`,
    pack: `/lefthand/engine/${name}.pck`,
  }),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
    .length > 0;
fs.writeFileSync(
  "dist/release.json",
  JSON.stringify({
    ...metadata,
    framework: pkg.dependencies["@adam0white/human-framework"],
    commit,
    dirty,
  }),
);
const common = fs.readFileSync("public/_headers", "utf8");
fs.writeFileSync(
  "dist/_headers",
  `${common}\n/engine/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n`,
);
const files = fs
  .readdirSync("dist", { recursive: true })
  .filter((f) => fs.statSync(`dist/${f}`).isFile());
for (const f of files)
  if (fs.statSync(`dist/${f}`).size >= 25 * 1024 * 1024)
    throw new Error(`Asset too large: ${f}`);
console.log(
  JSON.stringify({
    rawWasm: raw.length,
    gzipWasm: fs.statSync(`dist/engine/${name}.wasm.gz`).size,
    commit,
    dirty,
  }),
);
