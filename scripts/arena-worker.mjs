import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const mode = process.argv[2] || "dev";
if (!["dev", "deploy", "login"].includes(mode))
  throw Error("Unsupported Worker command");
const args = [
  fileURLToPath(
    new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
  ),
  mode,
];
if (mode !== "login") args.push("--config", "multiplayer/wrangler.jsonc");
if (mode === "dev")
  args.push(
    "--local",
    "--port",
    "8787",
    "--var",
    "ALLOWED_ORIGINS:http://127.0.0.1:5173,http://localhost:5173",
    "--var",
    "CREATION_COOLDOWN:0",
  );
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || resolve(".wrangler-user"),
    WRANGLER_LOG_PATH:
      process.env.WRANGLER_LOG_PATH || resolve(".wrangler-user/logs"),
    WRANGLER_SEND_METRICS: "false",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
