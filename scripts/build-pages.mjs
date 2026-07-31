import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const frontend = join(root, "frontend");

const appUrl = (
  process.env.RENDER_APP_URL ||
  process.env.SAFARI_HUB_APP_URL ||
  "https://safari-hub-beta.vercel.app"
)
  .trim()
  .replace(/\/+$/, "");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// GitHub Pages is only a redirect door to the full Vercel app.
let html = readFileSync(join(frontend, "index.html"), "utf8");
html = html
  .replaceAll("https://safari-hub-beta.vercel.app", appUrl)
  .replaceAll("https://safari-hub.onrender.com", appUrl);
writeFileSync(join(dist, "index.html"), html);
writeFileSync(join(dist, "404.html"), html);

console.log(`[pages] Built redirect → ${appUrl}`);
