import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests-production",
  use: {
    baseURL: "http://127.0.0.1:5181",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    },
  },
  webServer: {
    command: "node scripts/serve-production.mjs",
    url: "http://127.0.0.1:5181/MyOS/",
    reuseExistingServer: false,
  },
});
