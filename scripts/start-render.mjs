import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = String(process.env.PORT || 10000);
const hostname = "0.0.0.0";
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

console.log(`[render] starting Next.js on http://${hostname}:${port}`);

const child = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", hostname, "--port", port],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: hostname,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
