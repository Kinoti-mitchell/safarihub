import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const frontend = join(root, "frontend");
const heroSrc = join(root, "public", "hero");

const appUrl = (
  process.env.RENDER_APP_URL ||
  process.env.SAFARI_HUB_APP_URL ||
  "https://safari-hub.onrender.com"
)
  .trim()
  .replace(/\/+$/, "");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(frontend, dist, { recursive: true });
cpSync(heroSrc, join(dist, "hero"), { recursive: true });

writeFileSync(
  join(dist, "config.js"),
  `/** Live full app (Render). */\nwindow.SAFARI_HUB_APP_URL = ${JSON.stringify(appUrl)};\n`,
);

const index = readFileSync(join(dist, "index.html"), "utf8").replaceAll(
  "https://safari-hub.onrender.com",
  appUrl,
);
writeFileSync(join(dist, "index.html"), index);
writeFileSync(join(dist, "404.html"), index);

console.log(`[pages] Built static frontend → dist/ (app: ${appUrl})`);
