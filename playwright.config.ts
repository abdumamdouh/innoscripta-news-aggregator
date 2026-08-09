import { defineConfig, devices } from '@playwright/test'

const port = 3100
const baseURL = `http://localhost:${port}`

// Chromium only, dev server reused locally. Add browsers/CI shards when a
// real cross-browser bug shows up.
export default defineConfig({
  testDir: './e2e',
  // .spec.ts only: e2e/*.test.ts are Vitest unit tests over the fixtures (see vite.config.ts).
  testMatch: '**/*.spec.ts',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Recognisable stand-in keys, so "no key reached the browser" is a real assertion and
    // not one that passes because nothing was configured. Real keys are never needed for
    // e2e: every provider response is served from a fixture.
    env: {
      NEWSAPI_KEY: 'e2e-newsapi-key',
      GUARDIAN_KEY: 'e2e-guardian-key',
      NYT_KEY: 'e2e-nyt-key',
    },
  },
})
