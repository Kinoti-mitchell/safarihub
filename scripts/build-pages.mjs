import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const frontend = join(root, "frontend");
const heroSrc = join(root, "public", "hero");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(frontend, dist, { recursive: true });
cpSync(heroSrc, join(dist, "hero"), { recursive: true });

// SPA / deep-link fallback for GitHub Pages
const index = readFileSync(join(dist, "index.html"), "utf8");
writeFileSync(join(dist, "404.html"), index);

console.log("[pages] Built static frontend → dist/");
