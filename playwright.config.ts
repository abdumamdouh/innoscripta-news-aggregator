import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:3100'

// ponytail: minimum harness so item 1c ships with a spec — item 1b owns the full
// version (the three responsive viewport projects and e2e/shell.spec.ts).
export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  forbidOnly: !!process.env.CI,
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 3100 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
