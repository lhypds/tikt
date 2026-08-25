// mapbox-gl ships a 1.8MB prebuilt bundle. Handing that to rollup pushed the
// production build past 600MB of RSS, which the deploy box answers with a
// SIGKILL, so the file is copied into public/ and loaded at runtime instead —
// vite never parses it, and the build is back to the size it was before.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "node_modules", "mapbox-gl", "dist");
const to = path.join(root, "public", "vendor");
const files = ["mapbox-gl.js", "mapbox-gl.css"];

if (!fs.existsSync(from)) {
  console.error("mapbox-gl is not installed — run the package manager's install first.");
  process.exit(1);
}

fs.mkdirSync(to, { recursive: true });
for (const file of files) {
  const source = path.join(from, file);
  const target = path.join(to, file);
  // Skipping an unchanged copy keeps `pnpm dev` from rewriting files vite watches.
  const sourceStat = fs.statSync(source);
  const targetStat = fs.statSync(target, { throwIfNoEntry: false });
  if (targetStat && targetStat.size === sourceStat.size && targetStat.mtimeMs >= sourceStat.mtimeMs) continue;
  fs.copyFileSync(source, target);
  console.log(`copied ${file} → public/vendor/`);
}
