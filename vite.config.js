import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

// Keep a working public default even when an old offline cache has empty settings.
const { endpoint } = JSON.parse(
  readFileSync(new URL("./public/multiplayer.json", import.meta.url), "utf8"),
);
if (typeof endpoint !== "string")
  throw Error("multiplayer.json must contain a public endpoint string");

// Relative asset URLs support GitHub Pages project paths and other static hosts.
export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_MYOS_MULTIPLAYER_ENDPOINT": JSON.stringify(endpoint),
  },
});
