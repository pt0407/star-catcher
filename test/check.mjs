import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.log("FAIL", msg); } };

const html = readFileSync(join(root, "index.html"), "utf8");
for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const ref = m[1];
  if (ref.startsWith("http") || ref.startsWith("data:")) continue;
  check(existsSync(join(root, ref.split("?")[0])), `missing ${ref}`);
}

for (const f of readdirSync(join(root, "assets"))) {
  if (f.endsWith(".png")) continue;
}

const sprites = readFileSync(join(root, "sprites.js"), "utf8");
for (const m of sprites.matchAll(/assets\/([\w.]+)/g)) {
  check(existsSync(join(root, "assets", m[1])), `sprite asset missing ${m[1]}`);
}

JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

if (failed === 0) console.log("all checks passed");
else { console.log(`${failed} check(s) failed`); process.exit(1); }
