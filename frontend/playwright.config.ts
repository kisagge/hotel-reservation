import { defineConfig } from "@playwright/test";

const API_PORT = 8100;
const WEB_PORT = 3100;
const E2E_DB = "postgresql+psycopg://haru:haru@localhost:5433/haru_e2e";

/**
 * E2E against a production build + real FastAPI on dedicated ports and database, so dev servers keep running.
 * The mobile project runs in America/Los_Angeles to prove the UI still shows Asia/Seoul times.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${WEB_PORT}`, locale: "ko-KR", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", testMatch: /booking\.spec\.ts/, use: { browserName: "chromium", viewport: { width: 390, height: 844 }, timezoneId: "America/Los_Angeles" } },
    { name: "desktop", testMatch: /(admin|screenshots|a11y)\.spec\.ts/, use: { browserName: "chromium", viewport: { width: 1440, height: 1024 }, timezoneId: "Asia/Seoul" } },
  ],
  webServer: [
    {
      command: `bash ../scripts/e2e-db.sh && cd ../backend && HARU_DATABASE_URL=${E2E_DB} HARU_UPLOAD_DIR=uploads-e2e uv run fastapi run app/main.py --port ${API_PORT}`,
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // Same artifact the Docker image runs: the standalone server plus static assets.
      command: `npx next build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && PORT=${WEB_PORT} node .next/standalone/server.js`,
      env: { API_ORIGIN: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}/login`,
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
