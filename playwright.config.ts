import { defineConfig, devices } from '@playwright/test'

const port = 3100
const baseURL = `http://localhost:${port}`

// ponytail: chromium only, dev server reused locally. Add browsers/CI shards when a
// real cross-browser bug shows up.
export default defineConfig({
  testDir: './e2e',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
