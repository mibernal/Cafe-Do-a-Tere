import { defineConfig, devices } from "@playwright/test";

// Pruebas del sitio estático (out/). Primero: npm run build:pages
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const port = Number(process.env.PAGES_PREVIEW_PORT ?? 4180);
// Permite usar un Chromium ya instalado (p. ej. en un contenedor sin descargas).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // En CI, "github" convierte cada falla en una anotación visible en el PR.
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}${basePath}/`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "movil", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs out ${port}`,
    url: `http://127.0.0.1:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
  },
});
