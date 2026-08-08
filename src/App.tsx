import { appTheme } from '@/config/theme'

// Placeholder shell. Replaced by backlog item 2 (router + AppLayout + App* wrappers).
export default function App() {
  return (
    <main className="app-shell app-main">
      <h1 className="text-3xl font-semibold text-ink-900 dark:text-ink-100">{appTheme.appName}</h1>
      <p className="mt-2 text-ink-500">Scaffold is up. See GOAL.md for the backlog.</p>
    </main>
  )
}
