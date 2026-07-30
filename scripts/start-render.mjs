import { createServer } from "node:http";
import { parse } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT || "10000", 10);
const hostname = "0.0.0.0";

const app = next({
  dev: false,
  dir: root,
  hostname,
  port,
});
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url || "/", true);
  handle(req, res, parsedUrl);
});

server.listen(port, hostname, () => {
  console.log(`[render] listening on http://${hostname}:${port}`);
});

server.on("error", (err) => {
  console.error("[render] server error", err);
  process.exit(1);
});
