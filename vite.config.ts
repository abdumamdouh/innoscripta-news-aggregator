import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createProxy } from './vite.proxy.ts'

// Dev-only proxies. Two reasons they exist:
//  - NewsAPI's free tier refuses browser requests from anything but localhost (CORS).
//  - BBC publishes RSS, not an API, and sends no CORS headers at all.
// Production does the same job in nginx (see docker/nginx.conf.template), so the
// adapters call the same /api/* paths in both environments and never see a key.
//
// `loadEnv(mode, cwd, '')` reads .env.local and the process environment with NO prefix
// filter, which is the point: the keys are deliberately unprefixed so Vite's own
// `import.meta.env` inlining (VITE_* only) can never put them in the bundle. They are read
// here, in the Node config, and attached by the proxy.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 3000, proxy: createProxy(loadEnv(mode, process.cwd(), '')) },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // e2e/ belongs to Playwright (npm run test:e2e). Vitest's default glob would pick up
    // those specs and blow up on test.use(); scoping include to src/ and excluding e2e/
    // are belt and braces, but the exclude is what stops a stray src-adjacent spec too.
    // The root glob is for the build-time proxy wiring, which lives next to this file.
    include: ['src/**/*.{test,spec}.{ts,tsx}', '*.{test,spec}.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    css: true,
    // Real suites land with backlog item 3 (aggregator). Until then an empty run is
    // a pass, not a failure — otherwise the loop's test gate is red from iteration 1.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/features/**/utils/**', 'src/hooks/**'],
    },
  },
}))
